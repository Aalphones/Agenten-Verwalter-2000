//! Aufrufe je Skill, gezählt aus den Benutzer-Einträgen von `chat_entries` (ADR 039).
use rusqlite::{Connection, params};

use crate::error::CommandError;
use crate::skills::model::SkillUse;

/// Zählt die Aufrufe seit `since_ms` je Schlüssel; Skills ohne Aufruf fehlen.
pub fn count_since(connection: &Connection, since_ms: f64) -> Result<Vec<SkillUse>, CommandError> {
    let mut statement = connection.prepare(
        "SELECT json_extract(payload, '$.skill.origin.kind') AS origin,
                json_extract(payload, '$.skill.origin.name') AS repository,
                json_extract(payload, '$.skill.name') AS name,
                COUNT(*)
         FROM chat_entries
         WHERE json_extract(payload, '$.kind') = 'user'
           AND json_extract(payload, '$.skill.name') IS NOT NULL
           AND json_extract(payload, '$.sentAt') >= ?1
         GROUP BY origin, repository, name",
    )?;
    let rows = statement.query_map(params![since_ms], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, Option<String>>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, u32>(3)?,
        ))
    })?;
    let mut uses: Vec<SkillUse> = Vec::new();
    for row in rows {
        let (origin, repository, name, count) = row?;
        uses.push(SkillUse {
            key: use_key(&origin, repository.as_deref(), &name),
            count,
        });
    }
    Ok(uses)
}

/// Dieselbe Bildung wie `skillUseKey` in `src/features/skills/skillUses.ts`.
fn use_key(origin: &str, repository: Option<&str>, name: &str) -> String {
    match (origin, repository) {
        ("repository", Some(repository)) => format!("repository:{repository}:{name}"),
        _ => format!("{origin}:{name}"),
    }
}
