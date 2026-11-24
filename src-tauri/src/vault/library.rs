//! Aufbau der Bibliothek: welcher Teil eines Ordners eingelesen wird, welche Art ein Artefakt nach
//! seinem Ort bekommt und in welche Gruppe ein Treffer fällt (Plan Bibliothek, ADR 069).
//!
//! Eine Bibliothek ist ein Ordner mit Skills, Befehlen, Ausgabestilen oder `CLAUDE.md`; von ihr
//! wird nur eine feste Erlaubnisliste gelesen (aus `memory/` nur die Dateien direkt darin), damit
//! `memory/_archiv/`, Hooks, Logs und Einstellungen nie in den Index und über `vault_get` zu den
//! Agenten kommen. Jeder andere Ordner ist ein reiner Vault und wird ganz gelesen.

use std::collections::HashSet;
use std::path::Path;

use serde::Serialize;
use ts_rs::TS;

use crate::vault::meta::Meta;

/// Unterordner der Bibliothek, in dem das Wissen liegt.
pub const KNOWLEDGE_DIR: &str = "_vault";

const SKILLS_DIR: &str = "skills";
const COMMANDS_DIR: &str = "commands";
const OUTPUT_STYLES_DIR: &str = "output-styles";
const MEMORY_DIR: &str = "memory";
const SKILL_FILE: &str = "SKILL.md";
const MARKDOWN_EXTENSION: &str = ".md";
const ROOT_RULES_FILES: [&str; 2] = ["CLAUDE.md", "AGENTS.md"];

/// Ordner der ersten Ebene, die in einer Bibliothek gelesen werden.
const LIBRARY_DIRS: [&str; 5] = [
    SKILLS_DIR,
    COMMANDS_DIR,
    OUTPUT_STYLES_DIR,
    MEMORY_DIR,
    KNOWLEDGE_DIR,
];
/// Dateien der ersten Ebene, die in einer Bibliothek gelesen werden.
const LIBRARY_FILES: [&str; 2] = ROOT_RULES_FILES;

const LAYOUT_LIBRARY: &str = "library";
const LAYOUT_PLAIN: &str = "plain";

const KIND_RULES: &str = "rules";
const KIND_STYLE: &str = "style";
const KIND_COMMAND: &str = "command";
const KIND_SKILL: &str = "skill";
const KIND_MEMORY: &str = "memory";

const GROUP_INSTRUCTIONS: &str = "anweisungen";
const GROUP_SKILLS: &str = "skills";
const GROUP_KNOWLEDGE: &str = "wissen";
const SUBGROUP_RULES: &str = "grundregeln";
const SUBGROUP_STYLES: &str = "ausgabestile";
const SUBGROUP_MEMORY: &str = "gedaechtnis";
const SUBGROUP_COMMANDS: &str = "befehle";
const SUBGROUP_TOOLS: &str = "werkzeuge";
/// Präfix des Skill-Namens → Untergruppe; was keins trägt, landet unter Werkzeuge.
const SKILL_PREFIXES: [(&str, &str); 3] = [
    ("mode-", "arbeitsweise"),
    ("lang-", "sprachen"),
    ("framework-", "frameworks"),
];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum VaultLayout {
    Library,
    Plain,
}

/// Gruppe und Untergruppe eines Treffers (Ids; die Labels kennt nur die Oberfläche).
pub struct Place {
    pub group: &'static str,
    pub subgroup: String,
}

/// Library, wenn der Ordner `skills`, `commands`, `output-styles` oder `CLAUDE.md` enthält —
/// dieselbe Prüfung wie beim Abgleich mit `~\.claude`.
pub fn layout(root: &Path) -> VaultLayout {
    if crate::environment::mirror::has_mirrorable(root) {
        VaultLayout::Library
    } else {
        VaultLayout::Plain
    }
}

pub fn layout_name(layout: VaultLayout) -> &'static str {
    match layout {
        VaultLayout::Library => LAYOUT_LIBRARY,
        VaultLayout::Plain => LAYOUT_PLAIN,
    }
}

/// Ein unbekannter Name gilt als reiner Vault: der liest mehr, verschweigt also nichts.
pub fn layout_from_name(name: &str) -> VaultLayout {
    if name == LAYOUT_LIBRARY {
        VaultLayout::Library
    } else {
        VaultLayout::Plain
    }
}

/// Ob ein Eintrag der ersten Ebene eingelesen wird. Plain: immer. Library: nur die Ordner und
/// Dateien der Erlaubnisliste, ohne Beachtung der Schreibweise.
pub fn is_included_top(layout: VaultLayout, name: &str, is_dir: bool) -> bool {
    if layout == VaultLayout::Plain {
        return true;
    }
    let allowed: &[&str] = if is_dir {
        &LIBRARY_DIRS
    } else {
        &LIBRARY_FILES
    };
    allowed
        .iter()
        .any(|candidate: &&str| candidate.eq_ignore_ascii_case(name))
}

/// Library: Unterordner von `memory` (z. B. `memory/_archiv`) werden nicht betreten — aus
/// `memory` zählen nur die Dateien direkt darin. Plain: immer `true`.
pub fn is_included_below(layout: VaultLayout, parent_top: &str, is_dir: bool) -> bool {
    !(layout == VaultLayout::Library && is_dir && parent_top.eq_ignore_ascii_case(MEMORY_DIR))
}

/// Library: `skills/<name>`, wenn `skills/<name>/SKILL.md` unter den Dateien ist.
pub fn skill_folders(layout: VaultLayout, files: &[&str]) -> HashSet<String> {
    if layout == VaultLayout::Plain {
        return HashSet::new();
    }
    files
        .iter()
        .filter_map(|path: &&str| {
            let parts: Vec<&str> = path.split('/').collect();
            match parts.as_slice() {
                [top, name, file]
                    if top.eq_ignore_ascii_case(SKILLS_DIR)
                        && file.eq_ignore_ascii_case(SKILL_FILE) =>
                {
                    Some(format!("{top}/{name}"))
                }
                _ => None,
            }
        })
        .collect()
}

/// Überschreibt Art, Titel und Einstieg nach dem Ort (nur Library), nach `extract`.
pub fn apply_place(layout: VaultLayout, artifact: &str, meta: &mut Meta) {
    if layout == VaultLayout::Plain {
        return;
    }
    let parts: Vec<&str> = artifact.split('/').collect();
    match parts.as_slice() {
        [file] if is_root_rules(file) => {
            meta.kind = Some(KIND_RULES.to_owned());
        }
        [top, file] if top.eq_ignore_ascii_case(OUTPUT_STYLES_DIR) && is_markdown(file) => {
            meta.kind = Some(KIND_STYLE.to_owned());
        }
        [top, file] if top.eq_ignore_ascii_case(COMMANDS_DIR) && is_markdown(file) => {
            let name: &str = &file[..file.len() - MARKDOWN_EXTENSION.len()];
            meta.kind = Some(KIND_COMMAND.to_owned());
            meta.title = Some(format!("/{name}"));
        }
        [top, file] if top.eq_ignore_ascii_case(MEMORY_DIR) && is_markdown(file) => {
            meta.kind = Some(KIND_MEMORY.to_owned());
        }
        [top, name] if top.eq_ignore_ascii_case(SKILLS_DIR) && is_folder_name(name) => {
            meta.kind = Some(KIND_SKILL.to_owned());
            meta.title = Some((*name).to_owned());
            meta.entrypoint = Some(format!("{artifact}/{SKILL_FILE}"));
        }
        _ => {}
    }
}

/// Gruppe und Untergruppe eines Pfads (Artefakt oder Datei) nach seinem Ort.
pub fn place(layout: VaultLayout, path: &str) -> Place {
    let parts: Vec<&str> = path.split('/').collect();
    if layout == VaultLayout::Library {
        match parts.as_slice() {
            [file] if is_root_rules(file) => {
                return grouped(GROUP_INSTRUCTIONS, SUBGROUP_RULES);
            }
            [top, ..] if top.eq_ignore_ascii_case(OUTPUT_STYLES_DIR) => {
                return grouped(GROUP_INSTRUCTIONS, SUBGROUP_STYLES);
            }
            [top, ..] if top.eq_ignore_ascii_case(MEMORY_DIR) => {
                return grouped(GROUP_INSTRUCTIONS, SUBGROUP_MEMORY);
            }
            [top, ..] if top.eq_ignore_ascii_case(COMMANDS_DIR) => {
                return grouped(GROUP_SKILLS, SUBGROUP_COMMANDS);
            }
            [top, name, ..] if top.eq_ignore_ascii_case(SKILLS_DIR) => {
                return grouped(GROUP_SKILLS, skill_subgroup(name));
            }
            [top, rest @ ..] if top.eq_ignore_ascii_case(KNOWLEDGE_DIR) => {
                return knowledge_place(rest);
            }
            _ => {}
        }
    }
    knowledge_place(&parts)
}

/// Wissen: die Untergruppe ist der erste Ordner, eine Datei direkt im Wissen hat keine.
fn knowledge_place(parts: &[&str]) -> Place {
    match parts {
        [folder, _, ..] => grouped(GROUP_KNOWLEDGE, folder),
        _ => grouped(GROUP_KNOWLEDGE, ""),
    }
}

fn skill_subgroup(name: &str) -> &'static str {
    SKILL_PREFIXES
        .iter()
        .find(|(prefix, _): &&(&str, &str)| name.starts_with(prefix))
        .map_or(SUBGROUP_TOOLS, |(_, subgroup): &(&str, &'static str)| {
            *subgroup
        })
}

fn grouped(group: &'static str, subgroup: &str) -> Place {
    Place {
        group,
        subgroup: subgroup.to_owned(),
    }
}

fn is_root_rules(file: &str) -> bool {
    ROOT_RULES_FILES
        .iter()
        .any(|candidate: &&str| candidate.eq_ignore_ascii_case(file))
}

/// Ein Name ohne Endung: so heißt ein Skill-Ordner, eine lose Datei in `skills/` (`notiz.md`)
/// dagegen nicht — die behält ihre Art aus `extract`.
fn is_folder_name(name: &str) -> bool {
    Path::new(name).extension().is_none()
}

/// Endung `.md` ohne Beachtung der Schreibweise, mit nichtleerem Namen davor.
fn is_markdown(file: &str) -> bool {
    file.len() > MARKDOWN_EXTENSION.len()
        && file
            .get(file.len() - MARKDOWN_EXTENSION.len()..)
            .is_some_and(|extension: &str| extension.eq_ignore_ascii_case(MARKDOWN_EXTENSION))
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
        for name in ["skills", "commands", "output-styles", "memory", "_vault"] {
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

    // --- is_included_below ---

    #[test]
    fn library_skips_folders_below_memory_in_any_case() {
        for parent in ["memory", "Memory", "MEMORY"] {
            assert!(!is_included_below(Library, parent, true), "{parent}");
        }
    }

    #[test]
    fn library_includes_files_below_memory() {
        for parent in ["memory", "Memory"] {
            assert!(is_included_below(Library, parent, false), "{parent}");
        }
    }

    #[test]
    fn library_includes_everything_below_other_folders() {
        for parent in ["skills", "commands", "output-styles", "_vault"] {
            assert!(is_included_below(Library, parent, true), "{parent}");
            assert!(is_included_below(Library, parent, false), "{parent}");
        }
    }

    #[test]
    fn plain_includes_everything_below() {
        for (parent, is_dir) in [("memory", true), ("memory", false), ("rezepte", true)] {
            assert!(is_included_below(Plain, parent, is_dir), "{parent}");
        }
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
    fn apply_place_marks_direct_memories() {
        let mut expected = sample_meta();
        expected.kind = Some("memory".to_owned());
        assert_eq!(
            placed(Library, "memory/feedback_keine_zaehltests.md"),
            expected
        );
        assert_eq!(placed(Library, "Memory/MEMORY.MD"), expected);
    }

    #[test]
    fn apply_place_leaves_memory_archive_and_non_markdown_unchanged() {
        for artifact in ["memory/_archiv/alt.md", "memory/notiz.txt"] {
            assert_eq!(placed(Library, artifact), sample_meta(), "{artifact}");
        }
    }

    #[test]
    fn apply_place_leaves_loose_files_in_skills_unchanged() {
        for artifact in ["skills/notiz.md", "skills/liste.txt"] {
            assert_eq!(placed(Library, artifact), sample_meta(), "{artifact}");
        }
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
    fn place_puts_memories_under_gedaechtnis() {
        for path in ["memory/feedback_keine_zaehltests.md", "memory/MEMORY.md"] {
            assert_eq!(
                group_of(Library, path),
                ("anweisungen", "gedaechtnis".to_owned()),
                "{path}"
            );
        }
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
