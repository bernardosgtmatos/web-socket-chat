import { useEffect, useRef } from 'react';
import type { Message } from '../types';

interface MessageListProps {
  messages: Message[];
  currentUserId: string;
}

function initials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase() || '?';
}

export default function MessageList({ messages, currentUserId }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="messages" ref={containerRef}>
        <div className="empty-state">
          <div className="icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h3>Nenhuma mensagem ainda</h3>
          <p>Seja o primeiro a enviar uma mensagem nesta sala.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="messages" ref={containerRef}>
      {messages.map((m) => {
        const own = m.user.id === currentUserId;
        return (
          <div key={m.id} className={`msg ${own ? 'own' : ''}`}>
            <div className="msg-avatar">{initials(m.user.username)}</div>
            <div className="msg-bubble">
              <div className="msg-meta">
                <span className="msg-user">{m.user.username}</span>
                <span className="msg-time">
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="msg-text">{m.text}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
