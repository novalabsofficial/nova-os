Nova OS — bundled default LIGHT wallpaper
=========================================

Drop ONE image file in THIS folder to make it the default Light-mode
wallpaper ("Bloom") at full original quality.

  • Accepted formats: .png  .jpg  .jpeg  .webp  .avif
  • Recommended size:  2560 x 1600 (or larger). 16:10 / 16:9 both fine.
  • Any filename works — Vite auto-discovers whatever is in this folder.
  • If you put more than one image here, the first (alphabetical) is used.

This is a BUNDLED asset: it ships with the app and is served at the original
resolution with NO recompression — unlike the in-app "Upload Custom Wallpaper"
button, which downsamples to ~900px / 72% JPEG to fit in your account.

After adding/replacing the image, restart `npm run dev` (Vite caches the
asset list at startup), then switch to Light mode to see it.

If this folder has no image, Nova falls back to the built-in SVG "Bloom".
