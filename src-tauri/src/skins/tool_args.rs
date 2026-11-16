//! Eingaben der Skin-Werkzeuge lesen. Jeder Fehler ist ein ganzer Satz für den Agenten.
use serde::Serialize;
use serde::de::DeserializeOwned;
use serde_json::{Map, Value};

/// Ein Text-Feld; fehlt es oder ist es `null`, ist das Ergebnis `None`.
pub fn optional_str<'a>(arguments: &'a Value, key: &str) -> Result<Option<&'a str>, String> {
    match arguments.get(key) {
        None | Some(Value::Null) => Ok(None),
        Some(Value::String(text)) => Ok(Some(text.as_str())),
        Some(_) => Err(format!("{key} muss ein Text sein.")),
    }
}

pub fn required_str<'a>(arguments: &'a Value, key: &str) -> Result<&'a str, String> {
    optional_str(arguments, key)?.ok_or_else(|| format!("{key} fehlt."))
}

pub fn optional_bool(arguments: &Value, key: &str) -> Result<Option<bool>, String> {
    match arguments.get(key) {
        None | Some(Value::Null) => Ok(None),
        Some(Value::Bool(flag)) => Ok(Some(*flag)),
        Some(_) => Err(format!("{key} muss true oder false sein.")),
    }
}

/// Eine ganze Zahl von 0 an; Brüche und Negative sind ein Fehler.
pub fn optional_count(arguments: &Value, key: &str) -> Result<Option<u64>, String> {
    match arguments.get(key) {
        None | Some(Value::Null) => Ok(None),
        Some(value) => value
            .as_u64()
            .map(Some)
            .ok_or_else(|| format!("{key} muss eine ganze Zahl ab 0 sein.")),
    }
}

pub fn optional_object<'a>(
    arguments: &'a Value,
    key: &str,
) -> Result<Option<&'a Map<String, Value>>, String> {
    match arguments.get(key) {
        None | Some(Value::Null) => Ok(None),
        Some(Value::Object(object)) => Ok(Some(object)),
        Some(_) => Err(format!("{key} muss ein Objekt sein.")),
    }
}

pub fn optional_texts(arguments: &Value, key: &str) -> Result<Option<Vec<String>>, String> {
    let items: &Vec<Value> = match arguments.get(key) {
        None | Some(Value::Null) => return Ok(None),
        Some(Value::Array(items)) => items,
        Some(_) => return Err(format!("{key} muss eine Liste von Texten sein.")),
    };
    let mut texts: Vec<String> = Vec::with_capacity(items.len());
    for item in items {
        let Some(text) = item.as_str() else {
            return Err(format!("{key} muss eine Liste von Texten sein."));
        };
        texts.push(text.to_owned());
    }
    Ok(Some(texts))
}

/// Die serde-Namen einer Aufzählung, in der Reihenfolge von `values`.
pub fn names_of<T: Serialize>(values: &[T]) -> Vec<String> {
    values
        .iter()
        .filter_map(|value: &T| match serde_json::to_value(value) {
            Ok(Value::String(name)) => Some(name),
            _ => None,
        })
        .collect()
}

/// Ein Wert der Aufzählung `T` aus seinem serde-Namen; sonst ein Satz mit allen erlaubten Namen.
pub fn parse_name<T: DeserializeOwned>(
    text: &str,
    what: &str,
    allowed: &[String],
) -> Result<T, String> {
    serde_json::from_value(Value::String(text.to_owned())).map_err(|_| {
        format!(
            "{what} „{text}“ gibt es nicht. Erlaubt: {}.",
            allowed.join(", ")
        )
    })
}
