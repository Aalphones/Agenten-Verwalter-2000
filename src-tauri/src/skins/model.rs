//! Typen der Skins (ADR 065): Figurenpakete und Stilpakete. Die Namen und Grenzen stehen im
//! Kontrakt des Plans; die Oberfläche bekommt die Typen über `pnpm bindings`.
use serde::{Deserialize, Serialize};
use ts_rs::TS;

pub const MAX_CUSTOM_SLOTS: usize = 24;
pub const MAX_TEXTS: usize = 10;
pub const MAX_TEXT_CHARS: usize = 160;
pub const MAX_NAME_CHARS: usize = 40;
pub const MAX_PATTERN_CHARS: usize = 200;
pub const MAX_IMAGE_BYTES: usize = 2 * 1024 * 1024;
pub const MAX_OPACITY: u8 = 60;
pub const DEFAULT_SIDEBAR_OPACITY: u8 = 20;
pub const DEFAULT_CONTENT_OPACITY: u8 = 10;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum SkinKind {
    Figures,
    Style,
}

/// Die Fächer der Statuszeile, die der Verwalter selbst kennt.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum BuiltinSlot {
    Search,
    Read,
    Write,
    Shell,
    Web,
    Agent,
    Other,
    Wait,
    Think,
    Commit,
    Station,
}

impl BuiltinSlot {
    pub const ALL: [BuiltinSlot; 11] = [
        BuiltinSlot::Search,
        BuiltinSlot::Read,
        BuiltinSlot::Write,
        BuiltinSlot::Shell,
        BuiltinSlot::Web,
        BuiltinSlot::Agent,
        BuiltinSlot::Other,
        BuiltinSlot::Wait,
        BuiltinSlot::Think,
        BuiltinSlot::Commit,
        BuiltinSlot::Station,
    ];
}

/// Wie sich die Figur bewegt; die Bewegungen selbst liefert die Oberfläche.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum Motion {
    None,
    Bob,
    Vine,
    Float,
    Squish,
    Zap,
    Fly,
    Summon,
    Sleep,
    Ponder,
    Wobble,
    Evolve,
    Popin,
    WebShot,
    Shield,
    Beam,
    Sparkle,
    Frost,
    Wave,
}

impl Motion {
    pub const ALL: [Motion; 19] = [
        Motion::None,
        Motion::Bob,
        Motion::Vine,
        Motion::Float,
        Motion::Squish,
        Motion::Zap,
        Motion::Fly,
        Motion::Summon,
        Motion::Sleep,
        Motion::Ponder,
        Motion::Wobble,
        Motion::Evolve,
        Motion::Popin,
        Motion::WebShot,
        Motion::Shield,
        Motion::Beam,
        Motion::Sparkle,
        Motion::Frost,
        Motion::Wave,
    ];
}

/// Figur, Bewegung und Texte eines Fachs. Bildnamen sind Dateinamen im Bildordner des Pakets.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SlotLook {
    pub image: Option<String>,
    /// Zweites Bild für den Wechsel zwischen zwei Posen.
    pub image2: Option<String>,
    pub motion: Motion,
    pub texts: Vec<String>,
}

impl SlotLook {
    pub fn empty() -> SlotLook {
        SlotLook {
            image: None,
            image2: None,
            motion: Motion::None,
            texts: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct BuiltinSlotLook {
    pub slot: BuiltinSlot,
    pub look: SlotLook,
}

/// Ein Fach des Pakets mit eigenem Muster. `tools` ist das Muster für den Werkzeugnamen
/// (z. B. `mcp__github__*`), `input` optional eines für den Anfang der Eingabe.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct CustomSlot {
    pub id: String,
    pub name: String,
    pub tools: String,
    pub input: Option<String>,
    pub look: SlotLook,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct FiguresData {
    pub custom: Vec<CustomSlot>,
    pub builtin: Vec<BuiltinSlotLook>,
}

/// Sieben Farben, je `#rrggbb`.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct StyleColors {
    pub base: String,
    pub sidebar: String,
    pub surface: String,
    pub fg: String,
    pub muted: String,
    pub accent: String,
    pub border: String,
}

impl StyleColors {
    /// Die Farben des dunklen Themes aus `src/styles/theme.css`.
    pub fn standard_dark() -> StyleColors {
        StyleColors {
            base: "#1f1f1f".to_owned(),
            sidebar: "#181818".to_owned(),
            surface: "#252526".to_owned(),
            fg: "#d4d4d4".to_owned(),
            muted: "#8f8f8f".to_owned(),
            accent: "#e0825c".to_owned(),
            border: "#3c3c3c".to_owned(),
        }
    }

    /// Die Farben des hellen Themes aus `src/styles/theme.css`.
    pub fn standard_light() -> StyleColors {
        StyleColors {
            base: "#ffffff".to_owned(),
            sidebar: "#f8f8f8".to_owned(),
            surface: "#ffffff".to_owned(),
            fg: "#3c3c3c".to_owned(),
            muted: "#6e6e6e".to_owned(),
            accent: "#c4572f".to_owned(),
            border: "#d9d9d9".to_owned(),
        }
    }

    pub fn all_mut(&mut self) -> [&mut String; 7] {
        [
            &mut self.base,
            &mut self.sidebar,
            &mut self.surface,
            &mut self.fg,
            &mut self.muted,
            &mut self.accent,
            &mut self.border,
        ]
    }
}

/// Deckkraft der Hintergrundbilder in Prozent, höchstens `MAX_OPACITY`.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct StyleData {
    pub dark: StyleColors,
    pub light: StyleColors,
    pub sidebar_image: Option<String>,
    pub sidebar_opacity: u8,
    pub content_image: Option<String>,
    pub content_opacity: u8,
    pub icon: Option<String>,
}

impl StyleData {
    pub fn standard() -> StyleData {
        StyleData {
            dark: StyleColors::standard_dark(),
            light: StyleColors::standard_light(),
            sidebar_image: None,
            sidebar_opacity: DEFAULT_SIDEBAR_OPACITY,
            content_image: None,
            content_opacity: DEFAULT_CONTENT_OPACITY,
            icon: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(tag = "kind", content = "data", rename_all = "camelCase")]
pub enum SkinData {
    Figures(FiguresData),
    /// Im `Box`, weil ein Stilpaket mit seinen vierzehn Farben ein Vielfaches eines Figurenpakets groß ist.
    Style(Box<StyleData>),
}

impl SkinData {
    pub fn kind(&self) -> SkinKind {
        match self {
            SkinData::Figures(_) => SkinKind::Figures,
            SkinData::Style(_) => SkinKind::Style,
        }
    }
}

/// Ein Paket mit allen Daten. `dir` ist der absolute Bildordner; `changed_by` ist `None`, wenn
/// der Benutzer zuletzt geändert hat, sonst `Session #<Nr> · <Name>` der Session des Agenten.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SkinPack {
    pub id: String,
    pub name: String,
    pub data: SkinData,
    pub changed_at: String,
    pub changed_by: Option<String>,
    pub dir: String,
}

/// Eine Zeile der Paketliste. `thumb` ist der absolute Pfad eines Vorschaubilds, `swatches` sind
/// vier Farben eines Stilpakets.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SkinPackSummary {
    pub id: String,
    pub kind: SkinKind,
    pub name: String,
    pub changed_at: String,
    pub changed_by: Option<String>,
    pub thumb: Option<String>,
    pub swatches: Vec<String>,
}

/// Wohin ein Bild gehört: in ein Fach (`slot` = Name des eingebauten Fachs oder `c-…`-ID,
/// `second` = zweite Pose) oder zu einer der drei Stilangaben.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum ImageTarget {
    Slot { slot: String, second: bool },
    SidebarImage,
    ContentImage,
    Icon,
}

/// Woher ein Bild kommt: Datei auf dem Rechner, `https`-Adresse oder die Bytes selbst (Base64).
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum ImageSource {
    Path { path: String },
    Url { url: String },
    Bytes { name: String, base64: String },
}

/// Ein Werkzeugaufruf, wie die Sessions ihn tatsächlich gemacht haben, mit Anzahl. `slot` ist das
/// eingebaute Fach, in das die Oberfläche das Werkzeug einordnet; der Core liefert `None`.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ToolUsage {
    pub tool: String,
    pub input_prefix: String,
    pub count: u32,
    pub slot: Option<String>,
}
