import { useEffect, useRef } from 'react';

interface ParticipantTileProps {
  name: string;
  stream: MediaStream | null;
  speaking: boolean;
  muted: boolean;
  sharing: boolean;
  isSelf?: boolean;
  variant?: 'tile' | 'stage';
}

function initials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase() || '?';
}

export default function ParticipantTile({
  name,
  stream,
  speaking,
  muted,
  sharing,
  isSelf,
  variant = 'tile',
}: ParticipantTileProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hasVideo = !!stream && stream.getVideoTracks().length > 0;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (hasVideo && stream) {
      video.srcObject = stream;
    } else {
      video.srcObject = null;
    }
  }, [stream, hasVideo]);

  return (
    <div className={`call-tile ${variant} ${speaking ? 'speaking' : ''}`}>
      {hasVideo ? (
        <video className="call-video" autoPlay playsInline muted ref={videoRef} />
      ) : (
        <div className="call-avatar">{initials(name)}</div>
      )}
      <div className="call-name">
        {name}
        {isSelf ? ' (você)' : ''}
      </div>
      <div className="call-icons">
        {muted && (
          <span title="Mudo" aria-label="Mudo">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </span>
        )}
        {sharing && (
          <span title="Compartilhando" aria-label="Compartilhando">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </span>
        )}
      </div>
    </div>
  );
}
