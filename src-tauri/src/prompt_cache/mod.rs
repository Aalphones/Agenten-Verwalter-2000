//! Zustand des Prompt-Caches einer Session (ADR 033).
pub mod model;

/// Haltedauer des Caches, wenn die Antwort nur 5-Minuten-Einträge geschrieben hat.
pub const TTL_5M_MS: u32 = 300_000;
/// Haltedauer des Caches, wenn die Antwort 1-Stunden-Einträge geschrieben hat (gemessen, ADR 033).
pub const TTL_1H_MS: u32 = 3_600_000;
