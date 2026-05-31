# Nova Linux — Progress, Decisions & Resume Playbook

> Companion to **`NOVA-LINUX.md`** (the long-term architecture vision).
> This file is the *working log*: where we actually got to, every decision we
> made, the hard-won gotchas, and an exact checklist to pick the work back up.
> Last updated: **2026-05-30**.

---

## 0. TL;DR — current state

We set out to ship **Nova Linux**: a bootable Linux distro that launches Nova OS
as its desktop. We have two ISO flavors:

| ISO | Shell | Status |
|-----|-------|--------|
| **Firefox-kiosk** (`nova-linux-v2`) | Nova OS web app in `firefox --kiosk` | ✅ Rock-solid in a VM. Fallback only. |
| **Tauri** (`nova-linux-tauri`) | Nova OS as a **native Tauri app** (`/usr/bin/app`) | ✅ Built, baked, **proven to render** — but blocked in VirtualBox (see §2). |

**The Tauri app works** — it rendered Nova OS fully in `tauri dev`. The *only*
thing blocking it is that **VirtualBox has no real GPU**, and Tauri's renderer
(WebKitGTK) needs one. That's an environment limit, not a code bug.

**Decision (this is the important part):** we are **keeping the Tauri ISO as the
canonical Nova Linux build.** We are **not** settling for the Firefox version.
The plan is to run the Tauri ISO where it actually works → **VMware first, real
laptop if needed** (§3).

### Update — 2026-05-31: VMware renders it, but the native bridge is down
- ✅ **VMware Workstation Pro (3D acceleration ON) renders Nova OS reliably.** The
  rendering problem is solved — VMware is now the dev/test environment, not
  VirtualBox. (Setup: WHP checkbox during install since the host has Hyper-V/VBS;
  VM = 8 GB RAM / 4 CPU / 3D accel on / boot the Tauri ISO live.)
- ⚠️ **But the Tauri JS↔Rust bridge isn't connecting in the booted build.**
  Three symptoms, all gated on `isDesktop()`/`isTauri()` (the
  `__TAURI_INTERNALS__` global): **no Shut Down button**, **Browser falls back to
  the iframe** ("can't be embedded"), and lite mode is URL-driven only.
- **Prime suspect — the `?kiosk=1` reload in `src/main.jsx`.** Its own guard
  requires `__TAURI_INTERNALS__` to be present *to fire the reload* — so the
  bridge IS there on first load, then the client-side `location.replace` reload
  **drops it** (WebKitGTK on Linux doesn't re-inject the IPC after that
  navigation). That reload, added only for lite mode, is sabotaging every native
  feature.
- **Fix plan:** remove the reload; activate lite mode synchronously *without
  navigating* — inject a `window.__NOVA_KIOSK__` flag from Rust (`lib.rs` init
  script) or have Rust load the webview URL with `?kiosk=1` already appended, and
  have `lite.js` read it. Verify in the workshop VM with `tauri dev` + devtools
  (confirm `window.__TAURI_INTERNALS__` survives).
- **Caveat still stands:** even with the bridge fixed, native *browser embeds*
  use Tauri multi-webview (weak on Linux) — Shut Down + lite should fully work;
  the in-app browser may need a different Linux approach (separate WebviewWindow
  or system-browser hand-off).

---

## 1. Key decisions

1. **Tauri is the real Nova Linux shell, not Firefox.** The Firefox-kiosk ISO
   stays only as a reliable in-VM fallback / demo. The native Tauri app is the
   product: real browser embeds, native power controls, no iframe limits.
2. **Stop debugging the Tauri version in VirtualBox.** It's a dead end for
   rendering (§2). Iterate on real GPU environments instead.
3. **Keep the newest Tauri ISO safe** (don't delete it). Everything else
   (base Ubuntu ISO, old `nova-linux.iso`) is disposable.
4. **The app's code is done for Phase 0.** Future work is the *system
   integration* layer (§7), not the shell rendering.

---

## 2. Why VirtualBox can't run the Tauri version (the blocker)

WebKitGTK (the engine behind Tauri on Linux) is far more GPU-dependent than
Firefox. In VirtualBox:

- **3D acceleration OFF** (needed to keep the mouse cursor visible): no GL
  context → WebKitGTK renders **black or white at random**, sometimes works,
  mostly doesn't. Pure software-render roulette.
- **3D acceleration ON**: WebKitGTK can get a GL context, **but** it
  destabilizes the GNOME session itself (desktop won't come up / cursor
  vanishes). We saw the VM break in *both* directions.

Symptoms we chased and what they really were:
- `JS error: Script error.` on a dark screen → WebKit's GPU compositing failing
  (the "Script error" was the masked symptom, not a JS bug).
- Black screen → GPU compositing produced nothing.
- White screen → software compositing kicked in (page painting) but still flaky.
- `libEGL warning: ... DRI3/DRI2 ... VMware: No 3D enabled` → harmless noise;
  WebKit trying for a GPU that isn't there.

**Proof the app is fine:** `npm run tauri dev` (served from `localhost:5173`)
rendered Nova OS correctly. The production binary in the VM is what's flaky —
and that flakiness tracks the VM's broken GPU, full stop.

---

## 3. Runtime path forward (do these in order)

### Idea A — VMware Workstation Player (try first)
VMware's virtual GPU (SVGA3D / `vmwgfx`) is **much** more mature than
VirtualBox's, and people routinely run Electron/Tauri/WebKitGTK apps in it.
- Install **VMware Workstation Player** (free for personal use).
- Create an Ubuntu VM, **enable "Accelerate 3D graphics"**, give it 4 CPUs /
  8 GB RAM / 128 MB+ video memory.
- Boot the **Tauri ISO**. If WebKitGTK renders reliably here, this becomes the
  day-to-day dev/test environment and we never touch VirtualBox again.

### Idea B — real laptop via USB live boot (the sure thing)
If VMware still struggles, go straight to hardware — it's Nova Linux's actual
target and WebKitGTK + a real GPU just works.
- Flash the Tauri ISO to a USB stick (8 GB+) with **Rufus** or **balenaEtcher**
  on Windows.
- Boot a spare laptop (or your own PC) from the USB and pick **"Try Ubuntu"** —
  a **live session runs entirely in RAM, non-destructive**, never touches the
  installed OS / Windows.
- `NOVA_KIOSK=1` autostart launches the Tauri shell fullscreen. Real GPU → no
  black/white roulette.

### Env vars (only needed for software-rendered hosts)
On a GPU-less host, these force WebKitGTK to render in software. On real
hardware / working 3D, **omit them** (you want the GPU):
```
WEBKIT_DISABLE_COMPOSITING_MODE=1 WEBKIT_DISABLE_DMABUF_RENDERER=1 LIBGL_ALWAYS_SOFTWARE=1
```
If we ever ship a "low-power / VM" boot entry, bake these into its autostart
`Exec=` line (§6); keep the default entry GPU-accelerated.

---

## 4. What's already built (assets that exist today)

### The Tauri shell (code — all merged)
- **`src-tauri/src/lib.rs`**
  - `kiosk_mode()` command → true when `NOVA_KIOSK` or `NOVA_LITE` is set.
  - `power_off()` / `restart_machine()` commands → real shutdown/restart for the
    Start-menu power controls.
  - `.setup()` → when `NOVA_KIOSK`/`NOVA_LITE` is set, drops window decorations
    and goes fullscreen so Nova OS owns the screen. No effect on the normal
    windowed desktop build.
- **`src/main.jsx`** — on Tauri + kiosk session, reloads once with `?kiosk=1` so
  the existing lite-mode URL path drives rendering. *(Suspect for the
  production white-screen — see §5; if real hardware also white-screens, this is
  the first thing to refactor: apply lite mode without a custom-protocol
  reload.)*
- **`src/lib/system.js`** — `isKioskSession()` wraps the `kiosk_mode` invoke.
- **`src/lib/lite.js`** — lite mode (`?kiosk=1` / `?lite=1`): kills
  `backdrop-filter` blur + the heavy SVG/animated wallpapers (the two most
  GPU-expensive effects) for low-power hosts.
- **`src/ui/wallpapers.jsx`, `src/ui/styles.js`** — lite-mode flat-gradient
  wallpaper + blur-off overrides.
- **Native browser embeds** (IDEAS #21) — real webviews on the Tauri build, no
  `X-Frame-Options` iframe limits.

### The ISO pipeline (manual, via Cubic)
- A **`.deb`** of the Nova OS Tauri app (`nova-os`, built `~/nova-os.deb`,
  installs `/usr/bin/app`).
- A **Cubic project** (`~/nova-iso/`) that bakes the `.deb` + the kiosk
  autostart into a customized Ubuntu live ISO.
- **`scripts/nova-kiosk-setup.sh`** — the original in-place kiosk setup (GDM
  autologin + autostart) used on the workshop VM before we moved to Cubic.

### The autostart it bakes in
`/etc/xdg/autostart/nova-kiosk.desktop` inside the ISO:
```ini
[Desktop Entry]
Type=Application
Name=Nova OS Kiosk
Exec=env NOVA_KIOSK=1 /usr/bin/app
X-GNOME-Autostart-enabled=true
```

---

## 5. Hard-won gotchas (so we never re-learn them)

- **Paste commands ONE per line.** Multi-line pastes kept merging into a single
  line (`apt install ... /usr/bin/app` → "Unsupported file"; `cp ... ; ...`).
  When two commands must go together, join with `;` or `&&` on one line.
- **VirtualBox is unstable under load.** Running a Rust build + Vite dev server +
  software-rendered WebKit at once caused freezes, crashes, and input death.
  Give the VM 6–8 GB RAM / 4 CPUs and don't run `tauri dev` in it.
- **Caps Lock spam / UI glitching on focus** = VirtualBox keyboard capture bug.
  Fix: **File → Preferences → Input → uncheck "Auto Capture Keyboard"**, tap
  Caps Lock once to resync.
- **Frozen guest ≠ stuck.** Host-level controls always work: **Machine → Reset**
  or close window → **Power off**. The virtual disk is *not* erased by a force
  power-off — only unsaved in-RAM state is lost.
- **Out of disk mid-build** = host disk full → dynamic `.vdi` can't grow → VM
  aborts. Fix: free Windows space, **empty the Recycle Bin**, and we **moved the
  VMs to the E: drive** (VirtualBox → right-click VM → **Move…**; set default
  machine folder to `E:\VirtualBox VMs`).
- **Cubic crash mid-Generate** doesn't lose the bake — the `.deb` + autostart
  live in the project; just free space and **Generate again** (minutes, not a
  rebuild).
- **The cursor vs WebKit trade-off**: 3D off → cursor visible but WebKit dies;
  3D on → WebKit can render but desktop/cursor break. This catch-22 is *the*
  reason VirtualBox is a dead end for the Tauri build.
- **Nothing irreplaceable lives only in the VM.** Source is on GitHub; the
  `.deb` and Cubic project are rebuildable from the steps in §6.

---

## 6. Build & bake playbook (reproduce the Tauri ISO from scratch)

On a Linux build box (workshop VM, or any Ubuntu machine — ideally with disk
headroom):

```bash
# 1. Source + deps
git clone <nova-os repo>            # source is on GitHub
cd nova-os && npm install

# 2. Build the native .deb (Tauri)
npm run tauri build
#   → src-tauri/target/release/bundle/deb/nova-os_<ver>_amd64.deb
cp src-tauri/target/release/bundle/deb/nova-os_*_amd64.deb ~/nova-os.deb

# 3. Cubic: create/open a project from an Ubuntu base ISO, then in the
#    root@cubic chroot terminal:
#    a) install the app
apt install -y /path/to/nova-os.deb          # provides /usr/bin/app
#    b) write the kiosk autostart
cat > /etc/xdg/autostart/nova-kiosk.desktop <<'DESK'
[Desktop Entry]
Type=Application
Name=Nova OS Kiosk
Exec=env NOVA_KIOSK=1 /usr/bin/app
X-GNOME-Autostart-enabled=true
DESK
#    (for a software-rendered/VM boot entry, prefix the WEBKIT_* vars from §3)

# 4. Generate the ISO in Cubic → it lands in ~/nova-iso/

# 5. Move the ISO to the host (Windows) to flash/boot:
cd ~/nova-iso && python3 -m http.server 8000
#   → on Windows: http://localhost:8000/<the>.iso
```

**Verify a built ISO is the Tauri one** (not an old Firefox build): boot it,
then `cat /etc/xdg/autostart/nova-kiosk.desktop` should show `…/usr/bin/app`
and `ls -la /usr/bin/app` should exist.

---

## 7. Remaining phases (the roadmap)

Phase 0 (shell renders fullscreen) is **effectively done** — it just needs a
GPU-capable host to demonstrate (§3). After that, the real work is making Nova
OS's UI control the actual Linux system (from `NOVA-LINUX.md`):

- **Phase 0.5 — Validate Tauri on a real GPU** *(next up)*. Boot the Tauri ISO
  on VMware / real hardware; confirm render, the Start-menu **Shut Down**
  (`power_off`), and native browser embeds. If it white-screens even on real
  hardware, refactor the `main.jsx` `?kiosk=1` reload (§4).
- **Phase 1 — System agent v1.** A small local service bridging Nova OS UI to:
  WiFi/Ethernet (NetworkManager), volume (PipeWire `wpctl`), brightness
  (`brightnessctl`), power (logind), battery (UPower), launch/list apps. Wire
  the Control Center + power menu to it.
- **Phase 2 — App management.** Flathub browse/install in the Store; show native
  app windows in the Nova taskbar via the wlroots foreign-toplevel protocol.
- **Phase 3 — Installable ISO.** Calamares installer, driver bundles, branding,
  first-boot setup, update mechanism. (Move off "live session" to a real
  install.)
- **Phase 4 — Gaming layer.** Proton/Bottles, GPU drivers (incl. NVIDIA),
  performance tweaks.
- **Polish track** (parallel): swap the GNOME-autostart kiosk for a purpose-built
  compositor session (`cage` for pure kiosk, or `labwc`/`Sway` for windows), a
  Nova-branded boot splash (Plymouth), and a clean shutdown flow.

---

## 8. Feature wishlist — Linux-OS-specific

Things we want Nova Linux (the *distro*, beyond the web app) to do:

- ✅ **Power controls** — real shutdown/restart from the Start menu (built:
  `power_off` / `restart_machine`).
- ✅ **Native browser embeds** — real webviews, no iframe limits (built on Tauri).
- ✅ **Lite mode** — low-power rendering for weak/VM hosts.
- ⏳ **Real WiFi / network control** — pick and join networks from Nova's UI
  (NetworkManager). *(Also IDEAS #2.)*
- ⏳ **Audio device + master volume** — real output switching + system volume,
  not just Nova's in-app sounds. *(IDEAS #2.)*
- ⏳ **Brightness, battery, Bluetooth** widgets wired to real hardware.
- ⏳ **Launch & manage native apps** — open installed Linux apps from Nova's
  Store/launcher; show their windows in the Nova taskbar.
- ⏳ **Flatpak/Flathub Store backend** — install real software from the Nova
  Store.
- ⏳ **Gaming** — Proton/Bottles; Roblox attempted via Sol/Grapejuice (anti-cheat
  may block — out of our control).
- ⏳ **Installer + branding** — Calamares, boot splash, first-run setup, updates.
- ⏳ **Filesystem access** — Nova's File Explorer browsing the real home dir.
- ⏳ **A "low-power VM" boot entry** — same ISO, GRUB entry that adds the
  `WEBKIT_*` software-render vars for testing in VMs.

---

## 9. Architecture / build pipeline (proposal)

Right now the ISO is built **by hand in Cubic**, which is why a crash mid-bake or
a slow software-render cost us hours. The goal: a **reproducible, mostly
automated pipeline** so any ISO can be rebuilt from source.

```
┌─ source (this repo, GitHub) ────────────────────────────────────────┐
│  Nova OS web app  +  src-tauri/ (Tauri shell)  +  nova-linux/ (new)  │
└───────────────────────────────┬─────────────────────────────────────┘
                                 │ CI (GitHub Actions, ubuntu runner)
                 ┌───────────────┴────────────────┐
                 ▼                                 ▼
        npm run tauri build               (later) system agent build
        → nova-os_<ver>_amd64.deb         → nova-agent .deb
                 │                                 │
                 └───────────────┬─────────────────┘
                                 ▼
            ISO build (scripted, reproducible)
            ── Phase now:  documented Cubic recipe (§6)
            ── Phase next: Debian/Ubuntu `live-build` profile in nova-linux/
                           that installs both .debs + autostart + branding
                                 │
                                 ▼
                   nova-linux-<ver>.iso  →  hosting
            (GitHub release ≤2 GB cap → likely external host / torrent)
```

**Concrete steps to build this pipeline:**
1. **`nova-linux/` directory in the repo** holding all distro config (autostart
   `.desktop`, branding assets, package lists, post-install hooks) so the ISO is
   defined *as code*, not as clicks in Cubic.
2. **CI builds the `.deb`** on every tagged release (`npm run tauri build` on an
   ubuntu runner) and attaches it as a release asset.
3. **Replace Cubic with a scripted `live-build` (or `archiso`) profile** that
   pulls the released `.deb`, drops in the autostart + branding, and emits the
   ISO with one command — runnable in CI or on any Linux box.
4. **Versioning**: tie the ISO version to `package.json` (currently `10.4.0`;
   the kiosk-shell work is the v10.5 line).
5. **Hosting**: decide on an ISO host (ISOs may exceed GitHub's ~2 GB asset cap).

Until step 3 lands, the **manual Cubic recipe in §6 is the source of truth.**

---

## 10. Resume checklist (start here next time)

1. [ ] Confirm the **Tauri ISO** (`nova-linux-tauri`) is still saved (don't
       delete it). Verify with the §6 boot check if unsure.
2. [ ] **Install VMware Workstation Player**, make an Ubuntu VM with **3D
       acceleration ON**, boot the Tauri ISO (§3, Idea A).
3. [ ] If VMware renders Nova OS → that's the new dev/test box. Test: render,
       Start-menu **Shut Down**, **Browser** embeds.
4. [ ] If VMware still struggles → **flash the ISO to USB** and **live-boot a
       laptop** (§3, Idea B). It will work on real hardware.
5. [ ] If even real hardware white-screens → refactor the `main.jsx` `?kiosk=1`
       reload to apply lite mode without a custom-protocol reload (§4/§5).
6. [ ] Once it renders reliably anywhere → start **Phase 1: system agent** (§7).
7. [ ] When ready to industrialize → build the **`nova-linux/` + live-build
       pipeline** (§9) so we never hand-bake an ISO again.

**Remember:** the app is done and proven. We're past the hard part — what's left
is giving it a machine with a real GPU and then building the system-integration
layer on top.
