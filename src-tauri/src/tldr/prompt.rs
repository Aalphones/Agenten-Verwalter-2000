//! Anweisungen und Antwort-Schemas für den Einmal-Aufruf von Haiku.
use std::time::Duration;

/// Längste gemessene Dauer (30 s) × 3; auch ein Transkript an der Obergrenze brauchte nur 17 s
/// (docs/knowledge/claude-stream-json.md, „Einmal-Aufruf im Druckmodus“).
pub const TLDR_TIMEOUT: Duration = Duration::from_secs(90);

pub const SESSION_SYSTEM_PROMPT: &str = "Du fasst den Verlauf einer Arbeitssitzung zwischen einem Entwickler (Nutzer) und einem Coding-Agenten (Claude) zusammen. Antworte auf Deutsch, knapp und sachlich, ohne Einleitung. short: ein Satz, höchstens 160 Zeichen, was die Session tut oder getan hat. goal: worum es geht, ein Satz. done: was erledigt ist, höchstens zwei Sätze. ongoing: woran zuletzt gearbeitet wurde und was noch läuft; leer, wenn nichts läuft. open: was offen ist; beginnt mit „Deine Entscheidung:“, wenn der Agent auf eine Entscheidung oder Antwort des Nutzers wartet; leer, wenn nichts offen ist. openNeedsUser: true genau dann, wenn open eine Entscheidung oder Antwort des Nutzers verlangt. Erfinde nichts, was nicht im Verlauf steht.";

pub const SESSION_SCHEMA: &str = r#"{"type":"object","properties":{"short":{"type":"string"},"goal":{"type":"string"},"done":{"type":"string"},"ongoing":{"type":"string"},"open":{"type":"string"},"openNeedsUser":{"type":"boolean"}},"required":["short","goal","done","ongoing","open","openNeedsUser"],"additionalProperties":false}"#;

pub const PROJECT_SYSTEM_PROMPT: &str = "Du fasst ein Vorhaben zusammen, das aus mehreren nacheinander gelaufenen Arbeitssitzungen (Sessions) eines Entwicklers mit einem Coding-Agenten besteht. Du bekommst je Session ihre Nummer, ihren Namen, ihren Status und ihre Kurzfassung. Antworte auf Deutsch, knapp und sachlich, ohne Einleitung. summary: zwei Sätze, worum es geht und wo es steht. status: der Stand in einem Satz; nenne Sessions als #Nummer. open: das Wichtigste, was offen ist, mit #Nummer; leer, wenn nichts offen ist. next: der nächste sinnvolle Schritt in einem Satz; leer, wenn unklar. openNeedsUser: true genau dann, wenn open eine Entscheidung des Nutzers verlangt. Erfinde nichts.";

pub const PROJECT_SCHEMA: &str = r#"{"type":"object","properties":{"summary":{"type":"string"},"status":{"type":"string"},"open":{"type":"string"},"next":{"type":"string"},"openNeedsUser":{"type":"boolean"}},"required":["summary","status","open","next","openNeedsUser"],"additionalProperties":false}"#;
