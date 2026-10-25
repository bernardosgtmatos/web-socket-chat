interface VoiceControlsProps {
  muted: boolean;
  sharing: boolean;
  onToggleMute: () => void;
  onToggleShare: () => void;
  onLeave: () => void;
}

function MicIcon({ off }: { off: boolean }) {
  if (off) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
        <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function ScreenIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function PhoneOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91" />
      <line x1="23" y1="1" x2="1" y2="23" />
    </svg>
  );
}

export default function VoiceControls({
  muted,
  sharing,
  onToggleMute,
  onToggleShare,
  onLeave,
}: VoiceControlsProps) {
  return (
    <div className="voice-controls">
      <button
        type="button"
        className={`vc-btn ${muted ? 'is-off' : ''}`}
        onClick={onToggleMute}
        aria-label={muted ? 'Ativar microfone' : 'Mutar microfone'}
        aria-pressed={muted}
        title={muted ? 'Ativar microfone' : 'Mutar microfone'}
      >
        <MicIcon off={muted} />
      </button>
      <button
        type="button"
        className={`vc-btn ${sharing ? 'is-active' : ''}`}
        onClick={onToggleShare}
        aria-label={sharing ? 'Parar compartilhamento de tela' : 'Compartilhar tela'}
        aria-pressed={sharing}
        title={sharing ? 'Parar compartilhamento' : 'Compartilhar tela'}
      >
        <ScreenIcon />
      </button>
      <button
        type="button"
        className="vc-btn leave"
        onClick={onLeave}
        aria-label="Desligar chamada"
        title="Desligar"
      >
        <PhoneOffIcon />
      </button>
    </div>
  );
}
