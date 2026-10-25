import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { api } from '../api';
import type { Message, Room } from '../types';
import RoomList from '../components/RoomList';
import MessageList from '../components/MessageList';
import MessageInput from '../components/MessageInput';
import TypingIndicator from '../components/TypingIndicator';

interface HistoryPayload {
  roomId: string;
  messages: Array<{
    id: string;
    roomId: string;
    userId: string;
    username: string | null;
    text: string;
    createdAt: string;
  }>;
}

interface NewMessagePayload {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  text: string;
  createdAt: string;
}

interface TypingPayload {
  roomId: string;
  userId?: string;
  username: string;
  isTyping: boolean;
}

function toMessage(p: { id: string; roomId: string; userId: string; username: string | null; text: string; createdAt: string }): Message {
  return {
    id: p.id,
    roomId: p.roomId,
    text: p.text,
    createdAt: p.createdAt,
    user: { id: p.userId, username: p.username ?? 'unknown' },
  };
}

function initials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase() || '?';
}

function HashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="9" x2="20" y2="9" />
      <line x1="4" y1="15" x2="20" y2="15" />
      <line x1="10" y1="3" x2="8" y2="21" />
      <line x1="16" y1="3" x2="14" y2="21" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export default function ChatPage() {
  const { user, logout } = useAuth();
  const socket = useSocket();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomPrivate, setNewRoomPrivate] = useState(false);
  const [error, setError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  const activeRoomIdRef = useRef<string | null>(null);
  const prevActiveRoomIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api<Room[]>('/rooms')
      .then(setRooms)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load rooms'));
  }, [user]);

  useEffect(() => {
    activeRoomIdRef.current = activeRoomId;
  }, [activeRoomId]);

  useEffect(() => {
    if (!socket) return;
    const onHistory = (payload: HistoryPayload) => {
      if (payload.roomId !== activeRoomIdRef.current) return;
      setMessages(payload.messages.map(toMessage));
    };
    const onNew = (payload: NewMessagePayload) => {
      if (payload.roomId !== activeRoomIdRef.current) return;
      setMessages((prev) => [...prev, toMessage(payload)]);
    };
    const onTyping = (payload: TypingPayload) => {
      if (payload.roomId !== activeRoomIdRef.current) return;
      if (payload.username === user?.username) return;
      setTypingUsers((prev) => {
        const set = new Set(prev);
        if (payload.isTyping) set.add(payload.username);
        else set.delete(payload.username);
        return Array.from(set);
      });
    };
    const onJoined = () => {};
    const onLeft = () => {};
    const onError = (e: { message?: string }) => {
      if (e?.message) setError(e.message);
    };

    socket.on('room:history', onHistory);
    socket.on('message:new', onNew);
    socket.on('typing', onTyping);
    socket.on('user:joined', onJoined);
    socket.on('user:left', onLeft);
    socket.on('error', onError);

    return () => {
      socket.off('room:history', onHistory);
      socket.off('message:new', onNew);
      socket.off('typing', onTyping);
      socket.off('user:joined', onJoined);
      socket.off('user:left', onLeft);
      socket.off('error', onError);
    };
  }, [socket, user]);

  useEffect(() => {
    if (!socket || activeRoomId === null) return;
    setMessages([]);
    setTypingUsers([]);
    if (prevActiveRoomIdRef.current !== null && prevActiveRoomIdRef.current !== activeRoomId) {
      socket.emit('room:leave', { roomId: prevActiveRoomIdRef.current });
    }
    socket.emit('room:join', { roomId: activeRoomId });
    prevActiveRoomIdRef.current = activeRoomId;
  }, [socket, activeRoomId]);

  const createRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    setError('');
    try {
      const room = await api<Room>('/rooms', {
        method: 'POST',
        body: JSON.stringify({ name: newRoomName.trim(), isPrivate: newRoomPrivate }),
      });
      setRooms((prev) => [room, ...prev]);
      setNewRoomName('');
      setActiveRoomId(room.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create room');
    }
  };

  const joinRoom = async (id: string) => {
    setError('');
    try {
      await api(`/rooms/${id}/join`, { method: 'POST' });
      setRooms((prev) => prev.map((r) => (r.id === id ? { ...r, isMember: true } : r)));
      setActiveRoomId(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join room');
    }
  };

  const sendMessage = (text: string) => {
    if (!socket || activeRoomId === null) return;
    socket.emit('message:send', { roomId: activeRoomId, text });
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      // ignore
    } finally {
      setLoggingOut(false);
    }
  };

  const activeRoom = rooms.find((r) => r.id === activeRoomId) ?? null;

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="user-chip">
            <div className="avatar">{initials(user?.username ?? '?')}</div>
            <div style={{ minWidth: 0 }}>
              <div className="name">{user?.username}</div>
              <div className="status">online</div>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={handleLogout} disabled={loggingOut} aria-label="Sair" title="Sair">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>

        <div>
          <p className="sidebar-section-title">Criar sala</p>
          <form className="create-room" onSubmit={createRoom}>
            <div className="row">
              <input
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="Nome da sala"
                aria-label="Nome da sala"
              />
              <button className="btn btn-primary btn-icon" type="submit" aria-label="Criar sala">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={newRoomPrivate} onChange={(e) => setNewRoomPrivate(e.target.checked)} />
              Sala privada
            </label>
          </form>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <p className="sidebar-section-title">Salas</p>
          <RoomList rooms={rooms} activeId={activeRoomId} onSelect={setActiveRoomId} onJoin={joinRoom} />
        </div>
      </aside>

      <main className="chat">
        {activeRoom ? (
          <>
            <header className="chat-header">
              <span className="room-icon">{activeRoom.isPrivate ? <LockIcon /> : <HashIcon />}</span>
              <div>
                <div className="chat-title">{activeRoom.name}</div>
                <div className="chat-subtitle">{activeRoom.isPrivate ? 'Sala privada' : 'Sala pública'}</div>
              </div>
            </header>
            <MessageList messages={messages} currentUserId={user?.id ?? ''} />
            <TypingIndicator users={typingUsers} />
            <MessageInput socket={socket} roomId={activeRoom.id} onSend={sendMessage} />
          </>
        ) : (
          <div className="empty-state">
            <div className="icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h3>Selecione uma sala</h3>
            <p>Escolha uma sala na lista ou crie uma nova para começar a conversar.</p>
          </div>
        )}
        {error && <div className="error-banner" style={{ margin: '0 1.25rem 0.75rem' }}>{error}</div>}
      </main>
    </div>
  );
}
