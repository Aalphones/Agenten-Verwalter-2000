//! Freigaben und Sandbox je Modus (ADR 031): was Codex ohne Rückfrage darf und wohin es schreiben
//! darf. Die Zuordnung steht im Plan unter „Modi → Codex-Freigaben“.
use std::path::{Path, PathBuf};

use serde_json::{Value, json};

use crate::agents::event::Mode;
use crate::standalone::paths;

/// Codex-Werte der Freigaben (`AskForApproval`) und des Prüfers (`ApprovalsReviewer`).
const APPROVAL_UNTRUSTED: &str = "untrusted";
const APPROVAL_ON_REQUEST: &str = "on-request";
const REVIEWER_USER: &str = "user";
const REVIEWER_AUTO: &str = "auto_review";
/// `SandboxMode` für `thread/start`, `SandboxPolicy.type` für `turn/start`.
const SANDBOX_MODE_READ_ONLY: &str = "read-only";
const SANDBOX_MODE_WORKSPACE_WRITE: &str = "workspace-write";
const SANDBOX_POLICY_READ_ONLY: &str = "readOnly";
const SANDBOX_POLICY_WORKSPACE_WRITE: &str = "workspaceWrite";

/// Manuell fragt vor jedem Befehl; die übrigen Modi fragen nur, wenn Codex selbst es für nötig hält.
pub fn approval_policy(mode: Mode) -> &'static str {
    if mode == Mode::Manual {
        APPROVAL_UNTRUSTED
    } else {
        APPROVAL_ON_REQUEST
    }
}

/// Im Auto-Modus entscheidet Codex' eigener Prüfer statt des Benutzers — das Gegenstück zum
/// Sicherheits-Klassifizierer der Claude-Kommandozeile.
pub fn approvals_reviewer(mode: Mode) -> &'static str {
    if mode == Mode::Auto {
        REVIEWER_AUTO
    } else {
        REVIEWER_USER
    }
}

/// Die grobe Sandbox für `thread/start`; die Ordner liefert erst `turn_policy`.
pub fn sandbox_mode(mode: Mode) -> &'static str {
    if mode == Mode::Plan {
        SANDBOX_MODE_READ_ONLY
    } else {
        SANDBOX_MODE_WORKSPACE_WRITE
    }
}

/// Die Felder für `turn/start`. Neu berechnet vor jedem Turn: ein Ticket-Worktree, den der Agent
/// erst im Gespräch anlegt, ist so ab der nächsten Nachricht beschreibbar.
pub fn turn_policy(
    mode: Mode,
    cwd: &Path,
    add_dirs: &[PathBuf],
    scratchpad: &Path,
    allowed_rules: &[String],
) -> Value {
    json!({
        "approvalPolicy": approval_policy(mode),
        "approvalsReviewer": approvals_reviewer(mode),
        "sandboxPolicy": sandbox_policy(mode, cwd, add_dirs, scratchpad, allowed_rules),
    })
}

fn sandbox_policy(
    mode: Mode,
    cwd: &Path,
    add_dirs: &[PathBuf],
    scratchpad: &Path,
    allowed_rules: &[String],
) -> Value {
    if mode == Mode::Plan {
        return json!({ "type": SANDBOX_POLICY_READ_ONLY });
    }
    let roots = writable_roots(cwd, add_dirs, scratchpad, allowed_rules);
    // Netzzugriff immer an: Paketinstallation und `git push` laufen sonst in die Sandbox.
    json!({
        "type": SANDBOX_POLICY_WORKSPACE_WRITE,
        "writableRoots": roots,
        "networkAccess": true,
    })
}

/// Arbeitsordner, `--add-dir`-Ordner, Scratchpad und vorhandene Ticket-Worktrees — nur Ordner, die
/// es gibt, weil Codex einen fehlenden beschreibbaren Ordner nicht anlegt.
fn writable_roots(
    cwd: &Path,
    add_dirs: &[PathBuf],
    scratchpad: &Path,
    allowed_rules: &[String],
) -> Vec<String> {
    let mut candidates: Vec<PathBuf> = vec![paths::resolve(cwd, &cwd.to_string_lossy())];
    candidates.extend(
        add_dirs
            .iter()
            .map(|dir: &PathBuf| paths::resolve(cwd, &dir.to_string_lossy())),
    );
    if !scratchpad.as_os_str().is_empty() {
        candidates.push(paths::resolve(cwd, &scratchpad.to_string_lossy()));
    }
    candidates.extend(paths::existing_ticket_worktrees(allowed_rules));
    let mut roots: Vec<String> = Vec::new();
    for candidate in candidates {
        let root = candidate.to_string_lossy().into_owned();
        if candidate.is_dir() && !roots.contains(&root) {
            roots.push(root);
        }
    }
    roots
}
