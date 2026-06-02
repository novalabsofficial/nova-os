// Native host control — desktop (Tauri) only. On the Nova Linux desktop
// session these reach real systemd (via the Rust commands in
// src-tauri/src/lib.rs) to power off / restart the machine, and report whether
// Nova OS was launched as the kiosk session. Everywhere else (web, PWA,
// Android) they no-op, because a sandboxed browser/app has no right to touch
// the host. The @tauri-apps import is lazy so the web bundle pulls in nothing.

export function isDesktop() {
  return typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
}

async function call(cmd) {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke(cmd);
}

/** Power off the host machine. Returns true if the command was dispatched. */
export async function powerOff() {
  if (!isDesktop()) return false;
  try { await call("power_off"); return true; } catch { return false; }
}

/** Reboot the host machine. Returns true if the command was dispatched. */
export async function restartMachine() {
  if (!isDesktop()) return false;
  try { await call("restart_machine"); return true; } catch { return false; }
}

/** True when launched as the Nova Linux kiosk session (NOVA_KIOSK set). */
export async function isKioskSession() {
  if (!isDesktop()) return false;
  try { return !!(await call("kiosk_mode")); } catch { return false; }
}

/** Quit the desktop (Tauri) app by closing its window. No-op off Tauri. */
export async function quitApp() {
  if (!isDesktop()) return false;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().close();
    return true;
  } catch { return false; }
}
