// v8.7 — real system metrics for the System Info widget (desktop build only;
// the web build keeps its simulated numbers). Creates a fresh System, samples
// CPU twice across the minimum interval so the usage delta is valid, then
// reports the global CPU percent + memory (bytes) + logical core count.
#[tauri::command]
fn system_info() -> serde_json::Value {
  use sysinfo::System;
  let mut sys = System::new_all();
  sys.refresh_cpu_usage();
  std::thread::sleep(sysinfo::MINIMUM_CPU_UPDATE_INTERVAL);
  sys.refresh_cpu_usage();
  sys.refresh_memory();
  serde_json::json!({
    "cpu": sys.global_cpu_usage(),
    "memUsed": sys.used_memory(),
    "memTotal": sys.total_memory(),
    "cores": sys.cpus().len(),
  })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    // v7.0.3: shell plugin enables shell.open() in the JS layer, which
    // delegates to the OS's "open URL with default app" handler. Used by
    // openExternalUrl() in src/lib/openUrl.js for un-iframable sites.
    .plugin(tauri_plugin_shell::init())
    .invoke_handler(tauri::generate_handler![system_info])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
