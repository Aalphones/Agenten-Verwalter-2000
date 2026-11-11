//! Weiter nach dem Kontingent-Limit (ADR 063): erkennt den Limit-Stopp einer Antwort; das Warten
//! und Weiterschicken für Stationen folgt.

#[cfg(test)]
mod tests;

/// Eine Antwort endete am Kontingent-Limit.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct LimitStop {
    /// Unix-Sekunden aus dem `rejected`-Kontingent-Ereignis der Antwort; `None`, wenn keins kam.
    pub reset_at: Option<i64>,
}

/// Wahr, wenn die Antwort am Kontingent-Limit endete: entweder kam in ihr ein
/// `rate_limit_event` mit Status `rejected`, oder der Fehlertext der Kommandozeile nennt das Limit.
/// Der Text ist der Rückfall, weil die Reihenfolge von Ereignis und `result`-Zeile nicht belegt ist.
pub fn is_limit_stop(text: &str, rejected_reset_at: Option<i64>) -> bool {
    if rejected_reset_at.is_some() {
        return true;
    }
    let lower = text.to_lowercase();
    (lower.contains("hit your") && lower.contains("limit")) || lower.contains("usage limit reached")
}
