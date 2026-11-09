/** TypingIndicator - three bouncing dots while the AI is preparing its reply. */

export function TypingIndicator() {
  return (
    <div className="ai-chat-message-row" data-role="assistant">
      <div className="ai-chat-typing" role="status" aria-label="AI 正在输入">
        <span className="ai-chat-typing-dot" />
        <span className="ai-chat-typing-dot" />
        <span className="ai-chat-typing-dot" />
      </div>
    </div>
  );
}
