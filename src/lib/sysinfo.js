// v8.7 — real system metrics, desktop only.
//
// On the Tauri desktop build we invoke the Rust `system_info` command
// (backed by the `sysinfo` crate) for true CPU %, RAM usage, and core count.
// On the web there's no OS access, so getSystemInfo() returns null and the
// System Info widget falls back to its simulated numbers.

export function isDesktop() {
  return typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
}

// Returns { cpu, memUsed, memTotal, cores } on desktop, or null everywhere
// else (and on any error — the caller treats null as "use simulated data").
export async function getSystemInfo() {
  if (!isDesktop()) return null;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke("system_info");
  } catch {
    return null;
  }
}
