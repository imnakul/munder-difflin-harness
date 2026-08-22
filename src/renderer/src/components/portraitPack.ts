/**
 * [personal] portraitPack — the drop-in SVG avatar pack for SpritePortrait.
 *
 * Drop any number of .svg files into `src/renderer/src/assets/avatars/` (the
 * owner's collection is ~116) and flip Settings → New Look → "Portraits" to
 * `svg`. Every character gets a STABLE pick from the pack (hash of the
 * character name), so a given agent always shows the same avatar across
 * restarts. An empty folder (or 'pixel' mode) falls back to the upstream
 * pixel busts — no error, no empty frame.
 *
 * Adding/removing files changes the hash → picks reshuffle; that's expected
 * while curating the pack and harmless afterwards.
 */
const files = import.meta.glob('../assets/avatars/*.svg', {
  eager: true,
  query: '?url',
  import: 'default'
}) as Record<string, string>;

/** Sorted so pack order is deterministic across glob runs. */
export const svgAvatarUrls: string[] = Object.values(files).sort();

/** Stable hash → pick. Null when the pack is empty (caller falls back). */
export function svgAvatarFor(key: string): string | null {
  if (svgAvatarUrls.length === 0) return null;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return svgAvatarUrls[h % svgAvatarUrls.length];
}
