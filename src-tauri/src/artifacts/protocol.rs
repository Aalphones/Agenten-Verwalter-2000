//! Protokoll `artefakt`: liefert Dateien aus dem Ordner `.artefakte` eines Vorhabens an den
//! abgeschotteten Rahmen der Vorschau (ADR 026). Unter Windows erreichbar als
//! `http://artefakt.localhost/<session-id>/<pfad>`. Jede Antwort trägt eine eigene CSP: die Seite
//! darf ins Internet über https, aber nie an die Schnittstelle des Verwalters.
use std::fs;
use std::path::Path;
use std::thread;

use tauri::http::header::{
    ACCESS_CONTROL_ALLOW_ORIGIN, CACHE_CONTROL, CONTENT_SECURITY_POLICY, CONTENT_TYPE,
};
use tauri::http::{HeaderValue, Method, Request, Response, StatusCode};
use tauri::{Manager, UriSchemeContext, UriSchemeResponder, Wry};

use super::resolve;
use crate::error::CommandError;
use crate::sessions::registry::SessionRegistry;

pub const ARTIFACT_CSP: &str = "default-src 'self' http://artefakt.localhost https: data: blob: 'unsafe-inline' 'unsafe-eval'; connect-src 'self' http://artefakt.localhost https:; form-action 'none'; base-uri 'self'";

const TEXT_PLAIN: &str = "text/plain; charset=utf-8";
const NOT_FOUND_TEXT: &str = "Nicht gefunden";
const FORBIDDEN_TEXT: &str = "Nicht erlaubt";
const METHOD_TEXT: &str = "Nur GET";

/// Arbeitet in einem eigenen Thread: Dateizugriffe gehören nicht auf den Thread des WebViews.
pub fn handle(
    ctx: UriSchemeContext<'_, Wry>,
    request: Request<Vec<u8>>,
    responder: UriSchemeResponder,
) {
    let app = ctx.app_handle().clone();
    thread::spawn(move || {
        // `try_state`: eine Anfrage vor dem Ende von `setup` fände die Registry noch nicht vor.
        let response = match app.try_state::<SessionRegistry>() {
            Some(registry) => answer(&registry, &request),
            None => not_found(),
        };
        responder.respond(response);
    });
}

fn answer(registry: &SessionRegistry, request: &Request<Vec<u8>>) -> Response<Vec<u8>> {
    if request.method() != Method::GET {
        return text_response(StatusCode::METHOD_NOT_ALLOWED, METHOD_TEXT);
    }
    let path = request.uri().path();
    let path = path.strip_prefix('/').unwrap_or(path);
    let Some((session_part, rest_part)) = path.split_once('/') else {
        return not_found();
    };
    let (Some(session_id), Some(rest)) = (percent_decode(session_part), percent_decode(rest_part))
    else {
        return not_found();
    };
    let Ok(dir) = registry.artifacts_dir(&session_id) else {
        return not_found();
    };
    let target = match resolve(&dir, &rest.replace('/', "\\")) {
        Ok(target) => target,
        Err(CommandError::FileNotFound(_)) => return not_found(),
        Err(_) => return text_response(StatusCode::FORBIDDEN, FORBIDDEN_TEXT),
    };
    let Ok(body) = fs::read(&target) else {
        return not_found();
    };
    let mut response = Response::new(body);
    let headers = response.headers_mut();
    headers.insert(
        CONTENT_TYPE,
        HeaderValue::from_static(content_type(&target)),
    );
    headers.insert(CACHE_CONTROL, HeaderValue::from_static("no-store"));
    headers.insert(ACCESS_CONTROL_ALLOW_ORIGIN, HeaderValue::from_static("*"));
    headers.insert(
        CONTENT_SECURITY_POLICY,
        HeaderValue::from_static(ARTIFACT_CSP),
    );
    response
}

fn not_found() -> Response<Vec<u8>> {
    text_response(StatusCode::NOT_FOUND, NOT_FOUND_TEXT)
}

fn text_response(status: StatusCode, text: &str) -> Response<Vec<u8>> {
    let mut response = Response::new(text.as_bytes().to_vec());
    *response.status_mut() = status;
    response
        .headers_mut()
        .insert(CONTENT_TYPE, HeaderValue::from_static(TEXT_PLAIN));
    response
}

/// `%` + zwei Hex-Ziffern → Byte, alles andere bleibt; ein unvollständiges `%` oder kein UTF-8 →
/// `None`. Eigene Funktion, damit das Protokoll keine neue Abhängigkeit braucht.
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
