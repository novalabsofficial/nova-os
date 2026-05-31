#!/bin/sh
# ============================================================================
# Nova Linux — convert the image to a minimal "cage" kiosk session (no GNOME).
# ----------------------------------------------------------------------------
# RUN THIS INSIDE THE CUBIC CHROOT (the root@cubic terminal), AFTER installing
# the Nova OS .deb (dpkg -i nova-os.deb). It does NOT touch your real machine.
#
# What it does:
#   • installs `cage` (a Wayland kiosk compositor — runs ONE app fullscreen),
#     `greetd` (a tiny autologin daemon), and `seatd` (seat management);
#   • writes /usr/local/bin/nova-session, which launches Nova OS software-
#     rendered (WLR_RENDERER=pixman + WebKit software flags) so it paints even
#     on a GPU-less VM, with NOVA_KIOSK=1 so the app goes lite + fullscreen;
#   • makes greetd the display manager and DISABLES GDM/GNOME (frees ~1 GB RAM,
#     which is what was OOM-killing WebKit);
#   • removes the old GNOME autostart (cage launches the app now).
#
# Logs after boot:  journalctl -b ,  journalctl -u greetd ,  and the app log at
#   /home/<user>/.local/share/com.novalabsofficial.novaos/logs/*.log
#
# Escape hatch in the running ISO: cage allows VT switching, so Ctrl+Alt+F2
# (or F3) drops you to a text console to read logs if the screen is black.
# ============================================================================
set -eu

# The live-session username. Ubuntu live ISOs use "ubuntu". Override: sh cage-setup.sh <user>
KIOSK_USER="${1:-ubuntu}"

echo "[nova] === cage kiosk setup (user=$KIOSK_USER) ==="

echo "[nova] (1/5) installing cage + greetd + seatd ..."
apt-get update
apt-get install -y --no-install-recommends cage greetd seatd

echo "[nova] (2/5) writing /usr/local/bin/nova-session ..."
cat > /usr/local/bin/nova-session <<'SESSION'
#!/bin/sh
# Nova OS kiosk session. Software-rendered so it works without a real GPU (VM).
# On real hardware you can drop the WLR/WEBKIT vars to use GPU acceleration.
export NOVA_KIOSK=1                       # app reads this -> lite mode + fullscreen
export WLR_RENDERER=pixman                # cage software compositor (no GPU needed)
export WEBKIT_DISABLE_COMPOSITING_MODE=1  # WebKit software path
export WEBKIT_DISABLE_DMABUF_RENDERER=1
exec cage -- /usr/bin/app
SESSION
chmod +x /usr/local/bin/nova-session

echo "[nova] (3/5) writing /etc/greetd/config.toml (autologin -> cage) ..."
mkdir -p /etc/greetd
cat > /etc/greetd/config.toml <<GREETD
[terminal]
vt = 1

# initial_session = autologin into the kiosk on boot, no prompt.
[initial_session]
command = "/usr/local/bin/nova-session"
user = "$KIOSK_USER"

# default_session = what runs if the kiosk ever exits/logs out (same kiosk).
[default_session]
command = "/usr/local/bin/nova-session"
user = "$KIOSK_USER"
GREETD

echo "[nova] (4/5) making greetd the display manager (disabling GDM/GNOME) ..."
usermod -aG video,input,render,seat "$KIOSK_USER" >/dev/null 2>&1 || true
systemctl disable gdm3.service >/dev/null 2>&1 || true
systemctl disable gdm.service  >/dev/null 2>&1 || true
systemctl enable  seatd.service >/dev/null 2>&1 || true
systemctl enable  greetd.service >/dev/null 2>&1 || true
# Force greetd to be THE display-manager.service (overrides gdm).
if   [ -e /lib/systemd/system/greetd.service ];     then GS=/lib/systemd/system/greetd.service
elif [ -e /usr/lib/systemd/system/greetd.service ]; then GS=/usr/lib/systemd/system/greetd.service
else GS=""; fi
[ -n "$GS" ] && ln -sf "$GS" /etc/systemd/system/display-manager.service
systemctl set-default graphical.target >/dev/null 2>&1 || true

echo "[nova] (5/5) removing the old GNOME autostart ..."
rm -f /etc/xdg/autostart/nova-kiosk.desktop

echo ""
echo "[nova] === DONE. Verify below, then exit the chroot and Generate the ISO ==="
echo "----- /etc/greetd/config.toml -----";      cat /etc/greetd/config.toml
echo "----- /usr/local/bin/nova-session -----";  cat /usr/local/bin/nova-session
echo "----- display-manager + app binary -----"
ls -l /etc/systemd/system/display-manager.service 2>/dev/null || echo "  (no display-manager symlink!)"
ls -l /usr/bin/app 2>/dev/null || echo "  (WARNING: /usr/bin/app missing — did you dpkg -i nova-os.deb first?)"
