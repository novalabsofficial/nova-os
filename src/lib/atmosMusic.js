// Atmos background-music track list.
//
// Auto-discovers every .mp3 in src/assets/atmos-music/ at build time via
// Vite's import.meta.glob — so adding a new song in the future is literally
// "drop the .mp3 into that folder" with ZERO code changes. The track title
// is derived from the filename (kebab-case -> Title Case); short roman-ish
// suffixes are upper-cased, so "morning-brass-ii.mp3" -> "Morning Brass II".
//
// mp3s are emitted as hashed static assets (not inlined into the JS bundle),
// so they only download when the user actually starts the music.
const mods = import.meta.glob("../assets/atmos-music/*.mp3", { eager: true });

function prettify(file) {
  return file
    .replace(/\.mp3$/i, "")
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) =>
      /^(i{1,3}|iv|v|vi{0,3}|ix|x)$/i.test(w)
        ? w.toUpperCase()
        : w.charAt(0).toUpperCase() + w.slice(1)
    )
    .join(" ");
}

export const ATMOS_TRACKS = Object.entries(mods)
  .map(([path, mod]) => {
    const file = path.split("/").pop();
    return { title: prettify(file), src: (mod && mod.default) || mod };
  })
  .sort((a, b) => a.title.localeCompare(b.title));
