import type { CallParticipant } from '../types';

interface VoiceSectionProps {
  roomName: string;
  participants: CallParticipant[];
  selfId: string | null;
  username: string;
  muted: boolean;
  sharing: boolean;
  speaking: Record<string, boolean>;
}

function initials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase() || '?';
}

function SpeakerIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function ScreenIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function Badges({ muted, sharing }: { muted: boolean; sharing: boolean }) {
  if (!muted && !sharing) return null;
  return (
    <span className="vp-badges">
      {muted && (
        <span className="vp-badge muted" title="Microfone mudo">
          <MicOffIcon />
        </span>
      )}
      {sharing && (
        <span className="vp-badge share" title="Compartilhando tela">
          <ScreenIcon />
        </span>
      )}
    </span>
  );
}

export default function VoiceSection({
  roomName,
  participants,
  selfId,
  username,
  muted,
  sharing,
  speaking,
}: VoiceSectionProps) {
  const selfSpeaking = selfId ? (speaking[selfId] ?? false) : false;

  return (
    <section className="voice-section" aria-label="Chamada de voz conectada">
      <div className="voice-header">
        <span className="voice-signal"><SpeakerIcon /></span>
        <div className="voice-heading">
          <span className="voice-label">Voz conectada</span>
          <span className="voice-room">{roomName}</span>
        </div>
      </div>
      <ul className="voice-participants">
        <li className={`voice-participant ${selfSpeaking ? 'speaking' : ''}`}>
          <span className="vp-avatar">
            {initials(username)}
            <Badges muted={muted} sharing={sharing} />
          </span>
          <span className="vp-name">{username} <em>(você)</em></span>
        </li>
        {participants.map((p) => (
          <li key={p.socketId} className={`voice-participant ${speaking[p.socketId] ? 'speaking' : ''}`}>
            <span className="vp-avatar">
              {initials(p.username)}
              <Badges muted={p.muted} sharing={p.sharing} />
            </span>
            <span className="vp-name">{p.username}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
