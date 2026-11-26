use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::agents::event::{Effort, Mode, ModelId};

/// `System` folgt der Windows-Einstellung für hell oder dunkel.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum ColorScheme {
    Dark,
    Light,
    System,
}

/// Wo das Terminal-Dock sitzt (ADR 052): unter der Hauptfläche oder als Spalte rechts.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum TerminalPlacement {
    Bottom,
    Right,
}

/// Wo die Notiz des Vorhabens erscheint (ADR 074): im Terminal-Dock oder als Reiter oben.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum NotePlacement {
    Dock,
    Tab,
}

/// Eine der fünf seitlichen Leisten, deren Breite die Oberfläche verschieben lässt (ADR 053).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum PanelId {
    /// Seitenleiste mit den Vorhaben.
    Sidebar,
    /// Dateibaum der Changes.
    ChangesTree,
    /// Linke Spalte der Ansicht „Dateien“ (ADR 067).
    FilesTree,
    /// Liste der Artefakte.
    ArtifactsList,
    /// Hintergrund-Leiste.
    Background,
}

/// Gezogene Breite je Leiste in Pixeln; `None` = Standardbreite der Oberfläche.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct PanelWidths {
    pub sidebar: Option<u32>,
    pub changes_tree: Option<u32>,
    pub files_tree: Option<u32>,
    pub artifacts_list: Option<u32>,
    pub background: Option<u32>,
}

/// Woher die Modellanfragen der Agenten kommen (ADR 016). `ClaudeCodeLocal` startet dieselbe
/// Claude-Kommandozeile, schickt die Anfragen aber an LM Studio. `Standalone` („Autark“, ADR 017)
/// startet statt der Claude-Kommandozeile den eigenen Agenten des Verwalters. `Codex` (ADR 031)
/// startet den Übersetzer des Verwalters vor `codex app-server`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum OperatingMode {
    Claude,
    ClaudeCodeLocal,
    Standalone,
    Codex,
}

/// Werte, die für die ganze App gelten. Modell, Modus und Denkaufwand gelten für die erste Session
/// eines neuen Vorhabens.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub color_scheme: ColorScheme,
    pub default_model: ModelId,
    pub default_effort: Effort,
    pub default_mode: Mode,
    pub operating_mode: OperatingMode,
    /// Kennung des Modells in LM Studio, z. B. `google/gemma-4-12b-qat`; `None`, solange keins gewählt ist.
    pub local_model: Option<String>,
    /// Modell für neue Vorhaben in der Betriebsart Codex; `None` = Standardmodell von Codex.
    pub default_codex_model: Option<String>,
    /// Ordner der Bibliothek: Anweisungen, Skills, Befehle, Ausgabestile und Wissen (ADR 069);
    /// `None`, solange keiner gewählt ist.
    pub library_dir: Option<String>,
    /// Ob die Bibliothek eingelesen und durchsucht wird; Standard aus.
    pub vault_enabled: bool,
    /// Ob der Verlauf Angaben ohne Fundstelle unterstreicht (ADR 036); der Core ermittelt sie immer.
    pub mark_unsourced: bool,
    /// Ob Stationen einer Umsetzung ihren Verlauf selbst zusammenfassen (ADR 058).
    pub auto_compact_stations: bool,
    /// Kontextgröße in Tokens, ab der eine Station zusammenfasst (ADR 058).
    pub auto_compact_threshold: u32,
    /// Ob eine Station nach dem Kontingent-Limit selbst weitermacht und Windows dafür wach bleibt
    /// (ADR 063).
    pub auto_continue_at_limit: bool,
    pub terminal_placement: TerminalPlacement,
    /// Wo die Notiz des Vorhabens erscheint (ADR 074).
    pub note_placement: NotePlacement,
    /// Gezogene Höhe des Terminal-Docks in Pixeln.
    pub terminal_height: u32,
    /// Gezogene Breite des Terminal-Docks in Pixeln.
    pub terminal_width: u32,
    /// Breite je Leiste in Pixeln; `None` = Standardbreite der Oberfläche (ADR 053).
    pub panel_widths: PanelWidths,
    /// ID des aktiven Figurenpakets (ADR 065); `None` = keine Figur.
    pub skin_figures: Option<String>,
    /// ID des aktiven Stilpakets; `None` = Standardfarben ohne Hintergrundbilder.
    pub skin_style: Option<String>,
    /// Ob Figuren sich bewegen; `None` = die Windows-Einstellung „Animationen“ entscheidet
    /// (`prefers-reduced-motion`).
    pub skin_animations: Option<bool>,
    /// Ob ein Feier-Moment erscheint, wenn eine Antwort etwas Besonderes enthält.
    pub skin_celebrations: bool,
    /// Ob versteckte Überraschungen aktiv sind.
    pub skin_easter_eggs: bool,
    /// Ob ein neu gestarteter Agent die `skin_*`-Werkzeuge bekommt.
    pub skin_agent_tools: bool,
}

/// Was die Einstellungsseite zeigt: die Werte und die Ordner, die sie nur anzeigt.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SettingsOverview {
    pub settings: Settings,
    /// Absolut: `<Benutzerordner>\.claude\skills`.
    pub user_skills_dir: String,
    /// Skills des Benutzers ohne Befehle.
    pub user_skill_count: u32,
    /// Absolut: `<Benutzerordner>\.verwalter\workspaces`.
    pub workspaces_dir: String,
}

/// Eine Änderung aus der Einstellungsseite. Modus und Denkaufwand ändern sich gemeinsam, weil sie
/// im selben Menü stehen.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum SettingsChange {
    ColorScheme {
        value: ColorScheme,
    },
    DefaultModel {
        value: ModelId,
    },
    DefaultMode {
        mode: Mode,
        effort: Effort,
    },
    OperatingMode {
        value: OperatingMode,
    },
    LocalModel {
        value: String,
    },
    /// `None` setzt zurück auf das Standardmodell von Codex.
    DefaultCodexModel {
        value: Option<String>,
    },
    /// `None` oder ein leerer Text entfernt den Ordner der Bibliothek.
    LibraryDir {
        value: Option<String>,
    },
    VaultEnabled {
        value: bool,
    },
    MarkUnsourced {
        value: bool,
    },
    AutoCompactStations {
        value: bool,
    },
    AutoCompactThreshold {
        value: u32,
    },
    AutoContinueAtLimit {
        value: bool,
    },
    TerminalPlacement {
        value: TerminalPlacement,
    },
    NotePlacement {
        value: NotePlacement,
    },
    TerminalHeight {
        value: u32,
    },
    TerminalWidth {
        value: u32,
    },
    /// `None` löscht die gemerkte Breite und stellt die Standardbreite wieder her.
    PanelWidth {
        panel: PanelId,
        value: Option<u32>,
    },
    /// `None` schaltet die Figur ab. Die ID muss ein vorhandenes Figurenpaket nennen.
    SkinFigures {
        value: Option<String>,
    },
    /// `None` stellt Farben und Hintergründe auf Standard. Die ID muss ein vorhandenes Stilpaket
    /// nennen.
    SkinStyle {
        value: Option<String>,
    },
    SkinAnimations {
        value: bool,
    },
    SkinCelebrations {
        value: bool,
    },
    SkinEasterEggs {
        value: bool,
    },
    SkinAgentTools {
        value: bool,
    },
}
