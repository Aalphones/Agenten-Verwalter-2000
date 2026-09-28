//! Erzeugt die TypeScript-Typen in src/lib/bindings/. Aufruf: `pnpm bindings`.
use ts_rs::{Config, TS};
use verwalter_lib::{commands::app::AppInfo, error::CommandError};

fn main() -> Result<(), ts_rs::ExportError> {
    let cfg =
        Config::new().with_out_dir(concat!(env!("CARGO_MANIFEST_DIR"), "/../src/lib/bindings"));
    AppInfo::export_all(&cfg)?;
    CommandError::export_all(&cfg)?;
    Ok(())
}
