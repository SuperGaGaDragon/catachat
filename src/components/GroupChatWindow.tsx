import { useRef, useEffect, useState } from 'react';
import { PaperPlaneIcon, PersonIcon, GearIcon } from '@radix-ui/react-icons';
import type { Group, GroupMessage, CurrentUser } from '../types';
import './GroupChatWindow.css';

interface GroupChatWindowProps {
  currentUser: CurrentUser | null;
  group: Group | null;
  messages: GroupMessage[];
  loading: boolean;
  onSend: (content: string) => Promise<void>;
  onOpenSettings?: () => void;
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const letter = name.charAt(0).toUpperCase();
  const hue = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  const bg = `hsl(${hue}, 55%, 55%)`;
  return (
    <div className="gcw-avatar" style={{ width: size, height: size, background: bg, fontSize: size * 0.4 }}>
      {letter}
    </div>
  );
}

function formatMsgTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function GroupChatWindow({
  currentUser,
  group,
  messages,
  loading,
  onSend,
  onOpenSettings,
}: GroupChatWindowProps) {
  const [draft, setDraft]     = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef             = useRef<HTMLDivElement>(null);
  const textareaRef           = useRef<HTMLTextAreaElement>(null);

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
      setTimeout(() => textareaRef.current?.focus(), 0);
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

  const memberCount = group?.members.length ?? 0;
  const myRole = group?.members.find(m => m.user_id === currentUser?.id)?.role ?? 'member';

  return (
    <div className="gcw-root">
      {/* Header */}
      <div className="gcw-header">
        <div className="gcw-header-left">
          <div className="gcw-header-icon">
            <PersonIcon width={18} height={18} />
          </div>
          <div className="gcw-header-info">
            <span className="gcw-header-name">{group?.name ?? '…'}</span>
            <span className="gcw-header-sub">
              {memberCount} member{memberCount !== 1 ? 's' : ''}
              {myRole !== 'member' && ` · ${myRole}`}
            </span>
          </div>
        </div>
        <button
          className="gcw-icon-btn"
          onClick={onOpenSettings}
          title="Group settings"
        >
          <GearIcon width={16} height={16} />
        </button>
      </div>

      {/* Messages */}
      <div className="gcw-messages">
        {loading ? (
          <div className="gcw-loading">
            <div className="gmsg-skeleton gmsg-skeleton--them" />
            <div className="gmsg-skeleton gmsg-skeleton--me" />
            <div className="gmsg-skeleton gmsg-skeleton--them" />
          </div>
        ) : messages.length === 0 ? (
          <div className="gcw-no-msgs">
            <p>No messages yet. Say something!</p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isMe = msg.sender_id === currentUser?.id;
            const prev = messages[i - 1];
            // Show avatar + name only at the start of a consecutive run from the same sender
            const showHeader = !prev || prev.sender_id !== msg.sender_id;
            return (
              <div key={msg.id} className={`gmsg-row ${isMe ? 'gmsg-row--me' : 'gmsg-row--them'}`}>
                {/* Avatar slot (always reserve space on the left for other senders) */}
                {!isMe && (
                  <div className="gmsg-avatar-slot">
                    {showHeader && <Avatar name={msg.sender_name} size={30} />}
                  </div>
                )}
                <div className="gmsg-bubble-wrap">
                  {/* Sender name above first bubble in a run */}
                  {!isMe && showHeader && (
                    <span className="gmsg-sender-name">{msg.sender_name}</span>
                  )}
                  <div className={`gmsg-bubble ${isMe ? 'gmsg-bubble--me' : 'gmsg-bubble--them'}`}>
                    {msg.content}
                  </div>
                  <span className="gmsg-time">{formatMsgTime(msg.created_at)}</span>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="gcw-input-bar">
        <textarea
          ref={textareaRef}
          className="gcw-textarea"
          rows={1}
          placeholder="Message group…"
          value={draft}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          disabled={sending}
        />
        <button
          className={`gcw-send-btn ${draft.trim() ? 'gcw-send-btn--active' : ''}`}
          onClick={handleSend}
          disabled={!draft.trim() || sending}
          title="Send (Enter)"
        >
          <PaperPlaneIcon width={16} height={16} />
        </button>
      </div>
    </div>
  );
}
