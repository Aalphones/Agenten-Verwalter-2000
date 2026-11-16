//! Prüfung der Paketdaten vor dem Speichern. Jeder Fehler ist ein ganzer Satz für den Benutzer
//! (oder den Agenten); gespeichert wird nur, was die Prüfung ganz besteht.
use std::collections::HashSet;
use std::path::Path;

use super::model::{
    BuiltinSlot, CustomSlot, FiguresData, MAX_CUSTOM_SLOTS, MAX_NAME_CHARS, MAX_OPACITY,
    MAX_PATTERN_CHARS, MAX_TEXT_CHARS, MAX_TEXTS, SlotLook, StyleColors, StyleData,
};

const CUSTOM_ID_PREFIX: &str = "c-";
/// `<slot>-2` ist der Dateiname der zweiten Pose; eine ID auf `-2` würde mit ihr zusammenfallen.
const SECOND_IMAGE_SUFFIX: &str = "-2";

/// Prüft und bereinigt (Texte getrimmt, leere entfernt) ein Figurenpaket.
pub fn validate_figures(data: &mut FiguresData, dir: &Path) -> Result<(), String> {
    if data.custom.len() > MAX_CUSTOM_SLOTS {
        return Err(format!(
            "Höchstens {MAX_CUSTOM_SLOTS} eigene Fächer sind erlaubt."
        ));
    }
    let mut seen_ids: HashSet<String> = HashSet::new();
    for slot in &mut data.custom {
        validate_custom_slot(slot, dir)?;
        if !seen_ids.insert(slot.id.clone()) {
            return Err(format!("Die Fach-ID {} kommt doppelt vor.", slot.id));
        }
    }
    let mut seen_builtin: Vec<BuiltinSlot> = Vec::new();
    for entry in &mut data.builtin {
        if seen_builtin.contains(&entry.slot) {
            return Err(format!("Das Fach {:?} kommt doppelt vor.", entry.slot));
        }
        seen_builtin.push(entry.slot);
        validate_look(&mut entry.look, dir)?;
    }
    Ok(())
}

/// Prüft und bereinigt ein Stilpaket.
pub fn validate_style(data: &mut StyleData, dir: &Path) -> Result<(), String> {
    validate_colors(&mut data.dark, "dunkel")?;
    validate_colors(&mut data.light, "hell")?;
    if data.sidebar_opacity > MAX_OPACITY || data.content_opacity > MAX_OPACITY {
        return Err(format!(
            "Die Deckkraft der Hintergrundbilder darf höchstens {MAX_OPACITY} Prozent sein."
        ));
    }
    for image in [&data.sidebar_image, &data.content_image, &data.icon] {
        validate_image_name(image.as_deref(), dir)?;
    }
    Ok(())
}

/// Ob `id` eine gültige Fach-ID ist: `c-`, danach Kleinbuchstaben, Ziffern und Bindestriche.
pub fn is_custom_id(id: &str) -> bool {
    let Some(rest) = id.strip_prefix(CUSTOM_ID_PREFIX) else {
        return false;
    };
    !rest.is_empty()
        && rest.chars().all(|character: char| {
            character.is_ascii_lowercase() || character.is_ascii_digit() || character == '-'
        })
        && !id.ends_with(SECOND_IMAGE_SUFFIX)
}

/// Ein Name: getrimmt, nicht leer, höchstens `MAX_NAME_CHARS` Zeichen.
pub fn clean_name(name: &str, what: &str) -> Result<String, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err(format!("{what} darf nicht leer sein."));
    }
    if trimmed.chars().count() > MAX_NAME_CHARS {
        return Err(format!(
            "{what} darf höchstens {MAX_NAME_CHARS} Zeichen lang sein."
        ));
    }
    Ok(trimmed.to_owned())
}

fn validate_custom_slot(slot: &mut CustomSlot, dir: &Path) -> Result<(), String> {
    if !is_custom_id(&slot.id) {
        return Err(format!(
            "Die Fach-ID „{}“ ist ungültig: erlaubt sind „c-“ und danach Kleinbuchstaben, Ziffern und Bindestriche, nicht auf „-2“ endend.",
            slot.id
        ));
    }
    slot.name = clean_name(&slot.name, "Der Name eines Fachs")?;
    slot.tools = clean_pattern(&slot.tools, "Das Werkzeug-Muster")?;
    if slot.tools.is_empty() {
        return Err("Ein eigenes Fach braucht ein Werkzeug-Muster.".to_owned());
    }
    slot.input = match slot.input.take() {
        Some(pattern) => {
            let cleaned = clean_pattern(&pattern, "Das Eingabe-Muster")?;
            (!cleaned.is_empty()).then_some(cleaned)
        }
        None => None,
    };
    validate_look(&mut slot.look, dir)
}

fn clean_pattern(pattern: &str, what: &str) -> Result<String, String> {
    let trimmed = pattern.trim();
    if trimmed.chars().count() > MAX_PATTERN_CHARS {
        return Err(format!(
            "{what} darf höchstens {MAX_PATTERN_CHARS} Zeichen lang sein."
        ));
    }
    Ok(trimmed.to_owned())
}

fn validate_look(look: &mut SlotLook, dir: &Path) -> Result<(), String> {
    validate_image_name(look.image.as_deref(), dir)?;
    validate_image_name(look.image2.as_deref(), dir)?;
    let mut texts: Vec<String> = Vec::new();
    for text in &look.texts {
        let trimmed = text.trim();
        if trimmed.is_empty() {
            continue;
        }
        if trimmed.chars().count() > MAX_TEXT_CHARS {
            return Err(format!(
                "Ein Text darf höchstens {MAX_TEXT_CHARS} Zeichen lang sein."
            ));
        }
        texts.push(trimmed.to_owned());
    }
    if texts.len() > MAX_TEXTS {
        return Err(format!("Höchstens {MAX_TEXTS} Texte je Fach sind erlaubt."));
    }
    look.texts = texts;
    Ok(())
}

/// Ob `name` ein reiner Dateiname ist: kein Pfad, kein Laufwerk, nichts außerhalb des Ordners.
pub fn is_plain_file_name(name: &str) -> bool {
    !name.is_empty() && name != "." && name != ".." && !name.contains(['/', '\\', ':'])
}

/// Ein Bildname muss eine vorhandene Datei im Paketordner sein.
fn validate_image_name(name: Option<&str>, dir: &Path) -> Result<(), String> {
    let Some(name) = name else {
        return Ok(());
    };
    if !is_plain_file_name(name) || !dir.join(name).is_file() {
        return Err(format!(
            "Das Bild „{name}“ liegt nicht im Ordner des Pakets."
        ));
    }
    Ok(())
}

fn validate_colors(colors: &mut StyleColors, theme: &str) -> Result<(), String> {
    for color in colors.all_mut() {
        if !is_hex_color(color) {
            return Err(format!(
                "Die Farbe „{color}“ ({theme}) ist ungültig: erwartet wird #rrggbb."
            ));
        }
        color.make_ascii_lowercase();
    }
    Ok(())
}

fn is_hex_color(text: &str) -> bool {
    let Some(digits) = text.strip_prefix('#') else {
        return false;
    };
    digits.len() == 6
        && digits
            .chars()
            .all(|character: char| character.is_ascii_hexdigit())
}
