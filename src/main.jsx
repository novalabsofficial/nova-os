// Thin boot loader.
//
// The real app — and its entire static-import graph — lives in ./boot.jsx, which
// we load via a DYNAMIC import wrapped in .catch(). This is deliberate:
//
//   When a module throws at evaluation/parse time under the Tauri custom
//   protocol (tauri://), WebKitGTK reports it to window.onerror as a
//   cross-origin-masked "Script error." — no message, no stack, useless. (That's
//   the masked boot error chased for ages in NOVA-LINUX-PROGRESS.md.)
//
//   A dynamic import() does NOT go through that path: if the imported module (or
//   anything it statically imports) throws while evaluating, the returned promise
//   REJECTS with the actual Error object — full message + stack — which we catch
//   and paint to the screen. So a boot-time failure now shows its REAL cause
//   instead of "Script error.".
//
// Keep this file tiny and dependency-free: it must never be the thing that throws.

function paintBootError(detail) {
  try {
    var el = document.getElementById('nova-boot-err');
    if (!el) {
      el = document.createElement('pre');
      el.id = 'nova-boot-err';
      el.style.cssText = 'position:fixed;inset:0;z-index:2147483647;margin:0;padding:16px;background:#0a0c16;color:#ff8a8a;font:12px/1.5 ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap;word-break:break-word;overflow:auto;';
      (document.body || document.documentElement).appendChild(el);
    }
    el.textContent += 'Nova OS failed to boot — real error:\n' + detail + '\n\n';
  } catch (_) { /* last-resort: nothing more we can do */ }
}

import('./boot.jsx').catch(function (e) {
  paintBootError((e && (e.stack || e.message)) ? (e.stack || e.message) : String(e));
});
