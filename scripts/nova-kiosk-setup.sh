#!/usr/bin/env bash
# Nova Linux - Phase 0 kiosk setup.
#
# Turns an Ubuntu workshop VM into a Nova OS kiosk: installs a Wayland kiosk
# compositor (cage) running a no-snap WebKit browser that boots straight into
# Nova OS fullscreen. Browser: surf (no chrome) if available, else GNOME Web.
#
# Run it on the Ubuntu VM with:
#   sudo -v && wget -qO- https://raw.githubusercontent.com/novalabsofficial/nova-os/main/scripts/nova-kiosk-setup.sh | bash

NOVA_URL="https://nova-os-official.vercel.app"
ME="$(id -un)"

echo ">> Installing cage + seatd + a kiosk browser ..."
sudo add-apt-repository -y universe
sudo apt update
# seatd = seat manager so a service-launched cage can grab the display (DRM
# master) without an "active" logind session.
sudo apt install -y cage seatd
sudo systemctl enable --now seatd
# Prefer surf (clean, no browser chrome); fall back to GNOME Web (epiphany)
# which is always packaged. (cog isn't in Ubuntu's repos.)
if sudo apt install -y surf; then BROWSER="surf"; else sudo apt install -y epiphany-browser; BROWSER="epiphany-browser"; fi
sudo usermod -aG video,input,tty,seat,render "$ME"

echo ">> Writing the kiosk service ..."
sudo tee /etc/systemd/system/nova-kiosk.service >/dev/null <<UNIT
[Unit]
Description=Nova OS Kiosk
After=systemd-user-sessions.service plymouth-quit-wait.service getty@tty1.service
Conflicts=getty@tty1.service

[Service]
Type=simple
User=$ME
PAMName=login
TTYPath=/dev/tty1
StandardInput=tty
StandardOutput=journal
StandardError=journal
TTYReset=yes
TTYVHangup=yes
Environment=WLR_RENDERER=pixman
Environment=WLR_NO_HARDWARE_CURSORS=1
Environment=LIBSEAT_BACKEND=seatd
ExecStart=/usr/bin/cage -- $BROWSER $NOVA_URL
Restart=always

[Install]
WantedBy=graphical.target
UNIT

echo ">> Enabling kiosk, disabling desktop login manager ..."
sudo systemctl set-default graphical.target
sudo systemctl disable gdm3 2>/dev/null || true
sudo systemctl enable nova-kiosk.service

echo ">> Done. Rebooting into Nova OS in 5 seconds (Ctrl+C to cancel) ..."
sleep 5
sudo reboot
