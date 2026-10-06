//! Kleiner HTTP-Server auf `127.0.0.1` mit Zufalls-Port: liefert Dateien aus dem Ordner
//! `.artefakte` eines Vorhabens an den abgeschotteten Rahmen der Vorschau (ADR 026).
//!
//! Warum kein eigenes Tauri-Protokoll: Tauri stuft Seiten eines von der App registrierten
//! Protokolls als „lokal“ ein und gibt ihnen die Rechte der App; die Init-Skripte samt Invoke-Key
//! laufen unter Windows auch im iframe. Eine Seite von `127.0.0.1` ist für Tauri entfernte
//! Herkunft — jeder Befehl wird ohne Remote-Capability abgewiesen, auch wenn er durchkäme.
//!
//! Adresse: `http://127.0.0.1:<port>/<token>/<session-id>/<pfad>`. Der Zufalls-Token hält andere
//! Seiten (etwa im Browser) draußen, die Prüfung des `Host`-Kopfes DNS-Rebinding.
use std::fs;
use std::io::{self, Read, Write};
use std::net::{Ipv4Addr, SocketAddr, TcpListener, TcpStream};
use std::path::Path;
use std::thread;
use std::time::Duration;

use tauri::{AppHandle, Manager};

use super::resolve;
use crate::error::CommandError;
use crate::sessions::registry::SessionRegistry;

const MAX_REQUEST_BYTES: usize = 16 * 1024;
const READ_TIMEOUT: Duration = Duration::from_secs(5);
const TEXT_PLAIN: &str = "text/plain; charset=utf-8";

/// Der laufende Server; als Tauri-State verwaltet.
pub struct ArtifactServer {
    origin: String,
    token: String,
}

impl ArtifactServer {
    /// Adresse des Artefakt-Ordners der Session, mit `/` am Ende; dahinter folgt der Dateiname.
    pub fn base_url(&self, session_id: &str) -> String {
        format!(
            "{}/{}/{}/",
            self.origin,
            self.token,
            percent_encode(session_id)
        )
    }
}

/// Bindet an einen freien Port auf `127.0.0.1` und nimmt in einem eigenen Thread Verbindungen an.
pub fn start(app: AppHandle) -> io::Result<ArtifactServer> {
    let listener = TcpListener::bind(SocketAddr::from((Ipv4Addr::LOCALHOST, 0)))?;
    let port = listener.local_addr()?.port();
    let server = ArtifactServer {
        origin: format!("http://127.0.0.1:{port}"),
        token: uuid::Uuid::new_v4().simple().to_string(),
    };
    let host = format!("127.0.0.1:{port}");
    let token = server.token.clone();
    let origin = server.origin.clone();
    thread::Builder::new()
        .name("artifact-server".to_owned())
        .spawn(move || {
            for stream in listener.incoming().flatten() {
                let connection = Connection {
                    app: app.clone(),
                    host: host.clone(),
                    origin: origin.clone(),
                    token: token.clone(),
                };
                // Eine langsame Seite soll die nächste Anfrage nicht aufhalten.
                let _ = thread::Builder::new()
                    .name("artifact-request".to_owned())
                    .spawn(move || connection.serve(stream));
            }
        })?;
    Ok(server)
}

struct Connection {
    app: AppHandle,
    host: String,
    origin: String,
    token: String,
}

struct Reply {
    status: u16,
    reason: &'static str,
    content_type: &'static str,
    body: Vec<u8>,
    csp: Option<String>,
}

impl Connection {
    fn serve(self, mut stream: TcpStream) {
        let _ = stream.set_read_timeout(Some(READ_TIMEOUT));
        let reply = match read_head(&mut stream) {
            Some(head) => self.answer(&head),
            None => text_reply(400, "Bad Request", "Ungültige Anfrage"),
        };
        let _ = write_reply(&mut stream, reply);
    }

    fn answer(&self, head: &str) -> Reply {
        let mut lines = head.split("\r\n");
        let mut request_line = lines.next().unwrap_or_default().split(' ');
        let method = request_line.next().unwrap_or_default();
        let target = request_line.next().unwrap_or_default();
        let host = lines
            .filter_map(|line: &str| line.split_once(':'))
            .find(|(name, _): &(&str, &str)| name.trim().eq_ignore_ascii_case("host"))
            .map(|(_, value): (&str, &str)| value.trim());
        if host != Some(self.host.as_str()) {
            return text_reply(403, "Forbidden", "Nicht erlaubt");
        }
        if method != "GET" {
            return text_reply(405, "Method Not Allowed", "Nur GET");
        }
        let path = target.split(['?', '#']).next().unwrap_or_default();
        let Some(rest) = path
            .strip_prefix('/')
            .and_then(|path: &str| path.strip_prefix(self.token.as_str()))
            .and_then(|path: &str| path.strip_prefix('/'))
        else {
            return not_found();
        };
        let Some((session_part, file_part)) = rest.split_once('/') else {
            return not_found();
        };
        let (Some(session_id), Some(relative)) =
            (percent_decode(session_part), percent_decode(file_part))
        else {
            return not_found();
        };
        // `try_state`: eine Anfrage vor dem Ende von `setup` fände die Registry noch nicht vor.
        let Some(registry) = self.app.try_state::<SessionRegistry>() else {
            return not_found();
        };
        let Ok(dir) = registry.artifacts_dir(&session_id) else {
            return not_found();
        };
        let target = match resolve(&dir, &relative.replace('/', "\\")) {
            Ok(target) => target,
            Err(CommandError::FileNotFound(_)) => return not_found(),
            Err(_) => return text_reply(403, "Forbidden", "Nicht erlaubt"),
        };
        let Ok(body) = fs::read(&target) else {
            return not_found();
        };
        // Aus der geprüften Session-ID neu kodiert, nie aus dem Anfragetext: der landet sonst in der CSP.
        let scope = format!(
            "{}/{}/{}/",
            self.origin,
            self.token,
            percent_encode(&session_id)
        );
        Reply {
            status: 200,
            reason: "OK",
            content_type: content_type(&target),
            body,
            csp: Some(artifact_csp(&scope)),
        }
    }
}

/// Die Seite darf aus ihrem eigenen Ordner und über https laden, sonst nichts — insbesondere nicht
/// `http://ipc.localhost` und nicht die Ordner anderer Sessions auf demselben Server.
fn artifact_csp(scope: &str) -> String {
    format!(
        "default-src {scope} https: data: blob: 'unsafe-inline' 'unsafe-eval'; \
         connect-src {scope} https:; form-action 'none'; base-uri {scope}"
    )
}

/// Liest bis zum Ende der Kopfzeilen; ein Körper wird nie gelesen (nur `GET`).
fn read_head(stream: &mut TcpStream) -> Option<String> {
    let mut buffer: Vec<u8> = Vec::new();
    let mut chunk = [0u8; 2048];
    while !buffer.windows(4).any(|window: &[u8]| window == b"\r\n\r\n") {
        if buffer.len() > MAX_REQUEST_BYTES {
            return None;
        }
        let read = stream.read(&mut chunk).ok()?;
        if read == 0 {
            return None;
        }
        buffer.extend_from_slice(&chunk[..read]);
    }
    String::from_utf8(buffer).ok()
}

fn write_reply(stream: &mut TcpStream, reply: Reply) -> io::Result<()> {
    let mut head = format!(
        "HTTP/1.1 {} {}\r\nContent-Type: {}\r\nContent-Length: {}\r\nCache-Control: no-store\r\n\
         X-Content-Type-Options: nosniff\r\nConnection: close\r\n",
        reply.status,
        reply.reason,
        reply.content_type,
        reply.body.len()
    );
    if let Some(csp) = &reply.csp {
        head.push_str(&format!(
            "Access-Control-Allow-Origin: *\r\nContent-Security-Policy: {csp}\r\n"
        ));
    }
    head.push_str("\r\n");
    stream.write_all(head.as_bytes())?;
    stream.write_all(&reply.body)?;
    stream.flush()
}

fn not_found() -> Reply {
    text_reply(404, "Not Found", "Nicht gefunden")
}

fn text_reply(status: u16, reason: &'static str, text: &str) -> Reply {
    Reply {
        status,
        reason,
        content_type: TEXT_PLAIN,
        body: text.as_bytes().to_vec(),
        csp: None,
    }
}

/// Alles außer `A–Z a–z 0–9 - _ . ~` als `%XX`.
fn percent_encode(text: &str) -> String {
    let mut encoded = String::with_capacity(text.len());
    for byte in text.bytes() {
        if byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b'~') {
            encoded.push(char::from(byte));
        } else {
            encoded.push_str(&format!("%{byte:02X}"));
        }
    }
    encoded
}

/// `%` + zwei Hex-Ziffern → Byte, alles andere bleibt; ein unvollständiges `%` oder kein UTF-8 →
/// `None`. Eigene Funktion, damit der Server keine neue Abhängigkeit braucht.
fn percent_decode(text: &str) -> Option<String> {
    let bytes = text.as_bytes();
    let mut decoded: Vec<u8> = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' {
            let high = hex_value(*bytes.get(index + 1)?)?;
            let low = hex_value(*bytes.get(index + 2)?)?;
            decoded.push(high * 16 + low);
            index += 3;
        } else {
            decoded.push(bytes[index]);
            index += 1;
        }
    }
    String::from_utf8(decoded).ok()
}

fn hex_value(byte: u8) -> Option<u8> {
    char::from(byte)
        .to_digit(16)
        .and_then(|digit: u32| u8::try_from(digit).ok())
}

fn content_type(path: &Path) -> &'static str {
    let extension = path
        .extension()
        .map(|extension| extension.to_string_lossy().to_ascii_lowercase())
        .unwrap_or_default();
    match extension.as_str() {
        "html" | "htm" => "text/html; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "json" | "map" => "application/json",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "ico" => "image/x-icon",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        "ttf" => "font/ttf",
        "otf" => "font/otf",
        "txt" | "md" | "csv" => TEXT_PLAIN,
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        _ => "application/octet-stream",
    }
}
