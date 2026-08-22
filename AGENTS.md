# AGENTS.md — rules for any agent (or human) working in this fork

This is a **personal fork** of Munder Difflin (upstream:
`chaitanyagiri/munder-difflin`, remote `upstream`). We continuously merge
upstream updates. Every rule below exists to keep those merges cheap.

## Rule 0 — Read CHANGE NOTES.md first

**Always read `CHANGE NOTES.md` before making any change, and update it after
the change is done** (what changed, why, which files, which config keys). It
is the map of everything personal in this codebase. Every fork edit in an
upstream-owned file carries a `[personal]` comment; find them all with:

```bash
git grep -n "\[personal\]"
```

## Rule 1 — Never touch the core logic

**Do not modify, refactor, or "clean up":**

- The Hive: `src/main/hive.ts`, `src/main/hooks.ts`, `src/main/control.ts`,
  roster/injection/heartbeat/circuit-breaker logic.
- The main process instruction/prompt files that drive agents.
- `src/main/pty.ts`, `src/main/db.ts`, spawn/queue/delivery paths.
- Anything under `src/shared/` contracts (triggers, hire, agentProvider)
  beyond adding an optional field.

If a task seems to require changing these, stop and surface it instead —
there is almost always a toggle-level or additive way.

## Rule 2 — Additive only; hide with toggles, never delete

- **NEVER delete upstream code, components, styles, or files.** Disable by
  gating at the feature's root with a config key.
- New behavior goes in **new files** wherever possible.
- Edits to upstream files: keep them minimal, and tag every one with a
  `[personal]` comment.
- Follow the established toggle pipeline for any new switch:
  `src/main/config.ts` (key + DEFAULTS) → `src/preload/index.ts` (type) →
  `src/renderer/src/store/config.ts` (mirror type) →
  `src/renderer/src/store/store.ts` (mirror + setter) → `App.tsx`
  (seed + gate) → `SettingsModal.tsx` (General row). Renderer consumers read
  the STORE, not DOM attributes (attributes are stamped post-render — reading
  them during render lags one toggle behind).

## Rule 3 — Git discipline

- Work happens on the `personal` branch only. **Never commit to `main`** — it
  mirrors upstream.
- Sync with: `git fetch upstream && git merge upstream/main` (on `personal`),
  frequently. In conflicts, upstream hunks win except `[personal]` lines.
- After merges: rebuild native modules per CHANGE NOTES.md §2, run
  `npm run typecheck`, flip every toggle once in `npm run dev`.

## Rule 4 — Data safety on this machine

- `npm run dev` uses the sandbox data dir (`munder-difflin-dev`).
- `npm run dev:main` runs against the REAL installed-app data — take a
  backup of `%APPDATA%\munder-difflin` first, and never run the installed
  app and a dev instance at the same time (named-pipe conflict).
