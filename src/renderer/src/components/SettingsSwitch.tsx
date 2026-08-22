/**
 * [personal] SettingsSwitch — a real on/off switch for Settings rows, used
 * INSTEAD of the on/off PixelButton while the modern skin is on (classic mode
 * keeps the upstream buttons). Thumb slides via the shared .cth-switch-thumb
 * transition in animations.css; track color cross-fades inline.
 */
export function SettingsSwitch({ on, onChange, title }: {
  on: boolean;
  onChange: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      title={title}
      onClick={onChange}
      className="cth-settings-switch"
      style={{
        width: 38, height: 22, padding: 0, border: 'none', cursor: 'pointer',
        borderRadius: 999, flexShrink: 0,
        background: on ? 'var(--cth-mint)' : 'var(--cth-cream-300)',
        boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)',
        position: 'relative',
        transition: 'background-color 180ms cubic-bezier(0.2, 0.8, 0.2, 1)'
      }}
    >
      <span
        className="cth-switch-thumb"
        style={{
          position: 'absolute', top: 2, left: 2,
          width: 18, height: 18, borderRadius: '50%',
          background: '#FFFFFF',
          boxShadow: '0 1px 2px rgba(24, 26, 33, 0.35)',
          transform: on ? 'translateX(16px)' : 'translateX(0)'
        }}
      />
    </button>
  );
}
