use tauri::Manager;

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

// v10.5 — Nova Linux host power control. Only meaningful when Nova OS is the
// Linux desktop session (Tauri). A logged-in local session is allowed to
// poweroff/reboot via systemd-logind without root, so we just shell out to
// `systemctl`. Errors bubble back to the JS caller. No-ops/errors harmlessly
// on platforms without systemctl (the button that calls these is only shown in
// the Nova Linux kiosk anyway).
#[tauri::command]
fn power_off() -> Result<(), String> {
  log::info!("power_off requested (systemctl poweroff)");
  std::process::Command::new("systemctl")
    .arg("poweroff")
    .spawn()
    .map(|_| ())
    .map_err(|e| {
      log::error!("power_off failed: {e}");
      e.to_string()
    })
}

#[tauri::command]
fn restart_machine() -> Result<(), String> {
  log::info!("restart_machine requested (systemctl reboot)");
  std::process::Command::new("systemctl")
    .arg("reboot")
    .spawn()
    .map(|_| ())
    .map_err(|e| {
      log::error!("restart_machine failed: {e}");
      e.to_string()
    })
}

// True when launched as the Nova Linux kiosk session (the autostart exports
// NOVA_KIOSK / NOVA_LITE). The frontend uses this to switch into lite mode and
// reveal the host power controls.
#[tauri::command]
fn kiosk_mode() -> bool {
  std::env::var("NOVA_KIOSK").is_ok() || std::env::var("NOVA_LITE").is_ok()
}

// Bridge for the frontend logger (src/lib/log.js): the webview forwards its log
// lines here so UI-side boot breadcrumbs + uncaught errors land in the SAME
// place as the Rust logs — stdout AND the on-disk log file (tauri-plugin-log).
// This is the primary troubleshooting channel for the Nova Linux build.
#[tauri::command]
fn js_log(level: String, msg: String) {
  match level.as_str() {
    "error" => log::error!("[ui] {msg}"),
    "warn" => log::warn!("[ui] {msg}"),
    "debug" => log::debug!("[ui] {msg}"),
    _ => log::info!("[ui] {msg}"),
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    // v7.0.3: shell plugin enables shell.open() in the JS layer, which
    // delegates to the OS's "open URL with default app" handler. Used by
    // openExternalUrl() in src/lib/openUrl.js for un-iframable sites.
    .plugin(tauri_plugin_shell::init())
    .invoke_handler(tauri::generate_handler![
      system_info,
      power_off,
      restart_machine,
      kiosk_mode,
      js_log
    ])
    .setup(|app| {
      // Logging — enabled in ALL builds (was debug-only). The default targets
      // write to stdout, the webview console, AND a rotating file in the app's
      // log dir (~/.local/share/com.novalabsofficial.novaos/logs/). This is the
      // PRIMARY troubleshooting channel for the Nova Linux build; the frontend
      // forwards its own logs here too via the js_log command. See README
      // "Logging & troubleshooting".
      app.handle().plugin(
        tauri_plugin_log::Builder::default()
          .level(log::LevelFilter::Info)
          .build(),
      )?;

      let kiosk = std::env::var("NOVA_KIOSK").is_ok() || std::env::var("NOVA_LITE").is_ok();
      log::info!("Nova OS native shell starting — kiosk session = {kiosk}");

      // v10.5 — Nova Linux kiosk session: drop the window chrome and go
      // fullscreen so Nova OS owns the whole screen. No effect on the normal
      // windowed desktop build, where NOVA_KIOSK is unset.
      if kiosk {
        match app.get_webview_window("main") {
          Some(win) => {
            let _ = win.set_decorations(false);
            let _ = win.set_fullscreen(true);
            log::info!("kiosk: applied fullscreen + removed window decorations on 'main'");
          }
          None => log::warn!("kiosk: no 'main' webview window found to fullscreen"),
        }
      }
      log::info!("setup complete — handing off to the webview");
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
