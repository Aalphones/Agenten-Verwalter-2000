use tauri::AppHandle;

use crate::agents::event::{Effort, ModelId};
use crate::error::CommandError;
use crate::implementation::model::{
    ImplementationView, InquiryCreated, PhaseView, StationState, StationView,
};
use crate::implementation::{self, announce, announce_removed, changes, now_ms, start};
use crate::sessions::registry::SessionRegistry;

/// Alle Umsetzungen nicht archivierter Vorhaben, neueste zuerst (ADR 048). `async`, damit die
/// Datenbank nicht auf dem Haupt-Thread gelesen wird.
#[tauri::command]
pub async fn implementation_list(
    registry: tauri::State<'_, SessionRegistry>,
) -> Result<Vec<ImplementationView>, CommandError> {
    registry.implementation_views()
}

/// Der Lagebericht als Text, wie der Agent ihn über `implementation_get` bekommt.
#[tauri::command]
pub async fn implementation_report(
    registry: tauri::State<'_, SessionRegistry>,
    id: String,
) -> Result<String, CommandError> {
    let view = registry.implementation_view(&id)?;
    Ok(registry.report_text(&view, false, now_ms()))
}

/// „Neue Rückfrage“: eine frische Session im Vorhaben mit dem Lagebericht als Anhang (ADR 048).
#[tauri::command]
pub async fn implementation_new_inquiry(
    app: AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    id: String,
) -> Result<InquiryCreated, CommandError> {
    registry.new_inquiry(&app, &id)
}

/// Benennt die Umsetzung um, wie der Nutzer es will.
#[tauri::command]
pub async fn implementation_rename(
    app: AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    id: String,
    name: String,
) -> Result<(), CommandError> {
    registry.rename_implementation(&id, &name)?;
    announce(&app, &registry.implementation_view(&id)?);
    Ok(())
}

/// Schaltet „Automatisch weiter“. Aus: laufende Countdowns enden. An: Stationen, die starten
/// dürfen, bekommen einen Countdown.
#[tauri::command]
pub async fn implementation_set_auto_start(
    app: AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    id: String,
    enabled: bool,
) -> Result<(), CommandError> {
    let view = registry.implementation_view(&id)?;
    registry.store_implementation_flags(&id, enabled, view.stop_after_current, view.finished_at)?;
    if enabled {
        start::schedule_ready(&app, &id)?;
    } else {
        for station in view
            .phases
            .iter()
            .flat_map(|phase: &PhaseView| phase.stations.iter())
        {
            let _ = registry.cancel_countdown(&station.id);
        }
    }
    announce(&app, &registry.implementation_view(&id)?);
    Ok(())
}

/// „Anhalten nach dieser Session“: die nächste Fertigmeldung startet nichts mehr.
#[tauri::command]
pub async fn implementation_set_stop_after_current(
    app: AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    id: String,
    enabled: bool,
) -> Result<(), CommandError> {
    let view = registry.implementation_view(&id)?;
    registry.store_implementation_flags(&id, view.auto_start, enabled, view.finished_at)?;
    announce(&app, &registry.implementation_view(&id)?);
    Ok(())
}

/// ▶: startet die Station sofort, auch mit laufendem Countdown.
#[tauri::command]
pub async fn implementation_start_station(
    app: AppHandle,
    id: String,
    station_id: String,
) -> Result<(), CommandError> {
    start::start_now(&app, &id, &station_id)
}

/// „Abbrechen“: der Countdown endet, die Station bleibt bereit.
#[tauri::command]
pub async fn implementation_cancel_countdown(
    app: AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    id: String,
    station_id: String,
) -> Result<(), CommandError> {
    let _ = registry.cancel_countdown(&station_id);
    announce(&app, &registry.implementation_view(&id)?);
    Ok(())
}

/// Ändert Modell und Denkaufwand einer Station, die noch keine Session hat (ADR 057). Danach
/// zeigt die Karte den neuen Plan.
#[tauri::command]
pub async fn implementation_set_station_plan(
    app: AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    id: String,
    station_id: String,
    model: Option<ModelId>,
    effort: Option<Effort>,
) -> Result<(), CommandError> {
    let view = registry.implementation_view(&id)?;
    let station: &StationView = view
        .phases
        .iter()
        .flat_map(|phase: &PhaseView| phase.stations.iter())
        .find(|station: &&StationView| station.id == station_id)
        .ok_or_else(|| {
            CommandError::Implementation("Diese Station gehört nicht zur Umsetzung.".to_owned())
        })?;
    if station.by_user {
        return Err(CommandError::Implementation(
            "Diese Station erledigst du selbst.".to_owned(),
        ));
    }
    if station.session_id.is_some() || station.state == StationState::Done {
        return Err(CommandError::Implementation(
            "Die Station hat schon begonnen.".to_owned(),
        ));
    }
    registry.set_station_plan(&station_id, model, effort)?;
    announce(&app, &registry.implementation_view(&id)?);
    Ok(())
}

/// „Übernehmen“ oder „Verwerfen“ des Vorschlags „Plan ändern?“.
#[tauri::command]
pub async fn implementation_apply_change(
    app: AppHandle,
    id: String,
    accept: bool,
) -> Result<(), CommandError> {
    changes::decide(&app, &id, accept)
}

/// „Abbrechen…“ (ADR 060): danach lässt sich im Vorhaben eine neue Umsetzung anlegen.
#[tauri::command]
pub async fn implementation_cancel(
    app: AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    id: String,
) -> Result<ImplementationView, CommandError> {
    let view = registry.cancel_implementation(&id)?;
    announce(&app, &view);
    Ok(view)
}

/// „Löschen…“ einer abgebrochenen oder nie gestarteten Umsetzung (ADR 060).
#[tauri::command]
pub async fn implementation_delete(
    app: AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    id: String,
) -> Result<(), CommandError> {
    registry.delete_implementation(&app, &id)?;
    announce_removed(&app, &id);
    Ok(())
}

/// „Bestätigen“ der Anfrage eines Agenten: abbrechen, bei `delete` danach löschen; `None` nach dem
/// Löschen. Scheitert es, bleibt die Anfrage liegen — außer die Umsetzung ist inzwischen regulär
/// fertig, dann gibt es nichts mehr abzubrechen.
#[tauri::command]
pub async fn implementation_apply_cancel(
    app: AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    id: String,
) -> Result<Option<ImplementationView>, CommandError> {
    let view = registry.implementation_view(&id)?;
    let Some(pending) = view.pending_cancel else {
        return Err(CommandError::Implementation(
            "Es liegt keine Anfrage zum Abbrechen vor.".to_owned(),
        ));
    };
    if view.finished_at.is_some() {
        let fresh = registry.discard_cancel(&id)?;
        announce(&app, &fresh);
        return Err(CommandError::Implementation(
            "Umsetzung ist schon abgeschlossen.".to_owned(),
        ));
    }
    let cancelled = registry.cancel_implementation(&id)?;
    announce(&app, &cancelled);
    if !pending.delete {
        return Ok(Some(cancelled));
    }
    registry.delete_implementation(&app, &id)?;
    announce_removed(&app, &id);
    Ok(None)
}

/// „Verwerfen“ der Anfrage: alles wie vorher, die Stationen werden neu geplant.
#[tauri::command]
pub async fn implementation_discard_cancel(
    app: AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    id: String,
) -> Result<ImplementationView, CommandError> {
    let view = registry.discard_cancel(&id)?;
    announce(&app, &view);
    changes::schedule_if_running(&app, &view)?;
    registry.implementation_view(&id)
}

/// „Erledigt“ für eine Station des Benutzers.
#[tauri::command]
pub async fn implementation_complete_station(
    app: AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    id: String,
    station_id: String,
    result: String,
) -> Result<(), CommandError> {
    let view = registry.implementation_view(&id)?;
    let is_by_user: bool = view
        .phases
        .iter()
        .flat_map(|phase: &PhaseView| phase.stations.iter())
        .any(|station: &StationView| station.id == station_id && station.by_user);
    if !is_by_user {
        return Err(CommandError::Implementation(
            "Diese Station meldet der Agent selbst.".to_owned(),
        ));
    }
    implementation::complete_station(&app, &id, &station_id, &result, false)?;
    Ok(())
}
