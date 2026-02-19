import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  PlusIcon, MagnifyingGlassIcon, ExitIcon,
  ChatBubbleIcon, SpeakerLoudIcon, PersonIcon,
} from '@radix-ui/react-icons';
import type { Conversation, CurrentUser, UserLookup, Group } from '../types';
import { api } from '../api';
import NewChatDialog from './NewChatDialog';
import CreateGroupDialog from './CreateGroupDialog';
import './Sidebar.css';

interface SidebarProps {
  currentUser: CurrentUser | null;
  conversations?: Conversation[];
  loading?: boolean;
  onUserSearch?: (username: string) => Promise<UserLookup | null>;
  onLogout: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function GroupAvatar({ size = 40 }: { size?: number }) {
  return (
    <div className="avatar avatar--group" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      <PersonIcon width={size * 0.44} height={size * 0.44} />
    </div>
  );
}

// ── Merged sidebar item ───────────────────────────────────────────────────────

type SidebarItem =
  | { kind: 'conv';  conv: Conversation;  sortKey: string }
  | { kind: 'group'; group: Group;        sortKey: string };

// ── Component ─────────────────────────────────────────────────────────────────

export default function Sidebar({
  currentUser,
  conversations = [],
  loading = false,
  onUserSearch,
  onLogout,
}: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // Derive active state from URL so Sidebar never needs props for this
  const pathChatMatch = location.pathname.match(/^\/chat\/(.+)$/);
  const pathGroupMatch = location.pathname.match(/^\/group\/(.+)$/);
  const activePeer    = location.pathname === '/broadcast'
    ? '__broadcast__'
    : pathChatMatch ? decodeURIComponent(pathChatMatch[1]) : null;
  const activeGroupId = pathGroupMatch ? pathGroupMatch[1] : null;
  const [search, setSearch]                   = useState('');
  const [chatDialogOpen, setChatDialogOpen]   = useState(false);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [plusMenuOpen, setPlusMenuOpen]       = useState(false);
  const plusBtnRef                            = useRef<HTMLDivElement>(null);

  // Close + menu when clicking outside
  useEffect(() => {
    if (!plusMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (plusBtnRef.current && !plusBtnRef.current.contains(e.target as Node)) {
        setPlusMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [plusMenuOpen]);

  // Groups: fetched internally by Sidebar so both ChatPage and GroupPage share them
  const [groups, setGroups]           = useState<Group[]>([]);
  const groupsIntervalRef             = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    const fetchGroups = () =>
      api.get<Group[]>('/api/catchat/groups')
        .then(setGroups)
        .catch(() => {});
    fetchGroups();
    groupsIntervalRef.current = setInterval(fetchGroups, 8000);
    return () => {
      if (groupsIntervalRef.current) clearInterval(groupsIntervalRef.current);
    };
  }, [currentUser]);

  // ── Default user-search if parent didn't provide one ──────────────────────
  async function defaultUserSearch(username: string): Promise<UserLookup | null> {
    try { return await api.get<UserLookup>(`/user/by-username/${encodeURIComponent(username)}`); }
    catch { return null; }
  }
  const handleUserSearch = onUserSearch ?? defaultUserSearch;

  // ── Navigation ────────────────────────────────────────────────────────────
  function handleSelectConv(conv: Conversation) {
    const username = conv.other_username;
    if (username) navigate(`/chat/${encodeURIComponent(username)}`);
  }

  function handleSelectGroup(group: Group) {
    navigate(`/group/${group.id}`);
  }

  function handleStartChat(username: string) {
    setChatDialogOpen(false);
    navigate(`/chat/${encodeURIComponent(username)}`);
  }

  async function handleCreateGroup(name: string | null, members: UserLookup[]) {
    const newGroup = await api.post<Group>('/api/catchat/groups', {
      name,
      members: members.map(m => ({ user_id: m.id, username: m.username })),
    });
    setGroups(prev => [newGroup, ...prev]);
    navigate(`/group/${newGroup.id}`);
  }

  // ── Build merged + filtered list ──────────────────────────────────────────
  const q = search.toLowerCase().trim();

  const items: SidebarItem[] = [
    ...conversations
      .filter(c => !q || (c.other_username ?? c.other_user_id).toLowerCase().includes(q))
      .map(c => ({
        kind: 'conv' as const,
        conv: c,
        sortKey: c.last_message_at ?? c.created_at,
      })),
    ...groups
      .filter(g => !q || g.name.toLowerCase().includes(q))
      .map(g => ({
        kind: 'group' as const,
        group: g,
        sortKey: g.last_message_at,
      })),
  ].sort((a, b) => b.sortKey.localeCompare(a.sortKey));

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
        <div className="sidebar-plus-wrap" ref={plusBtnRef}>
          <button
            className="icon-btn"
            title="New chat"
            onClick={() => setPlusMenuOpen(o => !o)}
          >
            <PlusIcon width={18} height={18} />
          </button>
          {plusMenuOpen && (
            <div className="plus-menu">
              <button className="plus-menu-item" onClick={() => { setPlusMenuOpen(false); setChatDialogOpen(true); }}>
                <ChatBubbleIcon width={14} height={14} />
                私信
              </button>
              <button className="plus-menu-item" onClick={() => { setPlusMenuOpen(false); setGroupDialogOpen(true); }}>
                <PersonIcon width={14} height={14} />
                群聊
              </button>
            </div>
          )}
        </div>
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

      {/* Pinned: Broadcast */}
      <button
        className={`conv-item conv-item--broadcast ${activePeer === '__broadcast__' ? 'conv-item--active' : ''}`}
        onClick={() => navigate('/broadcast')}
      >
        <div className="avatar avatar--broadcast" style={{ width: 42, height: 42 }}>
          <SpeakerLoudIcon width={18} height={18} />
        </div>
        <div className="conv-info">
          <span className="conv-name">Broadcast</span>
          <span className="conv-time conv-time--pinned">Pinned</span>
        </div>
      </button>

      {/* Merged conversation + group list */}
      <div className="sidebar-list">
        {loading ? (
          <div className="sidebar-empty">
            <div className="list-skeleton" />
            <div className="list-skeleton" />
            <div className="list-skeleton" />
          </div>
        ) : items.length === 0 ? (
          <div className="sidebar-empty">
            <p>{search ? 'No results' : 'No conversations yet'}</p>
            {!search && (
              <button className="new-chat-hint" onClick={() => setChatDialogOpen(true)}>
                Start a conversation
              </button>
            )}
          </div>
        ) : (
          items.map(item => {
            if (item.kind === 'conv') {
              const { conv } = item;
              const name = conv.other_username ?? conv.other_user_id.slice(0, 8) + '…';
              const isActive = !!activePeer && conv.other_username === activePeer;
              return (
                <button
                  key={`conv-${conv.id}`}
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
            }

            // group item
            const { group } = item;
            const isActive = group.id === activeGroupId;
            return (
              <button
                key={`group-${group.id}`}
                className={`conv-item ${isActive ? 'conv-item--active' : ''}`}
                onClick={() => handleSelectGroup(group)}
              >
                <GroupAvatar size={42} />
                <div className="conv-info">
                  <div className="conv-name-row">
                    <span className="conv-name">{group.name}</span>
                    <span className="conv-badge-group">Group</span>
                  </div>
                  <span className="conv-time">{formatTime(group.last_message_at)}</span>
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

      {/* Dialogs */}
      <NewChatDialog
        open={chatDialogOpen}
        onClose={() => setChatDialogOpen(false)}
        onUserSearch={handleUserSearch}
        onStart={handleStartChat}
      />
      <CreateGroupDialog
        open={groupDialogOpen}
        onClose={() => setGroupDialogOpen(false)}
        onUserSearch={handleUserSearch}
        onCreate={handleCreateGroup}
      />
    </aside>
  );
}
