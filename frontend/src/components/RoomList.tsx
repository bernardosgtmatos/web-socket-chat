import type { Room } from '../types';

interface RoomListProps {
  rooms: Room[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onJoin: (id: string) => void;
}

function HashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="9" x2="20" y2="9" />
      <line x1="4" y1="15" x2="20" y2="15" />
      <line x1="10" y1="3" x2="8" y2="21" />
      <line x1="16" y1="3" x2="14" y2="21" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export default function RoomList({ rooms, activeId, onSelect, onJoin }: RoomListProps) {
  if (rooms.length === 0) {
    return <p className="empty">Nenhuma sala ainda. Crie a primeira ao lado.</p>;
  }
  return (
    <ul className="room-list">
      {rooms.map((r) => (
        <li key={r.id} className={`room-item ${r.id === activeId ? 'active' : ''}`}>
          <button type="button" className="room-btn" onClick={() => (r.isMember ? onSelect(r.id) : onJoin(r.id))}>
            <span className="room-icon">{r.isPrivate ? <LockIcon /> : <HashIcon />}</span>
            <span className="room-name">{r.name}</span>
            {!r.isMember && <span className="badge">entrar</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}
