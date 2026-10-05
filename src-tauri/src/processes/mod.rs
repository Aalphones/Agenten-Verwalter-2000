//! Kindprozesse der App; Plattformunterschiede beim Starten bleiben hier gekapselt.
use std::process::Command;
#[cfg(not(windows))]
use std::process::Stdio;

/// Unterdrückt das Konsolenfenster, das Windows für jeden Kindprozess einer GUI-App öffnet.
pub fn hide_console(command: &mut Command) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    #[cfg(not(windows))]
    {
        let _ = command;
    }
}

/// Gegenstück zu `hide_console`: Unter Windows bekommt der Kindprozess ein eigenes sichtbares
/// Konsolenfenster (für Programme, die dem Nutzer etwas anzeigen oder von ihm lesen). Anderswo gibt
/// es kein Fenster, die Ein- und Ausgaben gehen ins Leere.
pub fn show_console(command: &mut Command) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NEW_CONSOLE: u32 = 0x0000_0010;
        command.creation_flags(CREATE_NEW_CONSOLE);
    }
    #[cfg(not(windows))]
    {
        command
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null());
    }
}
