# Findings — Sprachdiktat

Erkenntnisse aus der Umsetzung, getaggt nach Ziel-Phase:

```text
- [ ] → Phase N: <Erkenntnis>
```

- [ ] → Phase 1: Die Annahme „`WHISPER_DONT_GENERATE_BINDINGS=1` spart libclang“ trägt unter Windows nicht. whisper.cpp selbst übersetzt (CMake aus den VS-Build-Tools reicht), aber `whisper-rs-sys 0.15.0` liefert dann Bindings mit, die unter Linux erzeugt wurden; beim Übersetzen scheitert `cargo clippy` an drei Größenprüfungen (`_G_fpos_t`, `_G_fpos64_t`, `_IO_FILE`: `12 - 16`, `208 - 216` überlaufen, `bindings.rs:469/483/547`). Ohne die Env-Variable erzeugt `build.rs` die Bindings per bindgen (`build.rs:119`) und braucht dafür libclang (LLVM). Lokal ist kein libclang vorhanden (`LIBCLANG_PATH` leer, kein `C:\Program Files\LLVM`). Entschieden (Sascha): LLVM wird Bau-Voraussetzung (lokal und CI), `.cargo/config.toml` entfällt. Lokal per `winget install LLVM.LLVM` (23.1.2) installiert; danach war `cargo clean -p whisper-rs-sys` nötig, weil Cargo die Linux-Bindings aus dem Zwischenspeicher wiederverwendete. Doku-Nachzug (Phase 1): `linting.md` nennt LLVM statt nur CMake; CI-Schritt prüft auch `clang --version`; ob `windows-latest` LLVM mitbringt, entscheidet der erste CI-Lauf.
