//! Angaben einer Antwort ohne Fundstelle in den Werkzeug-Ausgaben derselben Antwort (ADR 036).
//! Rein mechanisch: kein Modell, keine Datenbank.
use std::collections::HashSet;
use std::ops::Range;
use std::sync::LazyLock;

use regex::Regex;

/// Mehr Quellen als das und `unsourced` liefert nichts: halb zu prüfen wäre schlimmer als gar nicht.
const MAX_SOURCE_BYTES: usize = 4 * 1024 * 1024;
const MAX_UNSOURCED: usize = 50;
/// Einstellige Zahlen sind zu häufig, um eine Fundstelle zu verlangen.
const MIN_NUMBER_DIGITS: usize = 2;

/// Ordner und Dateiname, Laufwerk und `:zeile[:spalte]` optional.
static PATH: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?:[A-Za-z]:)?(?:[\w.~@-]+[\\/])+[\w.@-]+\.[A-Za-z0-9]{1,8}(?::\d+(?::\d+)?)?")
        .expect("PATH ist ein gültiger regulärer Ausdruck")
});
/// Dateiname mit Zeile ohne Ordner.
static FILE_LINE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"[\w.-]+\.[A-Za-z0-9]{1,8}:\d+")
        .expect("FILE_LINE ist ein gültiger regulärer Ausdruck")
});
/// Frisst auch ein abschließendes `.` oder `,`; `claimed_number` schneidet es wieder ab.
static NUMBER: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\d[\d.,]*%?").expect("NUMBER ist ein gültiger regulärer Ausdruck")
});
static ISO_DATE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\d{4}-\d{2}-\d{2}").expect("ISO_DATE ist ein gültiger regulärer Ausdruck")
});
static GERMAN_DATE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^\d{1,2}\.\d{1,2}\.(\d{2,4})?$")
        .expect("GERMAN_DATE ist ein gültiger regulärer Ausdruck")
});
static LINE_SUFFIX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r":(\d+)(?::\d+)?$").expect("LINE_SUFFIX ist ein gültiger regulärer Ausdruck")
});
/// Zahlen einer Quelle, einmal mit Trennern und einmal als reine Ziffernfolge.
static SOURCE_NUMBER: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\d[\d.,]*\d|\d+").expect("SOURCE_NUMBER ist ein gültiger regulärer Ausdruck")
});
static SOURCE_DIGITS: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\d+").expect("SOURCE_DIGITS ist ein gültiger regulärer Ausdruck")
});

/// Alles, was eine Antwort belegen kann: Text der Werkzeug-Ausgaben, die Nachricht des Nutzers
/// und die Pfade der Werkzeug-Aufrufe.
#[derive(Debug, Default)]
pub struct Sources {
    /// Klein geschrieben, durch Zeilenumbrüche getrennt.
    text: String,
    /// Normalisiert (`normalize`).
    paths: Vec<String>,
    /// `number_key` jeder Zahl in `text`.
    numbers: HashSet<String>,
    bytes: usize,
}

impl Sources {
    pub fn push_text(&mut self, text: &str) {
        if self.is_overflowing() {
            return;
        }
        self.bytes += text.len();
        // Über der Grenze wird nicht mehr markiert, also muss nichts mehr gemerkt werden.
        if self.is_overflowing() {
            return;
        }
        for found in SOURCE_NUMBER
            .find_iter(text)
            .chain(SOURCE_DIGITS.find_iter(text))
        {
            self.numbers.insert(number_key(found.as_str()));
        }
        self.text.push_str(&text.to_lowercase());
        self.text.push('\n');
    }

    pub fn push_path(&mut self, path: &str) {
        if self.is_overflowing() {
            return;
        }
        self.bytes += path.len();
        self.paths.push(normalize(path));
    }

    pub fn is_overflowing(&self) -> bool {
        self.bytes > MAX_SOURCE_BYTES
    }

    fn mentions(&self, needle: &str) -> bool {
        self.text.contains(needle) || self.paths.iter().any(|path: &String| path.contains(needle))
    }
}

/// Pfade, Datei:Zeile-Angaben und Zahlen ab zwei Ziffern aus `text`, die in `sources` nirgends
/// vorkommen — jeweils so geschrieben wie im Text, ohne Doppelte, in Reihenfolge des ersten
/// Vorkommens, höchstens `MAX_UNSOURCED`. Code-Blöcke mit Zaun zählen nicht.
pub fn unsourced(text: &str, sources: &Sources) -> Vec<String> {
    if sources.is_overflowing() {
        return Vec::new();
    }
    let prose: String = strip_fences(text);
    let mut claims: Vec<(usize, String)> = Vec::new();
    // Bereiche, in denen keine Zahl einzeln geprüft wird: Pfade, Datei:Zeile, Datum.
    let mut covered: Vec<Range<usize>> = Vec::new();
    collect_paths(&prose, sources, &mut claims, &mut covered);
    collect_numbers(&prose, sources, &covered, &mut claims);
    claims.sort_by_key(|(start, _): &(usize, String)| *start);
    let mut seen: HashSet<String> = HashSet::new();
    claims
        .into_iter()
        .map(|(_, claim): (usize, String)| claim)
        .filter(|claim: &String| seen.insert(claim.clone()))
        .take(MAX_UNSOURCED)
        .collect()
}

fn collect_paths(
    prose: &str,
    sources: &Sources,
    claims: &mut Vec<(usize, String)>,
    covered: &mut Vec<Range<usize>>,
) {
    for found in PATH.find_iter(prose) {
        covered.push(found.range());
        if has_clean_edges(prose, &found.range()) && !is_path_sourced(found.as_str(), sources) {
            claims.push((found.start(), found.as_str().to_owned()));
        }
    }
    for found in FILE_LINE.find_iter(prose) {
        if overlaps_any(covered, &found.range()) {
            continue;
        }
        covered.push(found.range());
        if has_clean_edges(prose, &found.range()) && !is_path_sourced(found.as_str(), sources) {
            claims.push((found.start(), found.as_str().to_owned()));
        }
    }
    for found in ISO_DATE.find_iter(prose) {
        covered.push(found.range());
    }
}

fn collect_numbers(
    prose: &str,
    sources: &Sources,
    covered: &[Range<usize>],
    claims: &mut Vec<(usize, String)>,
) {
    for found in NUMBER.find_iter(prose) {
        if overlaps_any(covered, &found.range()) {
            continue;
        }
        let Some(claimed) = claimed_number(prose, found.range()) else {
            continue;
        };
        let number: &str = &prose[claimed.clone()];
        if !sources.numbers.contains(&number_key(number)) {
            claims.push((claimed.start, number.to_owned()));
        }
    }
}

/// Der Teil des Treffers, der als Angabe zählt; `None` für Datum, Uhrzeit, Version, zu kurze Zahlen
/// und Treffer mitten in einem Wort.
fn claimed_number(prose: &str, matched: Range<usize>) -> Option<Range<usize>> {
    let raw: &str = &prose[matched.clone()];
    if GERMAN_DATE.is_match(raw.trim_end_matches(',')) {
        return None;
    }
    let number: &str = raw.trim_end_matches(['.', ',']);
    let range: Range<usize> = matched.start..matched.start + number.len();
    let digit_count: usize = number.chars().filter(char::is_ascii_digit).count();
    let is_version: bool = number.matches('.').count() >= 2 && !number.contains(',');
    if digit_count < MIN_NUMBER_DIGITS
        || is_version
        || is_clock_time(prose, &range)
        || !has_clean_edges(prose, &range)
    {
        return None;
    }
    Some(range)
}

/// `14:02` — vor der Zahl `zz:` oder nach ihr `:zz`.
fn is_clock_time(prose: &str, range: &Range<usize>) -> bool {
    let after: Vec<char> = prose[range.end..].chars().take(3).collect();
    let is_minutes_after: bool = matches!(
        after.as_slice(),
        [':', first, second] if first.is_ascii_digit() && second.is_ascii_digit()
    );
    let mut before = prose[..range.start].chars().rev();
    let is_hours_before: bool = before.next() == Some(':')
        && before
            .next()
            .is_some_and(|digit: char| digit.is_ascii_digit())
        && before
            .next()
            .is_some_and(|digit: char| digit.is_ascii_digit());
    is_minutes_after || is_hours_before
}

/// Das Zeichen davor ist kein Buchstabe, keine Ziffer, kein `_`, `.` oder `,`, das danach kein
/// Buchstabe, keine Ziffer, kein `_` — das `regex`-Paket kennt keine Lookarounds.
fn has_clean_edges(prose: &str, range: &Range<usize>) -> bool {
    let is_clean_before: bool =
        prose[..range.start]
            .chars()
            .next_back()
            .is_none_or(|before: char| {
                !(before.is_alphanumeric() || matches!(before, '_' | '.' | ','))
            });
    let is_clean_after: bool = prose[range.end..]
        .chars()
        .next()
        .is_none_or(|after: char| !(after.is_alphanumeric() || after == '_'));
    is_clean_before && is_clean_after
}

fn overlaps_any(ranges: &[Range<usize>], range: &Range<usize>) -> bool {
    ranges
        .iter()
        .any(|other: &Range<usize>| other.start < range.end && range.start < other.end)
}

/// Belegt, wenn der Dateiname in den Quellen vorkommt; mit Zeile zusätzlich, wenn die Zeilennummer
/// als Zahl vorkommt. Der Ordner zählt nicht: Werkzeuge nennen Pfade mal relativ, mal absolut.
fn is_path_sourced(raw: &str, sources: &Sources) -> bool {
    let (path, line): (&str, Option<&str>) = match LINE_SUFFIX.captures(raw) {
        Some(captures) => (
            &raw[..captures.get(0).map_or(raw.len(), |whole| whole.start())],
            captures.get(1).map(|digits| digits.as_str()),
        ),
        None => (raw, None),
    };
    let normalized: String = normalize(path);
    let file_name: &str = normalized.rsplit('/').next().unwrap_or_default();
    if file_name.is_empty() || !sources.mentions(file_name) {
        return false;
    }
    line.is_none_or(|digits: &str| sources.numbers.contains(&number_key(digits)))
}

/// Nur die Ziffern: `1.234,5`, `1,234.5` und `12345` sind dieselbe Angabe.
fn number_key(raw: &str) -> String {
    raw.chars().filter(char::is_ascii_digit).collect()
}

fn normalize(path: &str) -> String {
    path.replace('\\', "/").to_lowercase()
}

/// Entfernt Code-Blöcke mit Zaun (` ``` ` oder `~~~`); Inline-Code bleibt stehen. Ein nicht
/// geschlossener Block reicht bis zum Ende.
fn strip_fences(text: &str) -> String {
    let mut kept: Vec<&str> = Vec::new();
    // Zaunzeichen und Länge des offenen Blocks.
    let mut open_fence: Option<(char, usize)> = None;
    for line in text.lines() {
        let trimmed: &str = line.trim_start();
        let fence: Option<(char, usize)> = trimmed
            .chars()
            .next()
            .filter(|mark: &char| matches!(mark, '`' | '~'))
            .map(|mark: char| {
                (
                    mark,
                    trimmed.chars().take_while(|c: &char| *c == mark).count(),
                )
            })
            .filter(|(_, length): &(char, usize)| *length >= 3);
        match (open_fence, fence) {
            (None, Some(opening)) => open_fence = Some(opening),
            (None, None) => kept.push(line),
            (Some((mark, length)), Some((closing_mark, closing_length)))
                if closing_mark == mark
                    && closing_length >= length
                    && trimmed.trim_end_matches(mark).trim().is_empty() =>
            {
                open_fence = None;
            }
            (Some(_), _) => {}
        }
    }
    kept.join("\n")
}
