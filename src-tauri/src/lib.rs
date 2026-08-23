// The Rust side is deliberately empty of business logic. All the ledger rules live in
// src/lib/workbook.js so the desktop build and the browser build cannot disagree; Rust
// only provides the window, the file dialog and filesystem access.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running FinanceOS");
}
