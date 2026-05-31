# Nova Linux - Architecture Plan (draft)

> 📍 **Where we actually got to / how to resume:** see **`NOVA-LINUX-PROGRESS.md`**
> (decisions, the VirtualBox blocker, VMware → real-laptop plan, build playbook).
> This file is the long-term vision; that one is the live working log.

A bootable Linux distribution where **Nova OS is the desktop shell on top of a
full Linux system** - so you can install real software, manage hardware (WiFi,
audio, displays), and run games, while keeping Nova OS's look and feel.

This is the long-term roadmap item and a *much* larger effort than the web /
mobile / desktop builds (months, not days). This doc is the plan to start from.

---

## Core idea

Nova OS stays the same web app. On Linux it runs **fullscreen as the login
session / desktop shell** (reusing our existing **Tauri** build), on a
lightweight Wayland compositor. A new small **system agent** bridges Nova OS to
the Linux system so its Control Center, Store, and taskbar do *real* things
instead of being cosmetic. Native apps you launch run as real windows.

```
boot -> display manager -> Wayland session -> Nova OS (Tauri, fullscreen)
                Nova OS  <->  nova-agent  <->  NetworkManager / PipeWire /
                                               Flatpak / compositor / logind
```

---

## Recommended stack

- **Base distro:** **Debian/Ubuntu** to start - stable, enormous package
  support, easiest to build an ISO from, best out-of-the-box hardware support.
  *(Alternative: Arch - freshest GPU drivers / Proton, better for gaming, but
  more maintenance. We can switch the base if gaming becomes the priority.)*
- **Display:** Wayland via a wlroots compositor (**labwc** or **Sway**), or
  **cage** for a pure kiosk session.
- **Shell:** the existing **Nova OS Tauri app**, launched fullscreen as the
  session - we already build this, so it's reused, not rewritten.
- **System agent (new component):** a small background service exposing Linux
  control to Nova OS over a local API. Maps Nova UI to real services:
  - WiFi / Ethernet -> **NetworkManager** (D-Bus)
  - Bluetooth -> **BlueZ**
  - Volume -> **PipeWire** (`wpctl`)
  - Brightness -> **brightnessctl**
  - Power (shutdown / restart / sleep) -> **logind**
  - Battery -> **UPower**
  - Launch apps / list installed apps
  - *(later)* window management via the wlroots **foreign-toplevel** protocol ->
    a real, working taskbar over native windows
- **App install ("Store"):** **Flatpak + Flathub** as the primary backend
  (sandboxed, distro-agnostic, easy); `apt`/`pacman` for system packages.
- **Windows apps / games:** **Wine/Proton via Bottles** (a Flatpak). Roblox
  specifically would be attempted via Sol/Grapejuice - but its anti-cheat
  (Hyperion) actively blocks Linux/Wine, so that one is hit-or-miss and outside
  our control.

---

## Phases (each is a real milestone)

0. **Proof of concept** - get the Nova OS Tauri build running fullscreen on a
   Linux VM under a kiosk compositor (cage). Confirms the shell model works.
1. **System agent v1** - WiFi, volume, brightness, power, app launch; wire the
   Control Center + a real power menu to it.
2. **App management** - Flathub browsing/install in the Store; show native app
   windows in the Nova taskbar (foreign-toplevel).
3. **Installable ISO** - a real installer (**Calamares**), driver bundles,
   branding, first-boot setup, updates.
4. **Gaming layer** - Proton/Bottles, GPU drivers (incl. NVIDIA), tweaks.

---

## Honest expectations

- **Scope:** multi-month, the biggest thing on the roadmap. Each phase is
  meaningful on its own.
- **Roblox / anti-cheat games:** may work via Wine, may break on any update -
  that's Roblox's doing, not the OS's. Native + most Proton games are fine.
- **Security:** the web apps stay HTTPS-safe as today. The *distro* itself,
  early on, will be unhardened and unaudited - fine for daily/casual use, but
  don't put banking / primary email on it until it's mature.
- I (the assistant) can author all the configs, agent code, compositor setup,
  build scripts, and Nova OS integration. I **cannot build or boot a Linux ISO
  in this environment** - that has to happen on your Linux machine/VM (below).

---

## What YOU have to do manually

1. **Pick the base distro** - I'll recommend (Debian to start), you decide.
2. **Set up a Linux build + test environment** - a Linux machine or VM (Ubuntu
   in VirtualBox / VMware / Hyper-V, or WSL2 for parts). ISO builds need Linux,
   root, and plenty of disk. I write the scripts; you run them there.
3. **Boot & test the ISO** - in a VM first, then on a spare physical machine.
   Only you can validate real hardware: WiFi chips, GPUs, audio, suspend.
4. **GPU / driver validation** - especially NVIDIA; needs real hardware.
5. **Host the ISO** - GitHub release assets cap at ~2 GB and an ISO may exceed
   that, so you may need external hosting (a mirror, torrent, or large-file
   host). Your call.
6. **Use a spare / dedicated test machine** - strongly recommended; don't do
   distro development on your only computer.
7. **Share your test hardware specs** - so driver/base choices fit what you'll
   actually run it on.
8. **Patience** - this is the marathon, not a sprint.

---

## Suggested first step

Phase 0 only: I write a tiny build config (e.g., a Debian `live-build` profile
or an `archiso` profile) that produces a live ISO which boots straight into the
Nova OS Tauri app fullscreen under `cage`. You build + boot it in a VM. If that
works, we've proven the model and move to the system agent.
