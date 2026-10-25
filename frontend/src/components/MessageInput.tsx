import { useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';

interface MessageInputProps {
  socket: Socket | null;
  roomId: string;
  onSend: (text: string) => void;
}

export default function MessageInput({ socket, roomId, onSend }: MessageInputProps) {
  const [text, setText] = useState('');
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const emitTyping = (isTyping: boolean) => {
    socket?.emit('typing', { roomId, isTyping });
  };

  const handleChange = (value: string) => {
    setText(value);
    emitTyping(true);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => emitTyping(false), 1000);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text.trim());
    setText('');
    emitTyping(false);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
  };

  return (
    <form className="input-bar" onSubmit={submit}>
      <input
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Digite uma mensagem..."
        aria-label="Mensagem"
      />
      <button type="submit" className="send-btn" disabled={!text.trim()} aria-label="Enviar mensagem">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    </form>
  );
}
