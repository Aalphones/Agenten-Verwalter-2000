//! Hintergrund einer Session: Befehle, Hintergrundprozesse und Subagenten des Agenten sowie sein
//! Scratchpad-Ordner. Die Einträge entstehen aus den Ereignissen der Kommandozeile
//! (`sessions::registry`), nie aus dem Text des Agenten.
pub mod model;
pub mod output;
pub mod scratchpad;
