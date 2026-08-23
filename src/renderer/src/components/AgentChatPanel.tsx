/**
 * [personal] AgentChatPanel — a chat-style interface over an agent's session,
 * like Claude Desktop / ZCode: user and assistant MESSAGES as bubbles, tool
 * calls as compact chips, a live "working…" indicator, and the existing
 * MessageQueueComposer for input. The raw PTY terminal stays one click away
 * (the fullscreen button in this header, or the Appearance toggle).
 *
 * DATA SOURCE (why this is not fragile): it does NOT scrape the PTY's ANSI
 * stream — it reads Claude Code's own session JSONL transcript (the same
 * source agentContext/usage read), where every user turn, assistant text
 * block and tool use is already structured. Polled (2s) + refetched on agent
 * status changes; null transcript (hooks not fired yet / non-Claude agent)
 * renders an honest empty state with the raw-terminal escape hatch.
 */
import { useEffect, useRef, useState } from 'react';
import { useStore, type Agent } from '@/store/store';
import { PixelButton } from './PixelButton';
import { Icon } from './Icon';
import { SpritePortrait } from './SpritePortrait';
import { MarkdownPreview } from '@/markdown/MarkdownPreview'; // [personal]

interface ChatToolUse { name: string; brief: string }
/** [personal] ordered turn pieces — text and tool calls replayed in the order
 *  they happened (without this, every tool chip lands at the bubble's bottom). */
type ChatSegment = { kind: 'text'; text: string } | { kind: 'tool'; name: string; brief: string };
interface ChatMsg {
  role: 'user' | 'assistant';
  text: string;
  tools?: ChatToolUse[];
  segments?: ChatSegment[];
  ts?: number;
}

const POLL_MS = 2000;

export function AgentChatPanel({ agent, onShowRaw }: { agent: Agent; onShowRaw?: () => void }) {
  const [msgs, setMsgs] = useState<ChatMsg[] | null>(null);
  const [noTranscript, setNoTranscript] = useState(false);
  const status = useStore((s) => s.agents.find((a) => a.id === agent.id)?.status ?? 'idle');
  const setFullscreen = useStore((s) => s.setFullscreen);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);

  const load = async (): Promise<void> => {
    try {
      const res = await window.cth.transcriptMessages(agent.id, 200);
      if (res === null) { setNoTranscript(true); return; }
      setNoTranscript(false);
      setMsgs(res);
    } catch { /* transient */ }
  };

  useEffect(() => {
    void load();
    const t = setInterval(() => { void load(); }, POLL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.id]);

  // Refetch the moment activity state changes (a turn just started/ended).
  useEffect(() => { void load(); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep pinned to bottom while the user is at the bottom (reading older
  // history shouldn't be yanked down by new messages).
  useEffect(() => {
    const el = scrollRef.current;
    if (el && pinnedRef.current) el.scrollTop = el.scrollHeight;
  }, [msgs]);

  const onScroll = (): void => {
    const el = scrollRef.current;
    if (!el) return;
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  const working = status === 'thinking' || status === 'working' || status === 'compacting';

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 10px', flexShrink: 0,
        borderBottom: '1px solid var(--cth-ink-100)',
        background: 'var(--cth-cream-100)'
      }}>
        {/* sized box: the 3D img fills 100%/100% of its container, so without
            fixed bounds it renders at natural size (the giant-avatar bug). */}
        <div style={{
          width: 40, height: 40, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', borderRadius: 8
        }}>
          <SpritePortrait character={agent.character} scale={1} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--cth-ink-900)' }}>{agent.name}</span>
          <span style={{ fontSize: 12, color: 'var(--cth-ink-500)', marginLeft: 8 }}>
            {noTranscript ? 'no session transcript yet' : `${msgs?.length ?? 0} messages`}
          </span>
        </div>
        <PixelButton
          variant="secondary"
          size="sm"
          onClick={() => (onShowRaw ? onShowRaw() : setFullscreen(agent.id))}
          title={onShowRaw ? 'Switch this pane to the raw terminal' : 'Open the raw terminal in fullscreen'}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Icon name="terminal" /> raw terminal
          </span>
        </PixelButton>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        style={{
          flex: 1, minHeight: 0, overflowY: 'auto',
          padding: '14px 14px 8px',
          background: 'var(--cth-paper-200)',
          display: 'flex', flexDirection: 'column', gap: 10
        }}
      >
        {noTranscript && (
          <div style={{ margin: 'auto', maxWidth: 320, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
            <Icon name="info" />
            <p style={{ margin: 0, fontSize: 13, lineHeight: '19px', color: 'var(--cth-ink-700)' }}>
              No session transcript yet — it appears once the agent's hooks fire
              (usually seconds after it starts working). The raw terminal has
              everything in the meantime.
            </p>
          </div>
        )}
        {msgs?.map((m, i) => <Bubble key={i} m={m} />)}
        {working && (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '2px 6px' }}>
            <span className="cth-chat-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--cth-ink-500)' }} />
            <span className="cth-chat-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--cth-ink-500)', animationDelay: '200ms' }} />
            <span className="cth-chat-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--cth-ink-500)', animationDelay: '400ms' }} />
            <span style={{ fontSize: 12, color: 'var(--cth-ink-500)', marginLeft: 4 }}>
              {status === 'compacting' ? 'compacting context…' : 'working…'}
            </span>
          </div>
        )}
        {!working && msgs && msgs.length === 0 && !noTranscript && (
          <div style={{ margin: 'auto', fontSize: 13, color: 'var(--cth-ink-500)' }}>
            Session started — messages will appear here.
          </div>
        )}
      </div>
    </div>
  );
}

function Bubble({ m }: { m: ChatMsg }) {
  const isUser = m.role === 'user';
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      maxWidth: '86%'
    }}>
      {isUser ? (
        <div style={{
          padding: '8px 12px',
          background: 'var(--cth-sky-light)',
          boxShadow: 'inset 0 0 0 1px var(--cth-ink-100)',
          borderRadius: 12,
          borderBottomRightRadius: 4,
          fontSize: 13.5, lineHeight: '20px',
          color: 'var(--cth-ink-900)',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word'
        }}>
          {m.text}
        </div>
      ) : m.segments && m.segments.length > 0 ? (
        /* [personal] ordered render: each text piece is markdown, each tool
           call a chip, exactly where it happened in the turn. */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
          {m.segments.map((seg, i) =>
            seg.kind === 'text' ? (
              <div key={i} className="cth-md-preview cth-md-chat" style={{ padding: '2px 2px' }}>
                <MarkdownPreview source={seg.text} math />
              </div>
            ) : (
              <ToolChip key={i} name={seg.name} brief={seg.brief} />
            )
          )}
        </div>
      ) : (
        /* fallback for transcripts without segments (older IPC shape) */
        <>
          <div style={{
            padding: '2px 2px',
            fontSize: 13.5, lineHeight: '20px',
            color: 'var(--cth-ink-900)'
          }}>
            <div className="cth-md-preview cth-md-chat">
              <MarkdownPreview source={m.text} math />
            </div>
          </div>
          {m.tools && m.tools.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4, width: '100%' }}>
              {m.tools.map((t, i) => <ToolChip key={i} name={t.name} brief={t.brief} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ToolChip({ name, brief }: { name: string; brief: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '3px 8px',
      background: 'var(--cth-cream-200)',
      boxShadow: 'inset 0 0 0 1px var(--cth-ink-100)',
      borderRadius: 6,
      fontSize: 12, color: 'var(--cth-ink-700)',
      whiteSpace: 'nowrap', overflow: 'hidden'
    }}>
      <span style={{ flexShrink: 0, color: 'var(--cth-mint)', fontWeight: 600 }}>{name}</span>
      {brief && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{brief}</span>}
    </div>
  );
}
