/**
 * [personal] SideRail — the optional left icon rail (Settings → General →
 * "Sidebar"). Collapsed (52px) it shows icons only; EXPANDED (~180px) it shows
 * labels beside every icon (professional sidebar register). The expand state
 * persists in localStorage (per-window UI state, same pattern as the theme) —
 * no config key, no main-process round trip.
 *
 * Navigation: Command Center tabs (terminal / monitor / tasks / ask me /
 * triggers / memory) select the god agent and request the tab via the EXISTING
 * store mechanism (requestCommandCenterTab). App actions (theme / settings /
 * fullscreen) dock to the bottom, plus the expand/collapse toggle.
 *
 * Toggle: config.sidebarNav (fork default ON; upstream has no rail).
 * Motion: width/opacity transitions + per-group glide highlight, all gated by
 * design/animations.css on data-animations.
 */
import { useContext, createContext, useEffect, useRef, useState, CSSProperties, ReactNode } from 'react';
import { useAppTheme, toggleAppTheme } from '@/design/theme';
import { useStore, triggerHistoryVisible } from '@/store/store';
import { Icon, type IconName } from '@/components/Icon';
import { UpdateBadge } from '@/components/UpdateBadge';
import brandLogo from '@brand/logo.png?url';

export interface SideRailProps {
  onOpenSettings: (section?: 'General') => void;
}

const LS_RAIL_EXPANDED = 'cth.railExpanded';
const RAIL_WIDTH_COLLAPSED = 52;
const RAIL_WIDTH_EXPANDED = 184;

/** Lets RailButtons reach their group's glide without prop-drilling. */
const RailGlideCtx = createContext<(el: HTMLElement | null) => void>(() => {});

/** One vertical group of rail buttons with a shared sliding glide highlight. */
function RailGroup({ children }: { children: ReactNode }) {
  const glideRef = useRef<HTMLDivElement>(null);
  const [glideOn, setGlideOn] = useState(false);

  const moveTo = (el: HTMLElement | null): void => {
    const glide = glideRef.current;
    if (!glide) return;
    if (!el) { setGlideOn(false); return; }
    glide.style.top = `${el.offsetTop}px`;
    glide.style.height = `${el.offsetHeight}px`;
    setGlideOn(true);
  };

  return (
    <RailGlideCtx.Provider value={moveTo}>
      <div
        style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}
        onMouseLeave={() => moveTo(null)}
      >
        <div
          ref={glideRef}
          className="cth-rail-glide"
          style={{
            position: 'absolute', left: 0, right: 0, top: 0, height: 36,
            background: 'var(--cth-cream-200)',
            boxShadow: 'inset 0 0 0 1px var(--cth-ink-100)',
            borderRadius: 8,
            opacity: glideOn ? 1 : 0,
            pointerEvents: 'none',
            zIndex: 0
          }}
        />
        {children}
      </div>
    </RailGlideCtx.Provider>
  );
}

interface RailButtonProps {
  title: string;
  icon: ReactNode;
  label: string;            // shown when expanded
  expanded: boolean;
  active?: boolean;         // [personal] current CC tab → persistent highlight
  onClick: () => void;
}

function RailButton({ title, icon, label, expanded, active = false, onClick }: RailButtonProps) {
  const moveTo = useContext(RailGlideCtx);
  return (
    <button
      className="cth-rail-btn"
      title={title}
      aria-label={title}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
      onMouseEnter={(e) => moveTo(e.currentTarget)}
      style={{
        position: 'relative', zIndex: 1,
        display: 'inline-flex', alignItems: 'center',
        justifyContent: expanded ? 'flex-start' : 'center',
        gap: expanded ? 10 : 0,
        width: '100%', height: 36,
        padding: expanded ? '0 12px' : 0,
        background: active ? 'var(--cth-cream-200)' : 'transparent',
        boxShadow: active ? 'inset 0 0 0 1px var(--cth-ink-300)' : 'none',
        borderRadius: 8,
        border: 'none', cursor: 'pointer',
        color: active ? 'var(--cth-ink-900)' : 'var(--cth-ink-700)',
        whiteSpace: 'nowrap', overflow: 'hidden'
      }}
    >
      <span style={{ display: 'inline-flex', flexShrink: 0 }}>{icon}</span>
      {expanded && (
        <span className="cth-rail-label" style={{
          fontSize: 13, lineHeight: '16px',
          fontFamily: 'var(--cth-font-ui)',
          color: 'var(--cth-ink-900)'
        }}>
          {label}
        </span>
      )}
    </button>
  );
}

/** [personal] A two-option switcher with a background thumb that SLIDES
 *  between options (transition in animations.css, gated by the motion layer).
 *  Used for binary floor controls where a momentary button would hide the
 *  state. */
function RailSwitch({ options, value, onChange }: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
}) {
  const idx = Math.max(0, options.findIndex((o) => o.key === value));
  return (
    <div style={{
      display: 'flex', height: 32, width: '100%',
      background: 'var(--cth-cream-100)',
      boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)',
      borderRadius: 8, overflow: 'hidden', position: 'relative',
      margin: '2px 0'
    }}>
      <div
        className="cth-switch-thumb"
        style={{
          position: 'absolute', top: 2, bottom: 2, left: 2,
          width: `calc(${100 / options.length}% - 4px)`,
          transform: `translateX(${idx * 100}%)`,
          background: 'var(--cth-cream-200)',
          boxShadow: 'inset 0 0 0 1px var(--cth-ink-100)',
          borderRadius: 6
        }}
      />
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          style={{
            flex: 1, position: 'relative', zIndex: 1,
            background: 'transparent', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--cth-font-ui)', fontSize: 12, lineHeight: 1,
            fontWeight: o.key === value ? 600 : 500,
            color: o.key === value ? 'var(--cth-ink-900)' : 'var(--cth-ink-500)',
            whiteSpace: 'nowrap', overflow: 'hidden'
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** [personal] Rail navigation: selects the god agent (whose detail panel IS
 *  the Command Center) and requests the tab — the same store path the office
 *  task board already uses, so nothing upstream is touched. */
function useCcNav() {
  return (tab: string) => {
    const s = useStore.getState();
    const god = s.agents.find((a) => a.isGod);
    if (!god) return;
    if (s.selectedId !== god.id) s.select(god.id);
    s.requestCommandCenterTab(tab);
  };
}

export function SideRail({ onOpenSettings }: SideRailProps) {
  const appThemeNow = useAppTheme();
  const fullscreenAgentId = useStore(s => s.fullscreenAgentId);
  const openCc = useCcNav();
  // [personal] Active-nav highlight + the floor Auto state, both published by
  // CommandCenterPanel into the store.
  const ccActiveTab = useStore(s => s.ccActiveTab);
  const selectedId = useStore(s => s.selectedId);
  const godSelected = !!useStore(s => s.agents.find((a) => a.isGod && a.id === s.selectedId));
  const floorPaused = useStore(s => s.ccFloorDeliveryPaused);
  // [personal] editable display name (Settings hero) doubles as the wordmark
  const railAppName = useStore(s => s.appName);
  // [personal] the History ledger only exists once a webhook or org key is
  // configured — the SAME gate the Command Center uses for its own tab list.
  // Without this the rail shows a dead button on fresh installs.
  const historyVisible = useStore(triggerHistoryVisible);

  // [personal] Floor-wide queue auto-delivery — the SAME control the CC header
  // hosts in non-rail mode (kept in sync via the ccFloorDeliveryPaused mirror).
  const toggleFloorAuto = async () => {
    const next = !floorPaused;
    useStore.setState({ ccFloorDeliveryPaused: next });
    const all = useStore.getState().agents;
    await Promise.all(all.map((a) => window.cth.controlAutoDelivery(a.id, next).catch(() => null)));
  };

  // Expand state — localStorage-backed (per-window UI state, like the theme).
  const [expanded, setExpanded] = useState<boolean>(() => {
    try { return window.localStorage.getItem(LS_RAIL_EXPANDED) === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { window.localStorage.setItem(LS_RAIL_EXPANDED, expanded ? '1' : '0'); } catch { /* noop */ }
  }, [expanded]);

  // Command Center tabs surfaced as navigation — ALL of them. Keys are CCTab
  // values in CommandCenterPanel.tsx ('floor' renders as "monitor" there);
  // icons mirror that panel's own TABS mapping. History lives below the
  // divider (gated — only when the ledger can open).
  const nav: { key: string; title: string; label: string; icon: IconName }[] = [
    { key: 'terminal', title: 'Terminal (Michael)', label: 'Terminal', icon: 'terminal' },
    { key: 'floor', title: 'Monitor — the floor at a glance', label: 'Monitor', icon: 'mcp' },
    { key: 'tasks', title: 'Tasks — the board', label: 'Tasks', icon: 'check' },
    { key: 'human', title: 'Ask Me — Michael needs a human', label: 'Ask Me', icon: 'bell' },
    { key: 'triggers', title: 'Triggers — schedules & webhooks', label: 'Triggers', icon: 'clock' },
    { key: 'memory', title: 'Memory — the palace', label: 'Memory', icon: 'sparkle' },
    { key: 'graph', title: 'Graph — commit graph', label: 'Graph', icon: 'web' },
    { key: 'activity', title: 'Activity — recent events', label: 'Activity', icon: 'bell' },
    { key: 'skills', title: 'Skills — agent skills', label: 'Skills', icon: 'sparkle' },
    { key: 'workers', title: 'Workers — ephemeral Slack workers', label: 'Workers', icon: 'gear' }
  ];

  return (
    <nav
      aria-label="App navigation"
      className="cth-rail"
      style={{
        width: expanded ? RAIL_WIDTH_EXPANDED : RAIL_WIDTH_COLLAPSED,
        flexShrink: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'stretch',
        padding: '10px 8px',
        gap: 8,
        background: 'var(--cth-cream-100)',
        borderRight: '1px solid var(--cth-ink-300)',
        userSelect: 'none',
        overflow: 'hidden',
        whiteSpace: 'nowrap'
      }}
    >
      {/* Brand — logo when collapsed, logo + wordmark row when expanded.
          [personal] With the title bar hidden this row IS the window drag
          region (cth-titlebar-drag), so the window stays movable. */}
      <div
        className="cth-titlebar-drag"
        style={{
          display: 'flex', alignItems: 'center',
          gap: expanded ? 10 : 0,
          justifyContent: expanded ? 'flex-start' : 'center',
          padding: expanded ? '0 12px' : 0,
          height: 26
        }}
      >
        <img src={brandLogo} alt="" style={{ height: 22, width: 'auto', display: 'block', flexShrink: 0 }} />
        {expanded && (
          <span style={{
            fontFamily: 'var(--cth-font-ui)', fontWeight: 700,
            fontSize: 13, color: 'var(--cth-ink-900)'
          }}>
            {railAppName}
          </span>
        )}
      </div>
      {/* Update control lives in the rail (the title-bar badge is gone while
          the rail is on). Centers when collapsed, left-aligns when expanded. */}
      <div className="cth-titlebar-nodrag" style={{
        display: 'flex',
        justifyContent: expanded ? 'flex-start' : 'center',
        padding: expanded ? '0 12px' : 0,
        minHeight: 22
      }}>
        <UpdateBadge />
      </div>
      <div style={{ height: 1, background: 'var(--cth-ink-100)' }} />

      {/* Primary navigation — Command Center tabs. The active one stays
          highlighted (driven by the ccActiveTab store mirror) so navigation
          reads even with the CC's own tab bar hidden. */}
      <RailGroup>
        {nav.map((n) => (
          <RailButton
            key={n.key}
            title={n.title}
            label={n.label}
            expanded={expanded}
            active={godSelected && ccActiveTab === n.key}
            icon={<Icon name={n.icon} />}
            onClick={() => openCc(n.key)}
          />
        ))}
      </RailGroup>

      {/* [personal] Divider, then the floor tools: History (gated), the Auto
          switcher, and IDE — all moved off the panel tops in rail mode. */}
      <div style={{ height: 1, background: 'var(--cth-ink-100)' }} />
      <RailGroup>
        {historyVisible && (
          <RailButton
            title="History — the trigger ledger"
            label="History"
            expanded={expanded}
            active={godSelected && ccActiveTab === 'trigger-history'}
            icon={<Icon name="ledger" />}
            onClick={() => openCc('trigger-history')}
          />
        )}
        {/* Auto: binary, so expanded mode renders a two-option SWITCHER with a
            sliding background (animations.css); collapsed keeps the icon button. */}
        {expanded ? (
          <RailSwitch
            options={[{ key: 'auto', label: 'Auto' }, { key: 'paused', label: 'Paused' }]}
            value={floorPaused ? 'paused' : 'auto'}
            onChange={(k) => { if ((k === 'paused') !== floorPaused) void toggleFloorAuto(); }}
          />
        ) : (
          <RailButton
            title={floorPaused
              ? 'Automatic queue delivery is PAUSED for every agent — click to resume'
              : 'Automatic queue delivery is ON for every agent — click to pause the whole floor'}
            label={floorPaused ? 'Paused' : 'Auto'}
            expanded={expanded}
            active={floorPaused}
            icon={<Icon name={floorPaused ? 'pause' : 'play'} />}
            onClick={() => void toggleFloorAuto()}
          />
        )}
        <RailButton
          title="Open the IDE — file editor + git diff for the selected agent"
          label="IDE"
          expanded={expanded}
          icon={<Icon name="code" />}
          onClick={() => {
            const s = useStore.getState();
            if (s.selectedId) s.setIdeOpen(true, s.selectedId);
          }}
        />
      </RailGroup>

      <div style={{ flex: 1 }} />

      {/* App actions + expand toggle, docked bottom. */}
      <RailGroup>
        <RailButton
          title={appThemeNow === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme'}
          label="Theme"
          expanded={expanded}
          icon={<span style={{ fontSize: 14, lineHeight: 1 }}>{appThemeNow === 'dark' ? '☀' : '☾'}</span>}
          onClick={() => {
            const next = toggleAppTheme();
            // Same mirror as the old title-bar button: newly spawned agents get
            // the matching per-session Claude TUI theme.
            void window.cth.updateConfig({ terminalTheme: next });
          }}
        />
        <RailButton
          title="Settings"
          label="Settings"
          expanded={expanded}
          icon={<Icon name="gear" />}
          onClick={() => onOpenSettings('General')}
        />
        <RailButton
          title={fullscreenAgentId ? 'Exit fullscreen (Esc)' : 'Fullscreen terminal — selected agent'}
          label="Fullscreen"
          expanded={expanded}
          icon={<Icon name={fullscreenAgentId ? 'minimize' : 'expand'} />}
          onClick={() => {
            if (fullscreenAgentId) { useStore.getState().setFullscreen(null); return; }
            const all = useStore.getState().agents;
            const target = all.find((x) => x.id === useStore.getState().selectedId && x.ptyId)
              ?? all.find((x) => x.isGod && x.ptyId)
              ?? all.find((x) => x.ptyId);
            if (target) useStore.getState().setFullscreen(target.id);
          }}
        />
        <RailButton
          title={expanded ? 'Collapse the sidebar' : 'Expand the sidebar'}
          label={expanded ? 'Collapse' : 'Expand'}
          expanded={expanded}
          icon={<Icon name="sidebar" />}
          onClick={() => setExpanded((v) => !v)}
        />
      </RailGroup>
    </nav>
  );
}
