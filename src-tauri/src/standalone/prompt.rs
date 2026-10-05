//! Systemprompt des Agenten.
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

const SECONDS_PER_DAY: u64 = 86_400;

pub fn system_prompt(cwd: &Path) -> String {
    format!(
        "You are a coding agent running inside Agenten Verwalter 2000 on Windows. \
         Working directory: {}. Today: {}.",
        cwd.display(),
        today()
    )
}

/// Heutiges Datum (UTC) als `YYYY-MM-DD`.
fn today() -> String {
    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |elapsed| elapsed.as_secs());
    let (year, month, day) = civil_from_days(seconds / SECONDS_PER_DAY);
    format!("{year:04}-{month:02}-{day:02}")
}

/// Tage seit 1970-01-01 → (Jahr, Monat, Tag) im gregorianischen Kalender; Verfahren nach
/// Howard Hinnant („civil_from_days“), hier nur für Tage ab 1970.
fn civil_from_days(days: u64) -> (u64, u64, u64) {
    let shifted = days + 719_468;
    let era = shifted / 146_097;
    let day_of_era = shifted - era * 146_097;
    let year_of_era =
        (day_of_era - day_of_era / 1460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_index = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * month_index + 2) / 5 + 1;
    let month = if month_index < 10 {
        month_index + 3
    } else {
        month_index - 9
    };
    let year = year_of_era + era * 400 + u64::from(month <= 2);
    (year, month, day)
}
