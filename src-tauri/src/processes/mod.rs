//! Kindprozesse der App; Plattformunterschiede beim Starten bleiben hier gekapselt.
use std::process::Command;

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
