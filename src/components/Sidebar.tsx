import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  PlusIcon, MagnifyingGlassIcon, ExitIcon,
  ChatBubbleIcon, SpeakerLoudIcon, PersonIcon,
  ChevronDownIcon, ChevronRightIcon, ReaderIcon,
} from '@radix-ui/react-icons';
import type { Conversation, CurrentUser, UserLookup, Group, Broadcast } from '../types';
import { api } from '../api';
import {
  UNREAD_UPDATED_EVENT,
  hasBroadcastUnread,
  hasConversationUnread,
  hasGroupUnread,
} from '../unread';
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

type GroupKind = 'user' | 'class_group' | 'classroom';

function groupKind(group: Group): GroupKind {
  const src = group.meta?.source;
  if (src === 'class_group') return 'class_group';
  if (src === 'classroom') return 'classroom';
  return 'user';
}

const GROUP_AVATAR_CLASS: Record<GroupKind, string> = {
  user:        'avatar--group',          // purple — user-created
  class_group: 'avatar--group-class',    // teal   — 班级大群
  classroom:   'avatar--group-contact',  // rose   — 师生小群
};

function GroupAvatar({ size = 40, kind = 'user' as GroupKind }: { size?: number; kind?: GroupKind }) {
  return (
    <div className={`avatar ${GROUP_AVATAR_CLASS[kind]}`} style={{ width: size, height: size, fontSize: size * 0.4 }}>
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
  const [, setUnreadTick]                     = useState(0);
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
  const broadcastIntervalRef          = useRef<ReturnType<typeof setInterval> | null>(null);
  const [latestBroadcastAt, setLatestBroadcastAt] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    const fetchGroups = () =>
      api.get<Group[]>('/api/catchat/groups')
        .then(setGroups)
        .catch(() => {});
    fetchGroups();
    groupsIntervalRef.current = setInterval(fetchGroups, 3000);
    return () => {
      if (groupsIntervalRef.current) clearInterval(groupsIntervalRef.current);
    };
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const fetchLatestBroadcast = () =>
      api.get<Broadcast[]>('/api/catchat/broadcasts?limit=1')
        .then(rows => setLatestBroadcastAt(rows[0]?.created_at ?? null))
        .catch(() => {});
    fetchLatestBroadcast();
    broadcastIntervalRef.current = setInterval(fetchLatestBroadcast, 3000);
    return () => {
      if (broadcastIntervalRef.current) clearInterval(broadcastIntervalRef.current);
    };
  }, [currentUser]);

  // Re-render immediately when read-state changes (same-tab + cross-tab).
  useEffect(() => {
    const bump = () => setUnreadTick(v => v + 1);
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === 'catachat_seen_channels_v1') bump();
    };
    window.addEventListener(UNREAD_UPDATED_EVENT, bump);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(UNREAD_UPDATED_EVENT, bump);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

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

  // ── Classroom folder state ────────────────────────────────────────────────
  const [classroomOpen, setClassroomOpen] = useState(true);

  // ── Build merged + filtered list ──────────────────────────────────────────
  const q = search.toLowerCase().trim();

  // Separate groups by source type
  const classroomGroups = groups
    .filter(g => g.meta?.source === 'classroom' || g.meta?.source === 'class_group')
    .filter(g => !q || g.name.toLowerCase().includes(q))
    .sort((a, b) => b.last_message_at.localeCompare(a.last_message_at));

  const regularGroups = groups
    .filter(g => !g.meta?.source || (g.meta.source !== 'classroom' && g.meta.source !== 'class_group'));

  const items: SidebarItem[] = [
    ...conversations
      .filter(c => !q || (c.other_username ?? c.other_user_id).toLowerCase().includes(q))
      .map(c => ({
        kind: 'conv' as const,
        conv: c,
        sortKey: c.last_message_at ?? c.created_at,
      })),
    ...regularGroups
      .filter(g => !q || g.name.toLowerCase().includes(q))
      .map(g => ({
        kind: 'group' as const,
        group: g,
        sortKey: g.last_message_at,
      })),
  ].sort((a, b) => b.sortKey.localeCompare(a.sortKey));

  const hasClassroomUnread = classroomGroups.some(
    g => g.id !== activeGroupId && hasGroupUnread(g.id, g.last_message_at),
  );
  const showBroadcastUnread = activePeer !== '__broadcast__' && hasBroadcastUnread(latestBroadcastAt);

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
          <div className="conv-meta">
            <span className="conv-time conv-time--pinned">Pinned</span>
            {showBroadcastUnread && <span className="conv-unread-dot" aria-label="Unread broadcast" />}
          </div>
        </div>
      </button>

      {/* Conversation + group list */}
      <div className="sidebar-list">
        {loading ? (
          <div className="sidebar-empty">
            <div className="list-skeleton" />
            <div className="list-skeleton" />
            <div className="list-skeleton" />
          </div>
        ) : (
          <>
            {/* ── Classroom folder ──────────────────────────────────── */}
            {classroomGroups.length > 0 && (
              <div className="sidebar-folder">
                <button
                  className="sidebar-folder-header"
                  onClick={() => setClassroomOpen(v => !v)}
                >
                  {classroomOpen
                    ? <ChevronDownIcon width={14} height={14} />
                    : <ChevronRightIcon width={14} height={14} />}
                  <ReaderIcon width={14} height={14} className="sidebar-folder-icon" />
                  <span className="sidebar-folder-label">Classroom</span>
                  <span className="sidebar-folder-count">{classroomGroups.length}</span>
                  {!classroomOpen && hasClassroomUnread && (
                    <span className="conv-unread-dot" />
                  )}
                </button>

                {classroomOpen && classroomGroups.map(group => {
                  const isActive = group.id === activeGroupId;
                  const isUnread = !isActive && hasGroupUnread(group.id, group.last_message_at);
                  const kind = groupKind(group);
                  return (
                    <button
                      key={`group-${group.id}`}
                      className={`conv-item conv-item--nested ${isActive ? 'conv-item--active' : ''}`}
                      onClick={() => handleSelectGroup(group)}
                    >
                      <GroupAvatar size={36} kind={kind} />
                      <div className="conv-info">
                        <div className="conv-name-row">
                          <span className="conv-name">{group.name}</span>
                          <span className={`conv-badge-group ${kind === 'class_group' ? 'conv-badge--class' : kind === 'classroom' ? 'conv-badge--contact' : ''}`}>
                            {kind === 'class_group' ? 'Class' : 'Contact'}
                          </span>
                        </div>
                        <div className="conv-meta">
                          <span className="conv-time">{formatTime(group.last_message_at)}</span>
                          {isUnread && <span className="conv-unread-dot" aria-label={`Unread messages in ${group.name}`} />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── Regular conversations + groups ───────────────────── */}
            {items.length === 0 && classroomGroups.length === 0 ? (
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
                  const isUnread = !isActive && hasConversationUnread(conv.id, conv.last_message_at);
                  return (
                    <button
                      key={`conv-${conv.id}`}
                      className={`conv-item ${isActive ? 'conv-item--active' : ''}`}
                      onClick={() => handleSelectConv(conv)}
                    >
                      <Avatar name={name} size={42} />
                      <div className="conv-info">
                        <span className="conv-name">{name}</span>
                        <div className="conv-meta">
                          <span className="conv-time">{formatTime(conv.last_message_at)}</span>
                          {isUnread && <span className="conv-unread-dot" aria-label={`Unread messages from ${name}`} />}
                        </div>
                      </div>
                    </button>
                  );
                }

                // group item
                const { group } = item;
                const isActive = group.id === activeGroupId;
                const isUnread = !isActive && hasGroupUnread(group.id, group.last_message_at);
                return (
                  <button
                    key={`group-${group.id}`}
                    className={`conv-item ${isActive ? 'conv-item--active' : ''}`}
                    onClick={() => handleSelectGroup(group)}
                  >
                    <GroupAvatar size={42} kind={groupKind(group)} />
                    <div className="conv-info">
                      <div className="conv-name-row">
                        <span className="conv-name">{group.name}</span>
                        <span className="conv-badge-group">Group</span>
                      </div>
                      <div className="conv-meta">
                        <span className="conv-time">{formatTime(group.last_message_at)}</span>
                        {isUnread && <span className="conv-unread-dot" aria-label={`Unread messages in ${group.name}`} />}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </>
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
