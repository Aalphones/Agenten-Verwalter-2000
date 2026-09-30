# Sprachdiktat in der Eingabeleiste

Ziel: Ein Mikrofon-Knopf in der Eingabeleiste (Chat und „Neue Session“) nimmt Sprache auf und schreibt den erkannten Text an die Cursorposition in den Entwurf — gesendet wird nie automatisch. Die Erkennung läuft vollständig lokal mit Whisper (whisper.cpp) im Core; Netz braucht nur der einmalige Download des Sprachmodells. Vorbild für das Aussehen ist die Eingabeleiste der Claude-Code-Desktop-App (Screenshots von Sascha im Planungsgespräch, nicht im Repo — der Aufbau ist unten und in Phase 3 vollständig beschrieben; wer sie ablegen will, legt sie unter `artifacts/` ab).

Kontext für jeden Umsetzer: [AGENTS.md](../../../AGENTS.md), [docs/code-map.md](../../code-map.md), die Konventionen unter [docs/conventions/](../../conventions/), [ADR 009](../../decisions/009-sprachdiktat-lokal.md) (entsteht in Phase 1 aus „Festgelegte Entscheidungen“).

## Phasen

| # | Phase | Datei | Rating | Status |
|---|---|---|---|---|
| 1 | Core: Bau-Grundlage für whisper.cpp, Sprachmodell laden und prüfen | [phase-1-modell-core.md](phase-1-modell-core.md) | standard | pending |
| 2 | Core: Aufnahme, Pegel, Erkennung | [phase-2-aufnahme-erkennung.md](phase-2-aufnahme-erkennung.md) | heikel | pending |
| 3 | Oberfläche: Mikrofon-Knopf, Einrichten, Fehler, Doku-Abschluss | [phase-3-oberflaeche.md](phase-3-oberflaeche.md) | standard | pending |

Reihenfolge fest: 1 → 2 → 3. Umsetzung direkt auf `main`, ein Commit pro Phase, Commit-Scope `voice` (Phase 1 trägt ihn in [commits.md](../../conventions/commits.md) nach). Vor jedem Commit `pnpm check` grün; rustfmt und Clippy brauchen `cargo` im PATH (`$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"`), ab Phase 1 zusätzlich CMake (siehe Phase 1). Nach jeder Änderung an Typen über die Tauri-Grenze `pnpm bindings` und die erzeugten Dateien mitcommitten. Erkenntnisse während der Umsetzung nach [FINDINGS.md](FINDINGS.md).

## Festgelegte Entscheidungen

Phase 1 schreibt daraus ADR 009 „Sprachdiktat lokal mit Whisper“ (Kontext / betrachtete Optionen / Entscheidung / Konsequenzen). ADR 008 ist vom geparkten Plan „Kontext und Kontingent“ reserviert.

- **Erkennung lokal mit whisper.cpp über die Crate `whisper-rs` (0.16).** Betrachtet und verworfen: (a) Claudes eigene Diktierfunktion — sie existiert nur in der interaktiven Terminal-Oberfläche und der VS-Code-Erweiterung, Verwalter startet Claude ohne diese Oberfläche; der interne Dienst dahinter (`/api/ws/speech_to_text/voice_stream` in `claude.exe`) ist nicht dokumentiert, bräuchte die claude.ai-Anmeldung aus Claudes Anmeldedatei und bricht bei jedem Update still. (b) Web-Spracherkennung (`webkitSpeechRecognition`) — in WebView2 nicht verfügbar. (c) Windows-Spracheingabe (Win+H) per Knopf auslösen — Cloud, fremde Leiste über der App, Fehler für Verwalter unsichtbar.
- **Sprachmodell:** `ggml-large-v3-turbo-q5_0.bin`, 574 041 195 Bytes, SHA-256 `394221709cd5ad1f40c46e6031ca61bce88931e6e088c188294c6d5a55ffa7e2`, geladen von `https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-large-v3-turbo-q5_0.bin` (Adresse auf einen festen Stand gepinnt; Größe und Prüfsumme am 2026-09-29 per HEAD-Abfrage gemessen). Abgelegt unter `<Benutzerordner>\.verwalter\models\ggml-large-v3-turbo-q5_0.bin`. Nicht im Installer. Der Download startet nur auf Klick („Einrichten“), nie von selbst.
- **Nur CPU.** Keine GPU-Features (`cuda`, `vulkan`) — die brauchen CUDA-Toolkit bzw. Vulkan-SDK beim Bau, lokal und in der CI. Ist die Erkennung zu langsam (Abnahmekriterium 4 unten), wird Vulkan ein Folgeplan, nicht ein Umbau hier.
- **Aufnahme im Core mit `cpal` (0.18)** über WASAPI vom Standard-Eingabegerät, nicht im WebView (`getUserMedia`) — so gibt es keinen Rechte-Dialog des WebView und die Tauri-Grenze trägt keine Audiodaten. Umrechnung auf 16 kHz mono f32 mit einer eigenen kleinen Funktion (Mittelwert der Kanäle, dann lineare Interpolation) statt einer Resampling-Crate — für Spracherkennung genügt das.
- **Sprache fest Deutsch** (`language = "de"`). Als Erkennungshilfe (`initial_prompt`) gehen die Repository-Namen der Session plus eine feste Wortliste mit (siehe Phase 2). Eine Einstellung dafür kommt nicht in diesen Plan.
- **Bedienung wie in Claude Code (Tap-Modus):** Klick startet, zweiter Klick stoppt und erkennt; Esc bricht Aufnahme oder Erkennung ab und verwirft sie, ohne die Session zu pausieren. Tastenkürzel `Strg+M` (bisher frei) schaltet dasselbe um, solange das Eingabefeld den Fokus hat. Aufnahme endet automatisch nach 120 s (Grenze wie in Claude Code). Der Text wird eingefügt, nie gesendet.
- **Ein Mikrofon, eine Aufnahme:** app-weit höchstens eine Aufnahme oder Erkennung gleichzeitig; ein zweiter Start liefert `voiceBusy`.
- **Modell bleibt geladen:** das Whisper-Modell wird beim ersten `voice_start` im Hintergrund geladen und bleibt bis zum App-Ende im Speicher (rund 0,8 GB Arbeitsspeicher, Schätzung — Phase 2 misst).
- **Name:** Feature `voice` in allen Schichten nach dem Namensschema der Code-Map. In der Oberfläche heißt es „Diktieren“, das Modell „Sprachmodell“.

## Kontrakt

### Typen (Rust, `derive(Debug, Clone, Serialize, TS)`, `serde(rename_all = "camelCase")`, in `gen-bindings.rs` eintragen)

`src-tauri/src/voice/model.rs`:

```rust
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum VoiceModelState {
    Missing,
    /// Bytes als f64, damit TypeScript `number` statt `bigint` bekommt.
    Downloading { received_bytes: f64, total_bytes: f64 },
    Ready,
}
pub struct VoiceModelEvent {
    pub state: VoiceModelState,
    /// Nur beim Wechsel nach `Missing` wegen eines fehlgeschlagenen Downloads gesetzt
    /// (Text = `CommandError::VoiceDownload(..).to_string()`); bei Abbruch durch den Nutzer `None`.
    pub error: Option<String>,
}
/// Pegel 0.0 bis 1.0 (RMS der letzten ~50 ms, siehe Phase 2).
pub struct VoiceLevelEvent { pub level: f32 }
```

### Neue Fehler-Varianten in `CommandError` (`src-tauri/src/error.rs`)

| Variante | `#[error(...)]` | wann |
|---|---|---|
| `VoiceModelMissing` | `Sprachmodell fehlt` | `voice_start` ohne fertiges Modell |
| `VoiceBusy` | `Es läuft schon ein Diktat` | zweiter Start, oder Download während einer laufenden Aufnahme |
| `Microphone(String)` | `Mikrofon: {0}` | kein Eingabegerät, Zugriff verweigert, Gerät verschwunden |
| `NoAudio` | `Kein Ton vom Mikrofon` | Aufnahme komplett still (Spitzenwert < 0,001) |
| `NoSpeech` | `Keine Sprache erkannt` | Erkennung liefert leeren Text |
| `VoiceCancelled` | `Diktat abgebrochen` | `voice_stop` nach `voice_cancel` |
| `VoiceDownload(String)` | `Download: {0}` | Netzfehler, HTTP-Fehlerstatus, Prüfsumme falsch |

### Commands (`src-tauri/src/commands/voice.rs`, alle `async`, Wrapper in `src/lib/voice.ts`)

| Command | Parameter | Rückgabe | Wrapper | Phase |
|---|---|---|---|---|
| `voice_model_status` | — | `VoiceModelState` | `loadVoiceModelState()` | 1 |
| `voice_model_download` | — | `()` — startet den Download im Hintergrund; läuft schon einer → `()` ohne zweiten | `downloadVoiceModel()` | 1 |
| `voice_model_cancel_download` | — | `()` | `cancelVoiceModelDownload()` | 1 |
| `voice_start` | `sessionId: string \| null` | `()` | `startDictation(sessionId)` | 2 |
| `voice_stop` | — | `string` (erkannter Text, getrimmt) — kehrt erst nach der Erkennung zurück | `stopDictation()` | 2 |
| `voice_cancel` | — | `()` — ohne laufendes Diktat kein Fehler | `cancelDictation()` | 2 |

### Ereignisse (Konstanten in `src-tauri/src/voice/mod.rs`, Abo-Funktionen in `src/lib/voice.ts`)

| Ereignis | Nutzlast | wann | Abo | Phase |
|---|---|---|---|---|
| `voice://model` | `VoiceModelEvent` | jeder Zustandswechsel des Modells; während des Downloads höchstens alle 250 ms | `onVoiceModel(handler)` | 1 |
| `voice://level` | `VoiceLevelEvent` | während der Aufnahme alle ~50 ms | `onVoiceLevel(handler)` | 2 |

## Finale Abnahmekriterien

1. Ohne Sprachmodell zeigt ein Klick auf das Mikrofon „Diktieren einrichten“ mit Größe (574 MB) und dem Hinweis „danach ohne Internet“; nach „Herunterladen“ läuft ein Fortschritt in Prozent, „Abbrechen“ stoppt und hinterlässt keine Datei. Nach Abschluss ist das Mikrofon sofort nutzbar.
2. Klick auf das Mikrofon in einer Session: Knopf wird blau gefüllt, links daneben bewegen sich drei Pegelbalken mit der Stimme, Tooltip „Aufnahme beenden“. Zweiter Klick: die Balken weichen einem „Erkenne …“-Hinweis, danach steht der gesprochene Text an der Cursorposition im Entwurf. Nichts wird gesendet.
3. Dasselbe funktioniert im Feld „Was soll erledigt werden?“ von „Neue Session“.
4. Ein deutscher Satz von ~10 s mit Fachbegriffen („Bitte refactor den Composer und leg einen neuen Branch an“) erscheint innerhalb von 5 s nach dem Stoppen, in lesbarer Rechtschreibung. Das erste Diktat nach App-Start darf 3 s länger dauern (Modell laden).
5. Esc während Aufnahme oder Erkennung bricht ab, der Entwurf bleibt wie vorher, die Session wird **nicht** pausiert.
6. Mikrofon aus/verweigert (Windows: Datenschutz → Mikrofon → Desktop-Apps aus) → verständlicher Fehlersatz unter der Eingabeleiste mit Hinweis, wo man den Zugriff einschaltet; die App hängt nicht.
7. Stille Aufnahme → „Kein Ton vom Mikrofon“; Geräusch ohne Worte → „Keine Sprache erkannt“, kein erfundener Text im Entwurf.
8. `pnpm check` grün, lokal und in der GitHub-Prüfung (`check.yml`).

## Smoke-Checkliste

Wackelstellen zuerst:

1. **Erkennungsdauer (AK 4):** 10-s-Satz diktieren, Zeit vom Klick auf Stopp bis Text messen, dreimal. Über 5 s → in FINDINGS notieren, Vulkan-Folgeplan.
2. **Halluzination bei Stille:** 5 s nichts sagen, stoppen → Fehlersatz, **kein** Text wie „Untertitel im Auftrag des ZDF“ oder „Vielen Dank.“ im Entwurf.
3. **Esc-Konflikt:** während der Agent arbeitet (Status „running“) diktieren und Esc drücken → nur das Diktat bricht ab, der Agent arbeitet weiter.
4. **Bau auf frischem Rechner / CI:** GitHub-Prüfung des Phase-1-Commits grün.
5. Mikrofon-Zugriff in Windows aus → Fehlersatz; wieder an → funktioniert ohne App-Neustart.
6. Download abbrechen und neu starten; Netzwerk während des Downloads trennen → Fehlersatz, danach „Herunterladen“ wieder möglich, keine Reste unter `.verwalter\models\` außer der fertigen Datei.
7. Zwei Sessions: Diktat in A läuft → Mikrofon in B (nach Wechsel) ist gesperrt mit Tooltip „Diktat läuft in einer anderen Eingabe“.
8. 120 s durchreden → Aufnahme stoppt von selbst und erkennt.
9. Text mitten in einen bestehenden Entwurf diktieren (Cursor in der Mitte) → eingefügt mit genau einem Leerzeichen davor und danach, wo nötig.
10. Hell- und Dunkelmodus: Pegelbalken und blauer Knopf gut sichtbar.

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups
