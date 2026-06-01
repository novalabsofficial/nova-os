#!/bin/sh
# Windowed cage debug launcher for the workshop VM (no ISO needed).
# Runs the Nova OS app under cage AS A WINDOW (software-rendered), logging to
# /tmp/nova.log, with the WebKit remote inspector on http://127.0.0.1:2999
# (open that in a browser if you ever need the full devtools console).
#
# Usage:  sh nova-linux/debug-run.sh
# Then:   grep -i threw /tmp/nova.log     (the real async error, if any)
#         grep -i error /tmp/nova.log     (all error lines)
#
# If it errors about the backend, your session is Wayland — change x11 to wayland.
export WLR_BACKEND=x11
export WLR_RENDERER=pixman
export WEBKIT_DISABLE_COMPOSITING_MODE=1
export WEBKIT_DISABLE_DMABUF_RENDERER=1
export NOVA_KIOSK=1
export WEBKIT_INSPECTOR_SERVER=127.0.0.1:2999
cage -- /usr/bin/app 2>&1 | tee /tmp/nova.log
