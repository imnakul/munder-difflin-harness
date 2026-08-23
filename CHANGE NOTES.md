# CHANGE NOTES — Personal Fork of Munder Difflin

> **This file is the single source of truth for every personal-fork change.**
> Read it BEFORE making any change. Update it AFTER every change (what, why,
> which files, which config keys). It exists so upstream updates stay easy:
> `git merge upstream/main` into `personal`, then re-verify each entry below.
>
> Every fork edit in upstream-owned files is tagged with a `[personal]`
> comment. Find them all anytime with:
>
> ```bash
> git grep -n "\[personal\]"
> ```

---

## 1. Fork strategy (why everything below is a toggle, never a deletion)

### What the codebase gives us

`src/main/config.ts` defines a `HarnessConfig` with master switches for nearly
every feature, and the project's own convention is that a switch-off makes a
feature fully dark — no UI, no services, no network. There are already toggles
for: telemetry, auto-update, Slack, Free Flow voice, Realtime Michael, TV-show
office themes, knowledge graph, semantic memory, memory reflection,
multi-window floors, the hourly ops standup, the heartbeat, auto-compact,
circuit breaker... Most are flippable in the app's own Settings UI.

### The three layers, cheapest first

**Layer 1 — Don't like a feature? Flip its existing switch (zero or one-line
diff).** If the feature has a toggle, turn it off in Settings (no code at all,
nothing to merge) or change its value in `DEFAULTS` in `config.ts` (one word,
e.g. `telemetryEnabled: false` — near-zero merge cost forever). Deletion, by
contrast, guarantees conflicts on every upstream touch of that code.
Dead-but-hidden code costs you nothing; deleted code costs you every merge.

**Layer 2 — Feature has no switch? Add one gate at the root, not flags
everywhere.** One config key, checked once at the feature's entry point (the
service bootstrap, or the component's render). A typical "hide this settings
section entirely" is a 2-line diff.

**Layer 3 — Adding your own features? New files, plus tiny marked seams in
existing ones.** Git never conflicts on files upstream doesn't have. Additions
live in new files/components, mounted conditionally. Where an existing file
must be edited, keep the edit minimal and tagged `// [personal]`.

The one case where deletion is right: something that actively interferes — a
service binding a port you want, a default behavior you need inverted rather
than hidden, or a hard dependency in the way of your feature.

### Git discipline (this is what actually keeps updates painless)

- Remotes: `origin` = our fork (`imnakul/munder-difflin-harness`),
  `upstream` = the original (`chaitanyagiri/munder-difflin`).
- `main` stays a clean mirror of upstream. **Never commit to it.**
- All personal work lives on `personal` (push to origin as backup).
- Sync ritual, small and frequent:
  ```bash
  git fetch upstream
  git merge upstream/main     # on the personal branch
  ```
  Monthly 10-minute merges beat quarterly hour-long archaeology — conflicts
  grow with drift, not linearly.
- During conflicts: upstream hunks win EXCEPT lines marked `[personal]`.

---

## 2. Windows build environment (machine-specific, NOT in the repo)

The native modules (`better-sqlite3`, `node-pty`) need these to build on this
machine. **A plain `npm install` will fail or produce broken modules.** Use:

```bash
npm install --ignore-scripts
node node_modules/electron/install.js          # download the Electron binary
npm_config_clang=false LLVMInstallDir="C:\Program Files\LLVM" npx electron-rebuild -f
node tools/ensure-pty-perms.cjs
node tools/patch-node-pty-conpty.cjs
```

Why:
- Node 24's `process.config.clang = 1` (Node's official Windows builds are
  compiled with clang), and node-gyp copies it into gyp config, forcing the
  `ClangCL` MSBuild toolset. `npm_config_clang=false` forces plain MSVC v143.
- LLVM 19.1.7 is installed at `C:\Program Files\LLVM` (winget) for the rare
  clang path.
- **node-pty Spectre patch (lives in node_modules — WIPED by every
  `npm install`!):** `node-pty/binding.gyp` and
  `node-pty/deps/winpty/src/winpty.gyp` contain
  `'SpectreMitigation': 'Spectre'` which requires Spectre-mitigated MSVC libs
  this machine doesn't have. Re-apply after any install:
  ```bash
  cd node_modules/node-pty
  sed -i "s/'SpectreMitigation': 'Spectre'/'SpectreMitigation': 'false'/" binding.gyp deps/winpty/src/winpty.gyp
  ```
  (then re-run the electron-rebuild line above)

---

## 3. Dev data isolation (first fork change)

**What:** Dev builds (`npm run dev`) default to a THROWAWAY data dir
`%APPDATA%\munder-difflin-dev`, so experiments never touch the installed
app's data at `%APPDATA%\munder-difflin`. `npm run dev:main` (or
`--md-main-data` / `MD_MAIN_DATA=1`) runs the dev build against the REAL
installed-app data. Every startup prints which one it's on:

```
[data] userData = C:\Users\<user>\AppData\Roaming\munder-difflin-dev (dev)
```

**Where:** `src/main/index.ts` — the `[personal]` "Dev data isolation" block
right before the protocol registration / single-instance lock (must run before
ANYTHING touches userData). `package.json` — added the `dev:main` script.

**Rules:** never run the installed app and a dev instance simultaneously
(same named pipe `\\.\pipe\munder-difflin-*` → EADDRINUSE). Backups of the
real data live at `%APPDATA%\munder-difflin-backup-*` (take one before any
`dev:main` session that might mutate data).

---

## 4. Feature changes (each is a Settings toggle; nothing upstream deleted)

All config keys below are `[personal]` additions to `HarnessConfig` in
`src/main/config.ts`, mirrored in `src/preload/index.ts` (type),
`src/renderer/src/store/config.ts` (renderer mirror type),
`src/renderer/src/store/store.ts` (reactive mirror + setter, seeded by App on
config load), and `src/renderer/src/components/SettingsModal.tsx`
(General-tab row). The renderer reads them through the zustand store so every
toggle applies LIVE (no restart).

| Key | Values | Fork default | Upstream behavior | What it controls |
|---|---|---|---|---|
| `officeScene` | `boolean` | `false` | always on | Pixel-art office scene mounts at all |
| `uiFont` | `pixel`/`jakarta` | `pixel` | pixel | UI typeface |
| `uiTheme` | `classic`/`modern` | `classic` | classic | chrome skin |
| `uiIcons` | `pixel`/`huge` | `pixel` | pixel | icon pack |
| `sidebarNav` | `boolean` | `true` | no rail | left SideRail |
| `uiAnimations` | `boolean` | `true` | none | motion layer |
| `splitAgentMode` | `boolean` | `false` | none | drag-to-split agent view |
| `appName` | `string` | `'Munder Difflin'` | fixed | editable display name |
| `uiPortraits` | `pixel`/`svg` | `pixel` | pixel | agent avatar pack |

### 4.1 `officeScene` — pixel office scene removal + full-width layout

- `src/main/config.ts`: key + `DEFAULTS.officeScene = false`.
- `src/renderer/src/App.tsx`: the floor column (`<OfficeFloor />` + its
  overlays) AND the `SidebarSplitter` render only when the scene is on; when
  off, the command-center column goes `flex: 1` full-width and `<MemoryPanel />`
  re-anchors over it. The booting/empty-floor overlays stay with the floor
  layout (the full-width column has its own states).
- `SettingsModal`: "Pixel office scene" on/off row; the OfficeThemePicker is
  hidden while the scene is off.

### 4.2 `uiFont` — typeface picker (pixel / Plus Jakarta Sans)

- `src/renderer/index.html`: Google Fonts link extended with
  `Plus+Jakarta+Sans`. (A 'chakra' (Chakra Petch) third option existed briefly
  and was REMOVED at the owner's request — the union is 'pixel' | 'jakarta'.)
- `src/renderer/src/design/tokens.css`: a `:root[data-uifont='jakarta']` block
  swaps `--cth-font-display`/`--cth-font-ui` and rescales the display type
  sizes (pixel fonts render ~2x larger per px, so a normal face needs bigger
  px).
- App stamps `data-uifont` on `<html>` from the store.

### 4.3 `uiTheme` — modern skin (Raycast/Linear register)

- **New file** `src/renderer/src/design/modern.css` — the whole skin:
  `:root[data-uitheme='modern']` swaps surface/ink tokens to cool neutrals,
  hard shadows → soft layered elevation, panel-border tokens get hairline +
  lift; class rules round corners (`.cth-panel` 10px, `.cth-btn` 8px,
  `.cth-badge` pill, inputs 8px — `!important` to beat inline styles);
  spacing scale one step airier (`--cth-space-3: 14px`, `--cth-space-4: 20px`);
  500-600 font weights + slight letter-spacing for consistency.
  Also in modern.css: slim ROUNDED scrollbars app-wide
  (`::-webkit-scrollbar` 10px, rounded thumb cut from the track, hover
  deepen, transparent track/corner) — the rectangular OS scrollbar was the
  loudest "not a modern app" tell; and the `cth-chat-composer` chat input
  skin (see 4.11).
- Class hooks added to the three shared primitives (one line each):
  `PixelPanel.tsx` → `cth-panel`, `PixelButton.tsx` → `cth-btn`,
  `PixelBadge.tsx` → `cth-badge`.
- `global.css`: `@import './modern.css'` (and `'./animations.css'`).
- App stamps `data-uitheme` on `<html>`.

### 4.4 `uiIcons` — icon pack swap (pixel ↔ HugeIcons free)

- New deps (installed with `--ignore-scripts`): `@hugeicons/react`,
  `@hugeicons/core-free-icons`.
- `src/renderer/src/components/Icon.tsx`: added a `hugeIcons` map keyed by the
  SAME `IconName` (22 glyphs; mic→AudioLinesIcon, mcp→FlowConnectionIcon) and
  a pack branch in `Icon()`. **The pack is read from the zustand store**
  (`useStore(s => s.uiIcons)`) — do NOT read the `data-uiicons` attribute
  there: it is stamped by an App effect AFTER render, so attribute reads serve
  every switch one toggle late (that bug once read as "the toggle is
  inverted").
- Not covered by the swap: bespoke glyph components outside `Icon.tsx`
  (title-bar stroke glyphs — only visible when the rail is off).

### 4.5 `sidebarNav` — left SideRail with real navigation

- **New file** `src/renderer/src/components/SideRail.tsx`. Collapsed (52px):
  icons only. **Expanded (184px): labels beside every icon** (expand toggle is
  the last bottom rail button; state persists in localStorage key
  `cth.railExpanded`). Brand row at top (+ wordmark when expanded) doubles as
  the WINDOW DRAG REGION, and `<UpdateBadge />` (update control) lives under
  it — because the top title bar is hidden ENTIRELY while the rail is on
  (rail off = the classic upstream title bar returns unchanged). NAV group =
  ALL Command Center tabs (terminal / monitor(floor) / tasks / ask me(human)
  / triggers / history(trigger-history) / memory / graph / activity / skills /
  workers) — clicking selects the god agent (`store.select`) and requests the
  tab via the EXISTING `store.requestCommandCenterTab(tab)` (the same path
  the office task board uses — zero upstream plumbing); the ACTIVE tab stays
  highlighted in the rail (CommandCenterPanel publishes `ccActiveTab` to the
  store on every switch). A divider below the nav group, then floor actions:
  **Auto** (floor-wide queue auto-delivery, mirrors
  `ccFloorDeliveryPaused` in the store) and **IDE** (opens the editor for the
  selected agent); bottom group = theme / settings / fullscreen + expand
  toggle.
- **Rail mode also strips the panel tops:** the Command Center's own tab bar
  and its Auto/IDE header buttons are hidden while the rail is on (still
  shown in the fullscreen overlay, where the rail is unreachable), and the
  per-agent header's IDE button is hidden too (`AgentDetailPanel.tsx`).
  Rail OFF = every upstream surface returns unchanged.
- `src/renderer/src/App.tsx`: outer layout becomes a row when the rail is on
  (`flexDirection: sidebarNavOn ? 'row' : 'column'`), content wrapped in an
  inner column div; the whole title bar renders only when the rail is OFF.
- `animations.css`: `.cth-rail` width transition + label fade-in on expand.
- **Settings → "New Look" tab** [personal]: ALL fork toggles live in their own
  Settings section (added to `Section` + `NAV_SECTIONS` and the rows moved out
  of General). Toggle rows initialize from the ZUSTAND STORE, not the config
  prop — App's config snapshot is loaded once at boot, so prop-based initial
  state showed stale values every time the modal reopened (that read as
  "split mode turns itself off"; it never did — config.json was correct all
  along).
- Rail layout below the nav divider: **History** (still gated on
  `triggerHistoryVisible`), then the **Auto switcher** — a two-option
  segmented control (`RailSwitch`) whose background thumb slides between
  Auto/Paused (`.cth-switch-thumb` transition in animations.css; collapsed
  rail keeps the icon button) — then IDE.
- `AgentStrip.tsx`: cards are `draggable` ONLY while Split Agent Mode is on —
  with it off the strip is exactly upstream (no drag at all, including
  roster-reorder).

### 4.6 `uiAnimations` — motion layer

- **New file** `src/renderer/src/design/animations.css`, gated by
  `:root[data-animations='on']`: hover fades/brightness micro-lifts (uses
  `filter`, NOT transform — PixelButton asserts `transform` inline for its
  pressed state), keyboard focus rings, `.cth-panel` mount fade-rise, and the
  `.cth-rail-glide` transition (top/height 180ms). Respects
  `prefers-reduced-motion`.
- `SettingsModal.tsx`: `setActiveSection` wrapper records nav direction;
  the content pane is keyed by section with class `cth-tab-in-down` /
  `cth-tab-in-up` → entering sections slide in from the direction of travel.

### 4.7 `splitAgentMode` — Split Agent Mode (drag an agent side-by-side)

- **New file** `src/renderer/src/components/SplitAgentPanel.tsx` — one agent's
  terminal in a panel (header with portrait/status/swap-side/close, embedded
  PtyTerminalView, empty-state if no PTY).
- Store [personal]: `splitView { agentId, side } | null` + setter,
  `draggingAgentId` (published by AgentStrip's EXISTING HTML5 drag — its
  onDragStart/onDrop/onDragEnd gained one-line `useStore.setState` mirrors).
- `App.tsx` [personal]: while the mode is on, the main content row is a DROP
  ZONE — dragging a strip card over it tints the half the pointer is on
  ("open on the left/right" preview); dropping opens the agent's terminal on
  that edge beside the command-center column. The drag handlers MUST be JSX
  props on the div — nesting them inside the `style` object silently disables
  them (the "not allowed" cursor bug; fixed). Auto-closes if the agent leaves
  the roster. Split panel also has a swap-side button.
- **One-PTY guard** [personal]: while the split shows agent X, X's own detail
  panel / the god Command Center shows a placeholder instead (same rule as
  fullscreen mode): `AgentDetailPanel.tsx` (`isSplitHere` → EmptyTab) and
  `CommandCenterPanel.tsx` (`splits.some(...)` → Centered).
- **UNLIMITED splits** (owner decision — an earlier 3-cap was removed; every
  dropped agent gets its own pane at 1/N width). Store field is `splits:
  SplitSlot[]`. Pane widths live in App as `fracs` (equal on open/close,
  adjustable via `PaneResizer` drag handles between panes, 10–85% clamp).
  Dropping an ALREADY-SPLIT agent moves it to the dropped edge.
- **Drag handle**: SplitAgentPanel's swap button is replaced by a `drag`-icon
  handle (`IconName: 'drag'`, pixel six-dot grip / HugeIcons Drag02Icon).
  Hold-drag it; the main-area drop zone re-pins that agent's split to the
  dropped half (same path as opening a split).
- Terminal zoom pills (−/px/+ in PtyTerminalView) got the `cth-pill` class →
  rounded modern look when `uiTheme='modern'`.

### 4.8b `uiPortraits` — SVG avatar pack (drop-in)

- **New file** `src/renderer/src/components/portraitPack.ts` — globs
  `src/renderer/src/assets/avatars/*.svg` (eager, ?url) and picks a STABLE
  avatar per character (hash). Empty folder → null → SpritePortrait falls
  back to the upstream pixel canvas, no error.
- `SpritePortrait.tsx` [personal]: `svg` mode renders the picked `<img>`
  instead of painting the canvas busts.
- **Drop your SVG collection into
  `src/renderer/src/assets/avatars/`** (owner's pack: 3D-style avatars), then
  Settings → Appearance → Portraits → `3D`. Adding/removing files reshuffles
  picks (hash) — expected while curating.
- **3D display rules** (why it looked cropped at first): pixel busts use
  portrait-ratio tiles (36×46 etc.) with deliberate top-anchor + foot-crop;
  3D avatars instead FILL their tile with `objectFit: contain` — never
  cropped, never stretched — and the tiles are bigger + centered in 3D mode
  (AgentCard 46×52/56, AgentDetailPanel 40×40, SplitAgentPanel 38×38).

### 4.8 `appName` — editable display name

- `SettingsHeroCard.tsx` [personal]: the name is click-to-edit (Enter/blur
  saves, Esc cancels, 40-char cap) and persists to config.appName.
- `SideRail.tsx`: the expanded wordmark renders `appName`.

---

### 4.11 `agentChatView` — chat-style agent interface (GUI over the session)

- **New file** `src/renderer/src/components/AgentChatPanel.tsx` — each agent's
  session rendered as a CHAT (Claude-Desktop-style): user/assistant message
  bubbles, tool calls as compact chips, animated working… dots, smart
  bottom-pinning, and the existing MessageQueueComposer for input. A "raw
  terminal" button opens the live PTY fullscreen — the terminal is never far.
- **Data source:** Claude Code's OWN session JSONL transcript (NOT ANSI/PTY
  scraping — every turn is already structured there). [personal] additions:
  `readSessionMessages()` in `src/main/transcript.ts`, IPC
  `transcript:messages` (uses `hookServer.transcriptPath(agentId)`, same
  source as agentContext), preload `transcriptMessages()`. Polls every 2s +
  refetch on status change. Null transcript (hooks not fired / non-Claude
  provider) = honest empty state + escape hatch.
- Toggle: `agentChatView` (default OFF), Settings → Appearance → "Agent chat
  view". Wired in `AgentDetailPanel`'s terminal tab (chatView ternary);
  split panels + god Command Center keep raw terminals.
- Follow-ups in the same gate: god Command Center terminal tab also gets the
  chat view (with a "back to chat" bar when you open the raw terminal);
  full markdown in bubbles via the app's hardened `MarkdownPreview`
  (tables/code/bold), opt-in `math` prop adds KaTeX (`remark-math` +
  `rehype-katex` — MathML-based, no raw HTML); consecutive assistant records
  are merged so one reply isn't split into fragment bubbles.
- **Chat composer skin:** `chatSkin` prop (set by both chat branches) adds a
  `cth-chat-composer` class — modern.css only. The queue textarea becomes a
  rounded, obvious message box (Claude-Desktop look); all queue mechanics
  (held messages, status hints, attachments, busy queueing) are untouched.
  Classic skin / raw-terminal mode never see it — upstream rendering there
  is byte-for-byte unchanged.

### 4.10 Terminals follow named themes

- `PtyTerminalView.tsx` [personal]: when a preset is active, the xterm palette
  is built from the LIVE CSS tokens (`paletteFromTokens()` reads computed
  styles — resolves vars incl. color-mix) instead of the fixed light/dark
  tables; re-applied on preset/skin change. The re-apply is deferred one
  rAF — child effects run before App stamps `data-ctheme`, so a synchronous
  read served the PREVIOUS theme's colors (the "terminal stuck on the last
  theme" bug).

### 4.9 `uiThemePreset` — named color themes (modern-only)

- **New file** `src/renderer/src/design/themes.css` — one token block per
  theme, gated on `:root[data-uitheme='modern'][data-ctheme='<id>']`. Shipped
  set: `one-dark` (One Dark Pro), `github-dark`, `nord`, `rose-pine`,
  `one-light`, plus `default` (untinted modern). A theme intentionally
  overrides the app light/dark toggle (a theme IS the palette). Accent tints
  and panel borders derive via `color-mix` from each theme's own colors.
- `Settings → Appearance → "Theme"` dropdown (visible only while UI style is
  modern) — config key `uiThemePreset`, stamped as `data-ctheme` on `<html>`.
- Renamed the Settings section **"New Look" → "Appearance"** (upstream never
  had an Appearance tab; office themes lived in General before the fork moved
  them). The section's intro header read "PERSONAL FORK" → now "APPEARANCE".

## 5. New files added by the fork (never conflict upstream)

- `src/renderer/src/design/modern.css`
- `src/renderer/src/design/animations.css`
- `src/renderer/src/design/themes.css`
- `src/renderer/src/components/SideRail.tsx`
- `CHANGE NOTES.md` (this file), `AGENTS.md`

## 6. Upstream files with `[personal]` edits

`git grep -n "\[personal\]"` lists them; the recurring set:

- `package.json` (scripts: `dev:main`; deps: hugeicons)
- `src/main/index.ts` (dev data isolation)
- `src/main/config.ts` (6 keys + DEFAULTS)
- `src/preload/index.ts` (type mirrors)
- `src/renderer/index.html` (font link)
- `src/renderer/src/store/config.ts` (type mirrors)
- `src/renderer/src/store/store.ts` (mirrors + setters)
- `src/renderer/src/App.tsx` (seeds, effects, layout gates, title-bar gating)
- `src/renderer/src/design/tokens.css` (font-mode blocks)
- `src/renderer/src/design/global.css` (two @imports)
- `src/renderer/src/components/Icon.tsx` (pack branch)
- `src/renderer/src/components/PixelPanel.tsx` / `PixelButton.tsx` /
  `PixelBadge.tsx` (one-line class hooks)
- `src/renderer/src/components/SettingsModal.tsx` (toggle rows + tab direction)

## 7. After every upstream merge

1. `npm install --ignore-scripts` + re-apply the node-pty Spectre patch
   (section 2) + electron-rebuild.
2. `npm run typecheck` — the type mirrors (preload/store/config.ts) are the
   first thing upstream refactors break.
3. Launch `npm run dev` (sandbox data) and flip every toggle in Settings once;
   then `dev:main` against real data (backup first).
4. Update this file if anything above changed.
