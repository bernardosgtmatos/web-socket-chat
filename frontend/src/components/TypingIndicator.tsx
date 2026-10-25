interface TypingIndicatorProps {
  users: string[];
}

export default function TypingIndicator({ users }: TypingIndicatorProps) {
  if (users.length === 0) return null;
  const label = users.length === 1 ? `${users[0]} está digitando` : `${users.join(', ')} estão digitando`;
  return (
    <div className="typing">
      <div className="typing-dots">
        <span />
        <span />
        <span />
      </div>
      <span>{label}...</span>
    </div>
  );
}
