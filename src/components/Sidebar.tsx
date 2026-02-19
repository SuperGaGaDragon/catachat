import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, MagnifyingGlassIcon, ExitIcon, ChatBubbleIcon } from '@radix-ui/react-icons';
import type { Conversation, CurrentUser, UserLookup } from '../types';
import NewChatDialog from './NewChatDialog';
import './Sidebar.css';

interface SidebarProps {
  currentUser: CurrentUser | null;
  conversations: Conversation[];
  activePeer: string | null;       // username from URL (:peer param)
  loading: boolean;
  onUserSearch: (username: string) => Promise<UserLookup | null>;
  onLogout: () => void;
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const letter = name.charAt(0).toUpperCase();
  const hue = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  const bg = `hsl(${hue}, 55%, 55%)`;
  return (
    <div className="avatar" style={{ width: size, height: size, background: bg, fontSize: size * 0.4 }}>
      {letter}
    </div>
  );
}

export default function Sidebar({
  currentUser,
  conversations,
  activePeer,
  loading,
  onUserSearch,
  onLogout,
}: SidebarProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = search.trim()
    ? conversations.filter(c =>
        (c.other_username ?? c.other_user_id).toLowerCase().includes(search.toLowerCase())
      )
    : conversations;

  function handleSelectConv(conv: Conversation) {
    const username = conv.other_username;
    if (username) navigate(`/chat/${encodeURIComponent(username)}`);
  }

  function handleStartChat(username: string) {
    setDialogOpen(false);
    navigate(`/chat/${encodeURIComponent(username)}`);
  }

  return (
    <aside className="sidebar">
      {/* Brand header */}
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <ChatBubbleIcon width={18} height={18} />
          <span className="sidebar-brand-text">
            <span className="brand-cata">cata</span>
            <span className="brand-chat">chat</span>
          </span>
        </div>
        <button className="icon-btn" title="New conversation" onClick={() => setDialogOpen(true)}>
          <PlusIcon width={18} height={18} />
        </button>
      </div>

      {/* Search */}
      <div className="sidebar-search">
        <MagnifyingGlassIcon className="search-icon" width={15} height={15} />
        <input
          placeholder="Search conversations…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Conversation list */}
      <div className="sidebar-list">
        {loading ? (
          <div className="sidebar-empty">
            <div className="list-skeleton" />
            <div className="list-skeleton" />
            <div className="list-skeleton" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="sidebar-empty">
            <p>{search ? 'No results' : 'No conversations yet'}</p>
            {!search && (
              <button className="new-chat-hint" onClick={() => setDialogOpen(true)}>
                Start a conversation
              </button>
            )}
          </div>
        ) : (
          filtered.map(conv => {
            const name = conv.other_username ?? conv.other_user_id.slice(0, 8) + '…';
            const isActive = !!activePeer && conv.other_username === activePeer;
            return (
              <button
                key={conv.id}
                className={`conv-item ${isActive ? 'conv-item--active' : ''}`}
                onClick={() => handleSelectConv(conv)}
              >
                <Avatar name={name} size={42} />
                <div className="conv-info">
                  <span className="conv-name">{name}</span>
                  <span className="conv-time">{formatTime(conv.last_message_at)}</span>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* User footer */}
      <div className="sidebar-footer">
        {currentUser && (
          <>
            <Avatar name={currentUser.username ?? currentUser.identifier} size={34} />
            <span className="footer-username">{currentUser.username ?? currentUser.identifier}</span>
          </>
        )}
        <button className="icon-btn icon-btn--danger" title="Sign out" onClick={onLogout}>
          <ExitIcon width={16} height={16} />
        </button>
      </div>

      <NewChatDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onUserSearch={onUserSearch}
        onStart={handleStartChat}
      />
    </aside>
  );
}
