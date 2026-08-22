/**
 * [personal] SplitAgentPanel — one agent's terminal shown side-by-side with
 * the main panel (Split Agent Mode). Opened by dragging an agent card from
 * the bottom strip into the main area and dropping it on the left or right
 * half; which half you drop on is the edge it occupies. App.tsx owns the drop
 * zone and mounts this on the chosen side of the command-center column.
 *
 * ONE PTY, ONE RENDERER: while this panel shows an agent's PTY, that agent's
 * detail panel (and the Command Center, for god) shows a placeholder instead —
 * two live xterms on one pty fight over cols/rows (the same rule fullscreen
 * mode already enforces; see AgentDetailPanel's isFullscreenedHere).
 */
import { useStore, type Agent } from '@/store/store';
import { usePtyParser } from '@/hooks/usePtyParser';
import { PtyTerminalView } from './PtyTerminalView';
import { terminalInstanceKey } from './terminalRecovery';
import { PixelPanel } from './PixelPanel';
import { PixelBadge } from './PixelBadge';
import { PixelButton } from './PixelButton';
import { SpritePortrait } from './SpritePortrait';
import { Icon } from './Icon';

export function SplitAgentPanel({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const updateAgent = useStore(s => s.updateAgent);
  const onPtyStream = usePtyParser(agent.id);


  return (
    <PixelPanel
      variant="default"
      noPadding
      style={{
        flex: '1 1 0', minWidth: 180,
        display: 'flex', flexDirection: 'column',
        height: '100%',
        overflow: 'hidden'
      }}
    >
      {/* Header strip — same DNA as the detail panel's. */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 8px',
        background: 'var(--cth-cream-100)',
        borderBottom: '1px solid var(--cth-ink-700)',
        flexShrink: 0
      }}>
        <div style={{
          width: 28, height: 28,
          background: `var(--cth-${agent.accent}-light)`,
          boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden',
          flexShrink: 0
        }}>
          <SpritePortrait character={agent.character} scale={1} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--cth-font-display)',
            fontSize: 10, lineHeight: '14px',
            color: 'var(--cth-ink-900)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
          }}>{agent.name.toUpperCase()}</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 1 }}>
            <PixelBadge status={agent.status} />
            <span style={{
              fontSize: 12, color: 'var(--cth-ink-500)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
            }}>{agent.project}</span>
          </div>
        </div>
        {/* [personal] DRAG HANDLE: hold and drag the panel — the main-area drop
            zone re-pins this agent's split to whichever half you drop on (same
            path as opening a split from the bottom strip). */}
        <div
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move';
            useStore.setState({ draggingAgentId: agent.id });
          }}
          onDragEnd={() => { useStore.setState({ draggingAgentId: null }); }}
          title="Hold and drag — drop on the left or right half to move this split there"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 24, cursor: 'grab',
            color: 'var(--cth-ink-700)',
            background: 'var(--cth-cream-200)',
            boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)',
            borderRadius: 6,
            flexShrink: 0
          }}
        >
          <Icon name="drag" />
        </div>
        <PixelButton variant="destructive" size="sm" onClick={onClose} title="Close this split">
          <Icon name="x" />
        </PixelButton>
      </div>

      {/* The terminal itself — embedded (never fullscreen; the overlay owns
          that mode). Falls back to a placeholder for spawned-not-started. */}
      {agent.ptyId ? (
        <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
          <PtyTerminalView
            key={terminalInstanceKey(agent.ptyId, agent.terminalGeneration)}
            ptyId={agent.ptyId}
            onStreamData={onPtyStream}
            onUserPrompt={(t) => {
              updateAgent(agent.id, { lastPrompt: t });
              if (t.trim().toLowerCase() === '/clear') {
                updateAgent(agent.id, { contextTokens: 0, contextLimit: undefined, progress: 0 });
              }
              void window.cth.historyAdd({ agentId: agent.id, cwd: agent.cwd, text: t });
            }}
            fullscreen={false}
            embedded
          />
        </div>
      ) : (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: 16, gap: 8,
          background: 'var(--cth-paper-200)'
        }}>
          <div style={{
            fontFamily: 'var(--cth-font-display)', fontSize: 10, lineHeight: '14px',
            color: 'var(--cth-ink-500)'
          }}>NO LIVE TERMINAL</div>
          <p style={{ margin: 0, fontSize: 13, textAlign: 'center', color: 'var(--cth-ink-700)', maxWidth: 280 }}>
            {agent.name} has no live PTY right now. The split stays open and fills in when one starts.
          </p>
        </div>
      )}
    </PixelPanel>
  );
}
