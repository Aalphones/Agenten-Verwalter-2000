// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.get(1).map(String::as_str) == Some(verwalter_lib::standalone::SUBCOMMAND) {
        std::process::exit(verwalter_lib::standalone::run(args[2..].to_vec()));
    }
    verwalter_lib::run()
}
