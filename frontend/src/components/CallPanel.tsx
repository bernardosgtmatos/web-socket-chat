import { useEffect, useRef } from 'react';
import type { CallParticipant } from '../types';
import ParticipantTile from './ParticipantTile';

interface CallPanelProps {
  roomName: string;
  participants: CallParticipant[];
  screenStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  speaking: Record<string, boolean>;
  selfId: string | null;
  username: string;
  muted: boolean;
  sharing: boolean;
  error: string | null;
}

interface VideoSource {
  key: string;
  name: string;
  stream: MediaStream;
  speaking: boolean;
  muted: boolean;
  sharing: boolean;
  isSelf?: boolean;
}

interface Person {
  key: string;
  name: string;
  speaking: boolean;
  muted: boolean;
  sharing: boolean;
  isSelf?: boolean;
}

function initials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase() || '?';
}

function MicOffIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function RemoteAudio({ stream }: { stream: MediaStream }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.srcObject !== stream) audio.srcObject = stream;
    return () => {
      audio.srcObject = null;
    };
  }, [stream]);

  return <audio ref={audioRef} autoPlay playsInline className="remote-audio" />;
}

export default function CallPanel({
  roomName,
  participants,
  screenStream,
  remoteStreams,
  speaking,
  selfId,
  username,
  muted,
  sharing,
  error,
}: CallPanelProps) {
  const selfSpeaking = selfId ? (speaking[selfId] ?? false) : false;

  const videos: VideoSource[] = [];
  if (sharing && screenStream) {
    videos.push({
      key: 'self',
      name: username,
      stream: screenStream,
      speaking: selfSpeaking,
      muted,
      sharing,
      isSelf: true,
    });
  }
  participants.forEach((p) => {
    const stream = remoteStreams.get(p.socketId);
    if (stream && stream.getVideoTracks().length > 0) {
      videos.push({
        key: p.socketId,
        name: p.username,
        stream,
        speaking: speaking[p.socketId] ?? false,
        muted: p.muted,
        sharing: p.sharing,
      });
    }
  });

  const people: Person[] = [
    { key: 'self', name: username, speaking: selfSpeaking, muted, sharing, isSelf: true },
    ...participants.map((p) => ({
      key: p.socketId,
      name: p.username,
      speaking: speaking[p.socketId] ?? false,
      muted: p.muted,
      sharing: p.sharing,
    })),
  ];

  return (
    <div className="call-stage">
      <div className="stage-topbar">
        <span className="stage-status">Voz conectada</span>
        <span className="stage-room">{roomName}</span>
        <span className="stage-count">{people.length} na chamada</span>
      </div>

      {error && <div className="error-banner stage-error">{error}</div>}

      {videos.length > 0 ? (
        <div className={`stage-grid ${videos.length === 1 ? 'single' : ''}`}>
          {videos.map((v) => (
            <ParticipantTile
              key={v.key}
              name={v.name}
              stream={v.stream}
              speaking={v.speaking}
              muted={v.muted}
              sharing={v.sharing}
              isSelf={v.isSelf}
              variant="stage"
            />
          ))}
        </div>
      ) : (
        <div className="voice-stage">
          <div className="voice-stage-grid">
            {people.map((p) => (
              <div key={p.key} className={`stage-person ${p.speaking ? 'speaking' : ''}`}>
                <div className="stage-avatar-wrap">
                  <div className="stage-avatar">{initials(p.name)}</div>
                  {(p.muted || p.sharing) && (
                    <div className="stage-badges">
                      {p.muted && (
                        <span className="stage-badge muted" title="Microfone mudo">
                          <MicOffIcon />
                        </span>
                      )}
                      {p.sharing && (
                        <span className="stage-badge share" title="Compartilhando tela">
                          <ScreenIcon />
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="stage-name">
                  {p.name}
                  {p.isSelf ? <em> (você)</em> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {participants.map((p) => {
        const stream = remoteStreams.get(p.socketId);
        return stream ? <RemoteAudio key={p.socketId} stream={stream} /> : null;
      })}
    </div>
  );
}
