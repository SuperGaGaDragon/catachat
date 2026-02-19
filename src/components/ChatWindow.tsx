import { useRef, useEffect, useState } from 'react';
import { PaperPlaneIcon, ChatBubbleIcon, SpeakerLoudIcon } from '@radix-ui/react-icons';
import type { Conversation, Message, CurrentUser } from '../types';
import './ChatWindow.css';

interface ChatWindowProps {
  currentUser: CurrentUser | null;
  conversation: Conversation | null;
  messages: Message[];
  loading: boolean;
  onSend: (content: string) => Promise<void>;
  // broadcast mode overrides
  title?: string;          // replaces conversation name in header
  isBroadcast?: boolean;   // shows megaphone icon instead of avatar
  canSend?: boolean;       // false = hide input bar (non-admin in broadcast)
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const letter = name.charAt(0).toUpperCase();
  const hue = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  const bg = `hsl(${hue}, 55%, 55%)`;
  return (
    <div className="cw-avatar" style={{ width: size, height: size, background: bg, fontSize: size * 0.4 }}>
      {letter}
    </div>
  );
}

function BroadcastAvatar({ size = 38 }: { size?: number }) {
  return (
    <div className="cw-avatar cw-avatar--broadcast" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      <SpeakerLoudIcon width={size * 0.45} height={size * 0.45} />
    </div>
  );
}

function formatMsgTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatWindow({
  currentUser,
  conversation,
  messages,
  loading,
  onSend,
  title,
  isBroadcast = false,
  canSend = true,
}: ChatWindowProps) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    const content = draft.trim();
    if (!content || sending) return;
    setDraft('');
    setSending(true);
    try {
      await onSend(content);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setDraft(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  }

  const displayName = title ?? conversation?.other_username
    ?? (conversation ? conversation.other_user_id.slice(0, 8) + '…' : '');

  if (!isBroadcast && !conversation) {
    return (
      <div className="cw-root cw-empty">
        <div className="cw-empty-content">
          <ChatBubbleIcon width={48} height={48} className="cw-empty-icon" />
          <h2>Your messages</h2>
          <p>Select a conversation or start a new one</p>
        </div>
      </div>
    );
  }

  return (
    <div className="cw-root">
      {/* Header */}
      <div className="cw-header">
        {isBroadcast
          ? <BroadcastAvatar size={38} />
          : <Avatar name={displayName} size={38} />
        }
        <div className="cw-header-info">
          <span className="cw-header-name">{displayName}</span>
          {isBroadcast && (
            <span className="cw-header-sub">
              {canSend ? 'Admin · visible to all users' : 'Read-only · posted by admins'}
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="cw-messages">
        {loading ? (
          <div className="cw-loading">
            <div className="msg-skeleton msg-skeleton--them" />
            <div className="msg-skeleton msg-skeleton--me" />
            <div className="msg-skeleton msg-skeleton--them" />
          </div>
        ) : messages.length === 0 ? (
          <div className="cw-no-msgs">
            <p>{isBroadcast ? 'No broadcasts yet.' : 'No messages yet. Say hello!'}</p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isMe = msg.sender_id === currentUser?.id;
            const prev = messages[i - 1];
            const showAvatar = !isMe && (!prev || prev.sender_id !== msg.sender_id);
            return (
              <div key={msg.id} className={`msg-row ${isMe ? 'msg-row--me' : 'msg-row--them'}`}>
                {!isMe && (
                  <div className="msg-avatar-slot">
                    {showAvatar && <Avatar name={msg.sender_name ?? 'User'} size={30} />}
                  </div>
                )}
                <div className="msg-bubble-wrap">
                  {!isMe && showAvatar && (
                    <span className="msg-sender-name">{msg.sender_name ?? 'User'}</span>
                  )}
                  <div className={`msg-bubble ${isMe ? 'msg-bubble--me' : 'msg-bubble--them'}`}>
                    {msg.content}
                  </div>
                  <span className={`msg-time ${isMe ? 'msg-time--me' : ''}`}>
                    {formatMsgTime(msg.created_at)}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input — hidden for non-admin in broadcast mode */}
      {canSend ? (
        <div className="cw-input-bar">
          <textarea
            ref={textareaRef}
            className="cw-textarea"
            rows={1}
            placeholder={isBroadcast ? 'Send a broadcast to all users…' : 'Message…'}
            value={draft}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            disabled={sending}
          />
          <button
            className={`cw-send-btn ${draft.trim() ? 'cw-send-btn--active' : ''}`}
            onClick={handleSend}
            disabled={!draft.trim() || sending}
            title="Send (Enter)"
          >
            <PaperPlaneIcon width={16} height={16} />
          </button>
        </div>
      ) : (
        <div className="cw-readonly-bar">
          <SpeakerLoudIcon width={14} height={14} />
          Only admins can post broadcasts
        </div>
      )}
    </div>
  );
}
