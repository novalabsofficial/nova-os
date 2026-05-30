#!/usr/bin/env bash
# Nova Linux - Phase 0 kiosk (VM-friendly).
#
# Approach: use the normal GNOME session (which renders fine in VirtualBox) with
# autologin, and auto-launch Firefox in kiosk mode on Nova OS. This replaces the
# earlier cage/wlroots approach, which couldn't get DRM master inside VirtualBox.
# Firefox ships in the Ubuntu base, so this also bakes into the Cubic ISO cleanly.
#
# Run on the Ubuntu VM with:
#   sudo -v && wget https://raw.githubusercontent.com/novalabsofficial/nova-os/main/scripts/nova-kiosk-setup.sh && tr -d '\r' < nova-kiosk-setup.sh | bash

NOVA_URL="https://nova-os-official.vercel.app"
ME="$(id -un)"

echo ">> Removing the old cage kiosk service (if present) ..."
sudo systemctl disable nova-kiosk.service 2>/dev/null || true
sudo rm -f /etc/systemd/system/nova-kiosk.service
sudo systemctl daemon-reload

echo ">> Re-enabling the desktop session + autologin for $ME ..."
# GDM is a display manager: it's selected via the display-manager.service
# symlink, not `systemctl enable`. Recreate that symlink so it starts at boot.
GDM_UNIT="$(systemctl show -p FragmentPath gdm3.service 2>/dev/null | cut -d= -f2)"
[ -n "$GDM_UNIT" ] && sudo ln -sf "$GDM_UNIT" /etc/systemd/system/display-manager.service
sudo systemctl set-default graphical.target
sudo mkdir -p /etc/gdm3
sudo tee /etc/gdm3/custom.conf >/dev/null <<CONF
[daemon]
AutomaticLoginEnable=true
AutomaticLogin=$ME
CONF

echo ">> Adding the Nova OS kiosk autostart (Firefox kiosk) ..."
sudo mkdir -p /etc/xdg/autostart
sudo tee /etc/xdg/autostart/nova-kiosk.desktop >/dev/null <<DESK
[Desktop Entry]
Type=Application
Name=Nova OS Kiosk
Exec=firefox --kiosk $NOVA_URL
X-GNOME-Autostart-enabled=true
DESK

echo ">> Done. Rebooting into Nova OS in 5 seconds (Ctrl+C to cancel) ..."
sleep 5
sudo reboot
