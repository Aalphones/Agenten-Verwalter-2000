//! Aufbau der Bibliothek: welcher Teil eines Ordners eingelesen wird, welche Art ein Artefakt nach
//! seinem Ort bekommt und in welche Gruppe ein Treffer fällt (Plan Bibliothek, ADR 069).
//!
//! Stand nach der Test-Station: nur die Signaturen aus dem Kontrakt, die Umsetzung folgt.

use std::collections::HashSet;
use std::path::Path;

use serde::Serialize;
use ts_rs::TS;

use crate::vault::meta::Meta;

/// Unterordner der Bibliothek, in dem das Wissen liegt.
pub const KNOWLEDGE_DIR: &str = "_vault";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum VaultLayout {
    Library,
    Plain,
}

pub struct Place {
    pub group: &'static str,
    pub subgroup: String,
}

/// Library, wenn der Ordner `skills`, `commands`, `output-styles` oder `CLAUDE.md` enthält.
pub fn layout(_root: &Path) -> VaultLayout {
    unimplemented!("Phase 1 Umsetzung")
}

pub fn layout_name(_layout: VaultLayout) -> &'static str {
    unimplemented!("Phase 1 Umsetzung")
}

pub fn layout_from_name(_name: &str) -> VaultLayout {
    unimplemented!("Phase 1 Umsetzung")
}

/// Ob ein Eintrag der ersten Ebene eingelesen wird.
pub fn is_included_top(_layout: VaultLayout, _name: &str, _is_dir: bool) -> bool {
    unimplemented!("Phase 1 Umsetzung")
}

/// Library: `skills/<name>`, wenn `skills/<name>/SKILL.md` unter den Dateien ist.
pub fn skill_folders(_layout: VaultLayout, _files: &[&str]) -> HashSet<String> {
    unimplemented!("Phase 1 Umsetzung")
}

/// Überschreibt Art, Titel und Einstieg nach dem Ort (nur Library), nach `extract`.
pub fn apply_place(_layout: VaultLayout, _artifact: &str, _meta: &mut Meta) {
    unimplemented!("Phase 1 Umsetzung")
}

pub fn place(_layout: VaultLayout, _path: &str) -> Place {
    unimplemented!("Phase 1 Umsetzung")
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    use super::*;

    use VaultLayout::{Library, Plain};

    /// Ordner unter `temp_dir()`, der beim Verlassen des Tests wieder gelöscht wird.
    struct TempDir(PathBuf);

    impl TempDir {
        fn new(label: &str) -> Self {
            let nanos = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|elapsed| elapsed.as_nanos())
                .unwrap_or_default();
            let path = std::env::temp_dir().join(format!(
                "verwalter-library-test-{label}-{}-{nanos}",
                std::process::id()
            ));
            fs::create_dir_all(&path).expect("Testordner anlegen");
            Self(path)
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn sample_meta() -> Meta {
        Meta {
            title: Some("Aus der Datei".to_owned()),
            description: Some("Beschreibung".to_owned()),
            kind: Some("note".to_owned()),
            status: None,
            preview: None,
            entrypoint: None,
            tags: vec!["tag".to_owned()],
        }
    }

    fn placed(layout: VaultLayout, artifact: &str) -> Meta {
        let mut meta = sample_meta();
        apply_place(layout, artifact, &mut meta);
        meta
    }

    fn group_of(layout: VaultLayout, path: &str) -> (&'static str, String) {
        let found = place(layout, path);
        (found.group, found.subgroup)
    }

    // --- layout ---

    #[test]
    fn layout_is_library_for_folder_with_skills() {
        let dir = TempDir::new("skills");
        fs::create_dir_all(dir.0.join("skills")).expect("skills anlegen");
        assert_eq!(layout(&dir.0), Library);
    }

    #[test]
    fn layout_is_library_for_folder_with_claude_md() {
        let dir = TempDir::new("rules");
        fs::write(dir.0.join("CLAUDE.md"), "# Regeln\n").expect("CLAUDE.md anlegen");
        assert_eq!(layout(&dir.0), Library);
    }

    #[test]
    fn layout_is_plain_for_folder_without_skills() {
        let dir = TempDir::new("plain");
        fs::create_dir_all(dir.0.join("rezepte")).expect("rezepte anlegen");
        fs::write(dir.0.join("README.md"), "# Vault\n").expect("README anlegen");
        assert_eq!(layout(&dir.0), Plain);
    }

    #[test]
    fn layout_name_round_trips_and_unknown_is_plain() {
        assert_eq!(layout_name(Library), "library");
        assert_eq!(layout_name(Plain), "plain");
        assert_eq!(layout_from_name("library"), Library);
        assert_eq!(layout_from_name("plain"), Plain);
        assert_eq!(layout_from_name("irgendwas"), Plain);
        assert_eq!(layout_from_name(""), Plain);
    }

    // --- is_included_top ---

    #[test]
    fn plain_includes_every_top_entry() {
        for (name, is_dir) in [
            ("memory", true),
            ("hooks", true),
            ("rezepte", true),
            ("settings.json", false),
            ("README.md", false),
        ] {
            assert!(is_included_top(Plain, name, is_dir), "{name}");
        }
    }

    #[test]
    fn library_includes_allowlisted_folders() {
        for name in ["skills", "commands", "output-styles", "_vault"] {
            assert!(is_included_top(Library, name, true), "{name}");
        }
    }

    #[test]
    fn library_includes_allowlisted_files() {
        for name in ["CLAUDE.md", "AGENTS.md"] {
            assert!(is_included_top(Library, name, false), "{name}");
        }
    }

    #[test]
    fn library_allowlist_ignores_case() {
        assert!(is_included_top(Library, "Skills", true));
        assert!(is_included_top(Library, "OUTPUT-STYLES", true));
        assert!(is_included_top(Library, "_Vault", true));
        assert!(is_included_top(Library, "claude.md", false));
        assert!(is_included_top(Library, "Agents.md", false));
    }

    #[test]
    fn library_excludes_folders_outside_allowlist() {
        for name in [
            "memory",
            "hooks",
            "codex",
            "continue",
            "references",
            "_stylePakete",
            ".claude",
            "knowledge",
        ] {
            assert!(!is_included_top(Library, name, true), "{name}");
        }
    }

    #[test]
    fn library_excludes_files_outside_allowlist() {
        for name in [
            "settings.json",
            "improvement-log.md",
            "skill-evolution-log.md",
            "setup.cmd",
            "SETUP.md",
            "MIGRATION.md",
            "merge-hooks.cjs",
            ".gitignore",
            ".gitattributes",
            "README.md",
        ] {
            assert!(!is_included_top(Library, name, false), "{name}");
        }
    }

    #[test]
    fn library_matches_folders_only_as_folders_and_files_only_as_files() {
        assert!(!is_included_top(Library, "skills", false));
        assert!(!is_included_top(Library, "_vault", false));
        assert!(!is_included_top(Library, "CLAUDE.md", true));
        assert!(!is_included_top(Library, "AGENTS.md", true));
    }

    // --- skill_folders ---

    #[test]
    fn library_skill_folders_are_folders_with_skill_md() {
        let files = [
            "skills/mode-planning/SKILL.md",
            "skills/mode-planning/WORK.md",
            "skills/lang-go/skill.md",
            "skills/ohne-manifest/README.md",
            "skills/tief/unter/SKILL.md",
            "skills/SKILL.md",
            "commands/plan.md",
            "_vault/rezepte/SKILL.md",
        ];
        let expected: HashSet<String> = ["skills/mode-planning", "skills/lang-go"]
            .into_iter()
            .map(str::to_owned)
            .collect();
        assert_eq!(skill_folders(Library, &files), expected);
    }

    #[test]
    fn plain_has_no_skill_folders() {
        let files = ["skills/mode-planning/SKILL.md", "skills/lang-go/SKILL.md"];
        assert!(skill_folders(Plain, &files).is_empty());
    }

    // --- apply_place ---

    #[test]
    fn apply_place_marks_root_rules() {
        for artifact in ["CLAUDE.md", "AGENTS.md"] {
            let mut expected = sample_meta();
            expected.kind = Some("rules".to_owned());
            assert_eq!(placed(Library, artifact), expected, "{artifact}");
        }
    }

    #[test]
    fn apply_place_marks_direct_output_styles() {
        let mut expected = sample_meta();
        expected.kind = Some("style".to_owned());
        assert_eq!(placed(Library, "output-styles/vera.md"), expected);
    }

    #[test]
    fn apply_place_marks_direct_commands_with_slash_title() {
        let mut expected = sample_meta();
        expected.kind = Some("command".to_owned());
        expected.title = Some("/plan".to_owned());
        assert_eq!(placed(Library, "commands/plan.md"), expected);
    }

    #[test]
    fn apply_place_accepts_md_extension_in_any_case() {
        let mut expected = sample_meta();
        expected.kind = Some("command".to_owned());
        expected.title = Some("/review".to_owned());
        assert_eq!(placed(Library, "commands/review.MD"), expected);

        let mut style = sample_meta();
        style.kind = Some("style".to_owned());
        assert_eq!(placed(Library, "output-styles/station.Md"), style);
    }

    #[test]
    fn apply_place_marks_skill_folders() {
        let mut expected = sample_meta();
        expected.kind = Some("skill".to_owned());
        expected.title = Some("mode-planning".to_owned());
        expected.entrypoint = Some("skills/mode-planning/SKILL.md".to_owned());
        assert_eq!(placed(Library, "skills/mode-planning"), expected);
    }

    #[test]
    fn apply_place_leaves_everything_else_unchanged() {
        for artifact in [
            "_vault/README.md",
            "_vault/rezepte/hooks.md",
            "_vault/CLAUDE.md",
            "commands/sub/plan.md",
            "commands/plan.txt",
            "output-styles/sub/vera.md",
            "output-styles/vera.json",
        ] {
            assert_eq!(placed(Library, artifact), sample_meta(), "{artifact}");
        }
    }

    #[test]
    fn apply_place_does_nothing_in_plain_vault() {
        for artifact in [
            "CLAUDE.md",
            "AGENTS.md",
            "output-styles/vera.md",
            "commands/plan.md",
            "skills/mode-planning",
            "rezepte/hooks.md",
        ] {
            assert_eq!(placed(Plain, artifact), sample_meta(), "{artifact}");
        }
    }

    // --- place ---

    #[test]
    fn place_puts_root_rules_under_grundregeln() {
        for path in ["CLAUDE.md", "AGENTS.md"] {
            assert_eq!(
                group_of(Library, path),
                ("anweisungen", "grundregeln".to_owned()),
                "{path}"
            );
        }
    }

    #[test]
    fn place_puts_output_styles_under_ausgabestile() {
        assert_eq!(
            group_of(Library, "output-styles/vera.md"),
            ("anweisungen", "ausgabestile".to_owned())
        );
    }

    #[test]
    fn place_sorts_skills_by_prefix() {
        let cases = [
            ("skills/mode-planning", "arbeitsweise"),
            ("skills/mode-planning/WORK.md", "arbeitsweise"),
            ("skills/lang-go", "sprachen"),
            ("skills/framework-tailwind", "frameworks"),
            ("skills/research", "werkzeuge"),
            ("skills/code-health/SKILL.md", "werkzeuge"),
        ];
        for (path, subgroup) in cases {
            assert_eq!(
                group_of(Library, path),
                ("skills", subgroup.to_owned()),
                "{path}"
            );
        }
    }

    #[test]
    fn place_puts_commands_under_skills_befehle() {
        assert_eq!(
            group_of(Library, "commands/plan.md"),
            ("skills", "befehle".to_owned())
        );
    }

    #[test]
    fn place_puts_knowledge_folder_as_subgroup() {
        assert_eq!(
            group_of(Library, "_vault/inbox/idee.md"),
            ("wissen", "inbox".to_owned())
        );
        assert_eq!(
            group_of(Library, "_vault/rezepte/tief/unter/x.md"),
            ("wissen", "rezepte".to_owned())
        );
    }

    #[test]
    fn place_puts_knowledge_root_file_in_main_folder() {
        assert_eq!(
            group_of(Library, "_vault/README.md"),
            ("wissen", String::new())
        );
    }

    #[test]
    fn place_in_plain_vault_is_always_wissen_by_first_folder() {
        let cases = [
            ("rezepte/hooks.md", "rezepte"),
            ("inbox/idee.md", "inbox"),
            ("skills/mode-planning/SKILL.md", "skills"),
            ("README.md", ""),
            ("CLAUDE.md", ""),
        ];
        for (path, subgroup) in cases {
            assert_eq!(
                group_of(Plain, path),
                ("wissen", subgroup.to_owned()),
                "{path}"
            );
        }
    }
}
