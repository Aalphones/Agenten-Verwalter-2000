//! Kleiner HTTP-Server auf `127.0.0.1` mit Zufalls-Port: liefert Dateien aus dem Ordner
//! `.artefakte` eines Vorhabens und einzelne geprüfte Dateien an den abgeschotteten Rahmen der
//! Vorschau (ADR 026, 071).
//!
//! Warum kein eigenes Tauri-Protokoll: Tauri stuft Seiten eines von der App registrierten
//! Protokolls als „lokal“ ein und gibt ihnen die Rechte der App; die Init-Skripte samt Invoke-Key
//! laufen unter Windows auch im iframe. Eine Seite von `127.0.0.1` ist für Tauri entfernte
//! Herkunft — jeder Befehl wird ohne Remote-Capability abgewiesen, auch wenn er durchkäme.
//!
//! Adressen: `http://127.0.0.1:<port>/<token>/<session-id>/<pfad>` für die Artefakte,
//! `…/<token>/~datei/<handle>/<name>` für eine einzelne Datei (`ViewHandles`). Der Zufalls-Token
//! hält andere Seiten (etwa im Browser) draußen, die Prüfung des `Host`-Kopfes DNS-Rebinding. Die
//! CSP trennt die Bereiche; bei einer Umleitung prüft sie den Pfad aber nicht, dann schützt allein
//! der zufällige Handle.
use std::fs;
use std::io::{self, Read, Write};
use std::net::{Ipv4Addr, SocketAddr, TcpListener, TcpStream};
use std::path::Path;
use std::thread;
use std::time::Duration;

use tauri::{AppHandle, Manager};

use super::folder::{list_folder, resolve_folder};
use super::model::ArtifactKind;
use super::{kind_of, resolve, viewers};
use crate::error::CommandError;
use crate::filesystem::native_path;
use crate::session_files::handles::ViewHandles;
use crate::sessions::registry::SessionRegistry;

pub const SERVER_MISSING: &str = "Der Server für Artefakte ist nicht gestartet";
/// Steht hinter dem Token vor den einzelnen Dateien; eine Session-ID heißt nie so.
const FILE_SEGMENT: &str = "~datei";
const MAX_REQUEST_BYTES: usize = 16 * 1024;
const READ_TIMEOUT: Duration = Duration::from_secs(5);
const TEXT_PLAIN: &str = "text/plain; charset=utf-8";
const HTML: &str = "text/html; charset=utf-8";
const JSON: &str = "application/json";
const INDEX_PAGE: &str = "index.html";
const BRIDGE_SCRIPT: &str = include_str!("bridge.js");
const STORAGE_SHIM_SCRIPT: &str = include_str!("storage-shim.js");

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

    /// Adresse der Betrachter-Seite einer einzelnen Datei hinter ihrem Handle; ohne `?view=1`
    /// liefert der Server die Datei selbst. `name` ist ihr Dateiname.
    pub fn file_url(&self, handle: &str, name: &str) -> String {
        format!(
            "{}/{}/{FILE_SEGMENT}/{handle}/{}?view=1",
            self.origin,
            self.token,
            percent_encode(name)
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
    /// `Access-Control-Allow-Origin: *`.
    cross_origin: bool,
    /// Rohdatei, für die der Server `Range` beantwortet.
    accepts_ranges: bool,
    content_range: Option<String>,
}

/// Was eine Anfrage über den Pfad hinaus verlangt.
struct Wanted<'a> {
    /// `?view=1`
    viewer: bool,
    /// `?list=1`
    list: bool,
    /// Die Kopfzeile `Range`.
    range: Option<&'a str>,
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
        let mut request_line = head.split("\r\n").next().unwrap_or_default().split(' ');
        let method = request_line.next().unwrap_or_default();
        let target = request_line.next().unwrap_or_default();
        if header_value(head, "host") != Some(self.host.as_str()) {
            return text_reply(403, "Forbidden", "Nicht erlaubt");
        }
        if method != "GET" {
            return text_reply(405, "Method Not Allowed", "Nur GET");
        }
        let target = target.split('#').next().unwrap_or_default();
        let (path, query) = target.split_once('?').unwrap_or((target, ""));
        let Some(rest) = path
            .strip_prefix('/')
            .and_then(|path: &str| path.strip_prefix(self.token.as_str()))
            .and_then(|path: &str| path.strip_prefix('/'))
        else {
            return not_found();
        };
        let wanted = Wanted {
            viewer: query.split('&').any(|pair: &str| pair == "view=1"),
            list: query.split('&').any(|pair: &str| pair == "list=1"),
            range: header_value(head, "range"),
        };
        let file_rest = rest
            .strip_prefix(FILE_SEGMENT)
            .and_then(|rest: &str| rest.strip_prefix('/'));
        let mut reply = match file_rest {
            Some(file_rest) => self.answer_file(file_rest, &wanted),
            None => self.answer_artifact(rest, &wanted),
        };
        // Die Betrachter laufen mit leerer Herkunft: ohne diesen Kopf sähe ihr `fetch` statt eines
        // 404 nur einen Netzfehler. Erst hinter dem Token, sonst ertastete jede Seite den Server.
        reply.cross_origin = true;
        reply
    }

    /// Eine einzelne Datei hinter ihrem Handle (ADR 071): `rest` ist genau `<handle>/<name>`.
    fn answer_file(&self, rest: &str, wanted: &Wanted) -> Reply {
        let Some((handle, name_part)) = rest.split_once('/') else {
            return not_found();
        };
        if name_part.contains('/') {
            return not_found();
        }
        let Some(name) = percent_decode(name_part) else {
            return not_found();
        };
        let Some(handles) = self.app.try_state::<ViewHandles>() else {
            return not_found();
        };
        let Some(path) = handles.get(handle) else {
            return not_found();
        };
        let has_name = path
            .file_name()
            .is_some_and(|file| file.to_string_lossy() == name.as_str());
        if !has_name || !is_still_in_place(&path) {
            return not_found();
        }
        // `handle` hat einen ausgegebenen Handle buchstabengleich getroffen, darum darf er in die
        // CSP.
        let scope = format!("{}/{}/{FILE_SEGMENT}/{handle}/", self.origin, self.token);
        file_reply(&path, wanted, &scope)
    }

    /// Datei, Liste oder Ordner-Betrachter aus `.artefakte`: `rest` ist `<session-id>/<pfad>`.
    fn answer_artifact(&self, rest: &str, wanted: &Wanted) -> Reply {
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
        // Aus der geprüften Session-ID neu kodiert, nie aus dem Anfragetext: der landet sonst in der CSP.
        let scope = format!(
            "{}/{}/{}/",
            self.origin,
            self.token,
            percent_encode(&session_id)
        );
        // `<ordner>/?list=1` ist die Dateiliste, `<ordner>/?view=1` der Ordner-Betrachter.
        if wanted.list || (wanted.viewer && relative.ends_with('/')) {
            let folder_relative = relative.trim_end_matches('/');
            let folder = match resolve_folder(&dir, folder_relative) {
                Ok(folder) => folder,
                Err(CommandError::FileNotFound(_)) => return not_found(),
                Err(_) => return text_reply(403, "Forbidden", "Nicht erlaubt"),
            };
            if wanted.list {
                let listing = list_folder(&dir, &folder, folder_relative);
                return match serde_json::to_vec(&listing) {
                    Ok(body) => page_reply(JSON, body, &scope),
                    Err(_) => not_found(),
                };
            }
            let name = folder
                .file_name()
                .map(|name| name.to_string_lossy().into_owned())
                .unwrap_or_default();
            return match viewers::render(ArtifactKind::Folder, &name) {
                Some(page) => page_reply(HTML, with_bridge(page.into_bytes()), &scope),
                None => not_found(),
            };
        }
        // Ein Ordner-Ziel (`<ordner>/`) ist eine Website: ihre `index.html`.
        let relative = if relative.ends_with('/') {
            format!("{relative}{INDEX_PAGE}")
        } else {
            relative
        };
        let target = match resolve(&dir, &native_path(&relative).to_string_lossy()) {
            Ok(target) => target,
            Err(CommandError::FileNotFound(_)) => return not_found(),
            Err(_) => return text_reply(403, "Forbidden", "Nicht erlaubt"),
        };
        file_reply(&target, wanted, &scope)
    }
}

/// Ob am geprüften Ort noch dieselbe Datei liegt. `path` ist kanonisch: eine später dorthin gelegte
/// Verknüpfung führte sonst zu einem Ziel, das nie geprüft wurde.
fn is_still_in_place(path: &Path) -> bool {
    path.is_file() && fs::canonicalize(path).is_ok_and(|real| real == path)
}

/// Die Antwort für eine geprüfte Datei: mit `?view=1` ihre Betrachter-Seite, sonst die Datei selbst.
fn file_reply(target: &Path, wanted: &Wanted, scope: &str) -> Reply {
    if wanted.viewer {
        // Nur der Name des geprüften Ziels geht in die Seite, nie der Anfragetext.
        let name = target
            .file_name()
            .map(|name| name.to_string_lossy().into_owned())
            .unwrap_or_default();
        return match viewers::render(kind_of(target), &name) {
            Some(page) => page_reply(HTML, with_bridge(page.into_bytes()), scope),
            None => not_found(),
        };
    }
    let Ok(body) = fs::read(target) else {
        return not_found();
    };
    let content_type = content_type(target);
    // HTML bekommt die Brücke angehängt: Spannen der Datei passten dann nicht mehr.
    if content_type == HTML {
        return page_reply(content_type, with_bridge(body), scope);
    }
    raw_reply(content_type, body, wanted.range, scope)
}

/// Eine vollständige Antwort unter der CSP des Bereichs `scope`.
fn page_reply(content_type: &'static str, body: Vec<u8>, scope: &str) -> Reply {
    Reply {
        status: 200,
        reason: "OK",
        content_type,
        body,
        csp: Some(artifact_csp(scope)),
        cross_origin: false,
        accepts_ranges: false,
        content_range: None,
    }
}

/// Eine Rohdatei, auf Wunsch nur eine Spanne daraus: ohne `206` spult `<video>` nicht.
fn raw_reply(
    content_type: &'static str,
    mut body: Vec<u8>,
    range: Option<&str>,
    scope: &str,
) -> Reply {
    let size = body.len() as u64;
    let span = range.map_or(Ok(None), |header: &str| byte_range(header, size));
    let mut reply = page_reply(content_type, Vec::new(), scope);
    reply.accepts_ranges = true;
    match span {
        Ok(None) => reply.body = body,
        Ok(Some((first, last))) => {
            // Beide liegen unter `size`, also unter der Länge von `body`.
            body.truncate(last as usize + 1);
            body.drain(..first as usize);
            reply.status = 206;
            reply.reason = "Partial Content";
            reply.body = body;
            reply.content_range = Some(format!("bytes {first}-{last}/{size}"));
        }
        Err(()) => {
            reply.status = 416;
            reply.reason = "Range Not Satisfiable";
            reply.content_type = TEXT_PLAIN;
            reply.content_range = Some(format!("bytes */{size}"));
        }
    }
    reply
}

/// Erstes und letztes Byte (beide eingeschlossen), die `Range` von einer Datei der Größe `size`
/// verlangt. `Ok(None)`: andere Einheit oder mehrere Spannen, dann geht die ganze Datei hinaus
/// (RFC 9110 erlaubt das). `Err`: die eine Spanne ist unlesbar oder liegt außerhalb der Datei.
fn byte_range(header: &str, size: u64) -> Result<Option<(u64, u64)>, ()> {
    let Some(span) = header.strip_prefix("bytes=") else {
        return Ok(None);
    };
    if span.contains(',') {
        return Ok(None);
    }
    let (first_text, last_text) = span.split_once('-').ok_or(())?;
    let end = size.checked_sub(1).ok_or(())?;
    // `-<n>`: die letzten n Bytes.
    if first_text.is_empty() {
        let length = range_number(last_text)?;
        if length == 0 {
            return Err(());
        }
        return Ok(Some((size.saturating_sub(length), end)));
    }
    let first = range_number(first_text)?;
    let last = if last_text.is_empty() {
        end
    } else {
        let requested = range_number(last_text)?;
        requested.min(end)
    };
    if first > last {
        return Err(());
    }
    Ok(Some((first, last)))
}

/// Nur Ziffern: `parse` allein nähme auch ein `+` an.
fn range_number(text: &str) -> Result<u64, ()> {
    if !text.bytes().all(|byte: u8| byte.is_ascii_digit()) {
        return Err(());
    }
    text.parse().map_err(|_| ())
}

/// Der Wert der Kopfzeile `name` (Groß-/Kleinschreibung egal) aus dem Anfragekopf.
fn header_value<'a>(head: &'a str, name: &str) -> Option<&'a str> {
    head.split("\r\n")
        .skip(1)
        .filter_map(|line: &str| line.split_once(':'))
        .find(|(header, _): &(&str, &str)| header.trim().eq_ignore_ascii_case(name))
        .map(|(_, value): (&str, &str)| value.trim())
}

/// Hängt die passive Kommentar-Brücke an HTML an und setzt den Speicher-Ersatz vor die Skripte der
/// Seite, ohne Binärdaten oder ungültiges UTF-8 anzutasten.
fn with_bridge(body: Vec<u8>) -> Vec<u8> {
    let html = match String::from_utf8(body) {
        Ok(html) => with_storage_shim(html),
        Err(error) => return error.into_bytes(),
    };
    let bridge = format!("<script>{BRIDGE_SCRIPT}</script>");
    let lower = html.to_ascii_lowercase();
    if let Some(index) = lower.rfind("</body>") {
        let mut result = String::with_capacity(html.len() + bridge.len());
        result.push_str(&html[..index]);
        result.push_str(&bridge);
        result.push_str(&html[index..]);
        result.into_bytes()
    } else {
        let mut result = html;
        result.push_str(&bridge);
        result.into_bytes()
    }
}

/// Setzt den Speicher-Ersatz direkt hinter `<head>`, ohne `<head>` vor das erste `<script>`; eine Seite
/// ohne beides bleibt unverändert (ein Skript vor `<!doctype>` schaltete sie in den Quirks-Modus).
fn with_storage_shim(html: String) -> String {
    let lower = html.to_ascii_lowercase();
    let after_head = lower.match_indices("<head").find_map(|(start, _)| {
        let rest = &lower[start + "<head".len()..];
        let next = rest.chars().next()?;
        if next != '>' && !next.is_ascii_whitespace() {
            return None;
        }
        rest.find('>').map(|end| start + "<head".len() + end + 1)
    });
    let Some(index) = after_head.or_else(|| lower.find("<script")) else {
        return html;
    };
    let shim = format!("<script>{STORAGE_SHIM_SCRIPT}</script>");
    let mut result = String::with_capacity(html.len() + shim.len());
    result.push_str(&html[..index]);
    result.push_str(&shim);
    result.push_str(&html[index..]);
    result
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
    if reply.cross_origin {
        head.push_str("Access-Control-Allow-Origin: *\r\n");
    }
    if let Some(csp) = &reply.csp {
        head.push_str(&format!("Content-Security-Policy: {csp}\r\n"));
    }
    if reply.accepts_ranges {
        head.push_str("Accept-Ranges: bytes\r\n");
    }
    if let Some(content_range) = &reply.content_range {
        head.push_str(&format!("Content-Range: {content_range}\r\n"));
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
        cross_origin: false,
        accepts_ranges: false,
        content_range: None,
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
        "html" | "htm" => HTML,
        "css" => "text/css; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "json" | "map" => JSON,
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "avif" => "image/avif",
        "ico" => "image/x-icon",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        "ttf" => "font/ttf",
        "otf" => "font/otf",
        "md" | "markdown" => "text/markdown; charset=utf-8",
        "csv" => "text/csv; charset=utf-8",
        "yaml" | "yml" => "text/yaml; charset=utf-8",
        "txt" => TEXT_PLAIN,
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "ogg" => "audio/ogg",
        "m4a" => "audio/mp4",
        "pdf" => "application/pdf",
        _ => "application/octet-stream",
    }
}

#[cfg(test)]
mod tests {
    use super::with_bridge;

    fn served(html: &str) -> String {
        String::from_utf8(with_bridge(html.as_bytes().to_vec())).expect("UTF-8")
    }

    #[test]
    fn storage_shim_runs_before_page_scripts() {
        let page = served(
            "<!doctype html><html><head><title>x</title><script>localStorage.getItem('a')</script></head><body><header>h</header></body></html>",
        );
        let shim = page.find("memoryStorage").expect("Ersatz fehlt");
        assert!(page.starts_with("<!doctype html><html><head><script>"));
        assert!(
            shim < page
                .find("localStorage.getItem('a')")
                .expect("Seitenskript fehlt")
        );
        assert!(
            page.find("verwalter: 1").expect("Brücke fehlt")
                < page.find("</body>").expect("body fehlt")
        );
    }

    #[test]
    fn storage_shim_skips_header_and_falls_back_to_first_script() {
        let page = served("<header>h</header><script>run()</script>");
        assert!(page.starts_with("<header>h</header><script>"));
        assert!(
            page.find("memoryStorage").expect("Ersatz fehlt")
                < page.find("run()").expect("Seitenskript fehlt")
        );
    }

    #[test]
    fn page_without_head_and_script_gets_no_shim() {
        assert!(!served("<!doctype html><p>nur Text</p>").contains("memoryStorage"));
    }
}
