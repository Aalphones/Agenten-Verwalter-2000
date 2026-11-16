//! Änderungen an Paketdaten für die Skin-Werkzeuge: aus den Eingaben des Agenten eine Änderung
//! lesen und auf `FiguresData` bzw. `StyleData` anwenden. Geprüft und gespeichert wird danach
//! von `skins::save`; hier steht nur, was ein Werkzeug über die Seite hinaus braucht.
use serde_json::{Map, Value};

use super::model::{
    BuiltinSlot, CustomSlot, FiguresData, MAX_OPACITY, Motion, SlotLook, StyleColors, StyleData,
};
use super::tool_args::{
    names_of, optional_count, optional_object, optional_str, optional_texts, parse_name,
    required_str,
};
use super::validate::is_custom_id;

const COLOR_KEYS: [&str; 7] = [
    "base", "sidebar", "surface", "fg", "muted", "accent", "border",
];

/// Was `skin_slot_set` an einem Fach ändert; `None` lässt das Feld, wie es ist.
pub struct SlotEdit {
    pub name: Option<String>,
    pub tools: Option<String>,
    /// Leer = das Eingabe-Muster entfernen.
    pub input: Option<String>,
    pub position: Option<usize>,
    pub motion: Option<Motion>,
    pub texts: Option<Vec<String>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SlotChange {
    Created,
    Changed,
}

impl SlotEdit {
    pub fn from_arguments(arguments: &Value) -> Result<SlotEdit, String> {
        let motion: Option<Motion> = match optional_str(arguments, "motion")? {
            Some(text) => Some(parse_name(text, "Die Bewegung", &names_of(&Motion::ALL))?),
            None => None,
        };
        let position: Option<usize> = match optional_count(arguments, "position")? {
            Some(value) => {
                Some(usize::try_from(value).map_err(|_| "position ist zu groß.".to_owned())?)
            }
            None => None,
        };
        Ok(SlotEdit {
            name: optional_str(arguments, "name")?.map(str::to_owned),
            tools: optional_str(arguments, "tools")?.map(str::to_owned),
            input: optional_str(arguments, "input")?.map(str::to_owned),
            position,
            motion,
            texts: optional_texts(arguments, "texts")?,
        })
    }

    fn has_custom_only_fields(&self) -> bool {
        self.name.is_some()
            || self.tools.is_some()
            || self.input.is_some()
            || self.position.is_some()
    }
}

/// Legt das Fach an oder ändert es. Vorgegebene Fächer haben feste Werkzeuge; nur Bewegung und
/// Texte sind dort änderbar.
pub fn apply_slot(
    figures: &mut FiguresData,
    slot: &str,
    edit: SlotEdit,
) -> Result<SlotChange, String> {
    if is_custom_id(slot) {
        return apply_custom(figures, slot, edit);
    }
    let builtin_names: Vec<String> = names_of(&BuiltinSlot::ALL);
    if !builtin_names.iter().any(|name: &String| name == slot) {
        return Err(format!(
            "Das Fach „{slot}“ gibt es nicht. Vorgegeben: {}; eigene Fächer heißen „c-“ und dann Kleinbuchstaben, Ziffern oder Bindestriche.",
            builtin_names.join(", ")
        ));
    }
    if edit.has_custom_only_fields() {
        return Err(format!(
            "Das vorgegebene Fach „{slot}“ hat feste Werkzeuge: name, tools, input und position gibt es nur bei eigenen Fächern („c-…“)."
        ));
    }
    let look: &mut SlotLook = super::slot_look(figures, slot)?;
    apply_look(look, edit.motion, edit.texts);
    Ok(SlotChange::Changed)
}

fn apply_custom(
    figures: &mut FiguresData,
    slot: &str,
    edit: SlotEdit,
) -> Result<SlotChange, String> {
    let existing: Option<usize> = figures
        .custom
        .iter()
        .position(|custom: &CustomSlot| custom.id == slot);
    match existing {
        Some(index) => {
            change_custom(&mut figures.custom[index], &edit);
            if let Some(position) = edit.position {
                move_custom(figures, index, position)?;
            }
            Ok(SlotChange::Changed)
        }
        None => {
            create_custom(figures, slot, edit)?;
            Ok(SlotChange::Created)
        }
    }
}

fn change_custom(custom: &mut CustomSlot, edit: &SlotEdit) {
    if let Some(name) = &edit.name {
        custom.name.clone_from(name);
    }
    if let Some(tools) = &edit.tools {
        custom.tools.clone_from(tools);
    }
    if let Some(input) = &edit.input {
        custom.input = non_empty(input);
    }
    apply_look(&mut custom.look, edit.motion, edit.texts.clone());
}

fn create_custom(figures: &mut FiguresData, slot: &str, edit: SlotEdit) -> Result<(), String> {
    let (Some(name), Some(tools)) = (edit.name, edit.tools) else {
        return Err(format!(
            "Das Fach „{slot}“ gibt es noch nicht: ein neues eigenes Fach braucht name und tools."
        ));
    };
    let position: usize = edit.position.unwrap_or(figures.custom.len());
    if position > figures.custom.len() {
        return Err(format!(
            "Position {position} gibt es nicht: das Paket hat {} eigene Fächer, neu geht von 0 bis {}.",
            figures.custom.len(),
            figures.custom.len()
        ));
    }
    let mut look: SlotLook = SlotLook::empty();
    apply_look(&mut look, edit.motion, edit.texts);
    figures.custom.insert(
        position,
        CustomSlot {
            id: slot.to_owned(),
            name,
            tools,
            input: edit.input.as_deref().and_then(non_empty),
            look,
        },
    );
    Ok(())
}

fn move_custom(figures: &mut FiguresData, index: usize, position: usize) -> Result<(), String> {
    let count: usize = figures.custom.len();
    if position >= count {
        return Err(format!(
            "Position {position} gibt es nicht: das Paket hat {count} eigene Fächer (0 bis {}).",
            count - 1
        ));
    }
    let moved: CustomSlot = figures.custom.remove(index);
    figures.custom.insert(position, moved);
    Ok(())
}

fn apply_look(look: &mut SlotLook, motion: Option<Motion>, texts: Option<Vec<String>>) {
    if let Some(motion) = motion {
        look.motion = motion;
    }
    if let Some(texts) = texts {
        look.texts = texts;
    }
}

fn non_empty(text: &str) -> Option<String> {
    let trimmed: &str = text.trim();
    (!trimmed.is_empty()).then(|| trimmed.to_owned())
}

/// Entfernt ein eigenes Fach; vorgegebene Fächer lassen sich nicht entfernen.
pub fn remove_custom(figures: &mut FiguresData, slot: &str) -> Result<(), String> {
    if !is_custom_id(slot) {
        return Err(format!(
            "„{slot}“ ist kein eigenes Fach: nur Fächer mit „c-…“ lassen sich entfernen."
        ));
    }
    let Some(index) = figures
        .custom
        .iter()
        .position(|custom: &CustomSlot| custom.id == slot)
    else {
        return Err(format!("Das Paket hat kein Fach „{slot}“."));
    };
    figures.custom.remove(index);
    Ok(())
}

/// Setzt Farben und Deckkraft eines Stilpakets; `scheme` wählt hell oder dunkel.
pub fn apply_style(style: &mut StyleData, arguments: &Value) -> Result<(), String> {
    let scheme: &str = required_str(arguments, "scheme")?;
    let colors: Option<&Map<String, Value>> = optional_object(arguments, "colors")?;
    let sidebar_opacity: Option<u8> = opacity_arg(arguments, "sidebarOpacity")?;
    let content_opacity: Option<u8> = opacity_arg(arguments, "contentOpacity")?;
    if colors.is_none() && sidebar_opacity.is_none() && content_opacity.is_none() {
        return Err(
            "Nichts zu ändern: gib colors, sidebarOpacity oder contentOpacity an.".to_owned(),
        );
    }
    if let Some(colors) = colors {
        let target: &mut StyleColors = match scheme {
            "dark" => &mut style.dark,
            "light" => &mut style.light,
            other => {
                return Err(format!(
                    "scheme „{other}“ gibt es nicht. Erlaubt: dark, light."
                ));
            }
        };
        apply_colors(target, colors)?;
    }
    if let Some(value) = sidebar_opacity {
        style.sidebar_opacity = value;
    }
    if let Some(value) = content_opacity {
        style.content_opacity = value;
    }
    Ok(())
}

fn apply_colors(target: &mut StyleColors, colors: &Map<String, Value>) -> Result<(), String> {
    for (key, value) in colors {
        let Some(text) = value.as_str() else {
            return Err(format!("Die Farbe {key} muss ein Text wie #1f1f1f sein."));
        };
        let field: &mut String = match key.as_str() {
            "base" => &mut target.base,
            "sidebar" => &mut target.sidebar,
            "surface" => &mut target.surface,
            "fg" => &mut target.fg,
            "muted" => &mut target.muted,
            "accent" => &mut target.accent,
            "border" => &mut target.border,
            other => {
                return Err(format!(
                    "Die Farbe „{other}“ gibt es nicht. Erlaubt: {}.",
                    COLOR_KEYS.join(", ")
                ));
            }
        };
        text.trim().clone_into(field);
    }
    Ok(())
}

fn opacity_arg(arguments: &Value, key: &str) -> Result<Option<u8>, String> {
    let Some(value) = optional_count(arguments, key)? else {
        return Ok(None);
    };
    match u8::try_from(value) {
        Ok(percent) if percent <= MAX_OPACITY => Ok(Some(percent)),
        _ => Err(format!("{key} darf höchstens {MAX_OPACITY} Prozent sein.")),
    }
}
