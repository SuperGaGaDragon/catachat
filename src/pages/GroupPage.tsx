import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, clearToken } from '../api';
import type { Group, GroupMessage, CurrentUser, Conversation } from '../types';
import Sidebar from '../components/Sidebar';
import GroupChatWindow from '../components/GroupChatWindow';

const POLL_INTERVAL_MS = 3000;

export default function GroupPage() {
  const navigate = useNavigate();
  const { groupId } = useParams<{ groupId: string }>();

  const [currentUser, setCurrentUser]     = useState<CurrentUser | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [group, setGroup]                 = useState<Group | null>(null);
  const [messages, setMessages]           = useState<GroupMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs]     = useState(true);

  // Refs for polling (avoids stale closure)
  const groupIdRef  = useRef<string | null>(null);
  const messagesRef = useRef<GroupMessage[]>([]);
  groupIdRef.current  = groupId ?? null;
  messagesRef.current = messages;

  // ── Auth ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    api.get<CurrentUser>('/user/profile')
      .then(setCurrentUser)
      .catch(() => { clearToken(); navigate('/login', { replace: true }); });
  }, [navigate]);

  // ── Conversations (for sidebar) ────────────────────────────────────────────
  useEffect(() => {
    const fetch = () =>
      api.get<Conversation[]>('/api/catchat/conversations')
        .then(setConversations).catch(() => {});
    fetch();
    const id = setInterval(fetch, 8000);
    return () => clearInterval(id);
  }, []);

  // ── Load group info ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!groupId) return;
    api.get<Group>(`/api/catchat/groups/${groupId}`)
      .then(setGroup)
      .catch(() => navigate('/', { replace: true }));
  }, [groupId, navigate]);

  // ── Load messages ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!groupId) return;
    setLoadingMsgs(true);
    api.get<GroupMessage[]>(`/api/catchat/groups/${groupId}/messages?limit=50`)
      .then(msgs => setMessages([...msgs].reverse()))
      .catch(() => setMessages([]))
      .finally(() => setLoadingMsgs(false));
  }, [groupId]);

  // ── Silent polling ─────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(async () => {
      const gid = groupIdRef.current;
      if (!gid) return;
      try {
        const latest = await api.get<GroupMessage[]>(
          `/api/catchat/groups/${gid}/messages?limit=50`
        );
        const reversed = [...latest].reverse();
        const existingIds = new Set(messagesRef.current.map(m => m.id));
        const incoming = reversed.filter(m => !existingIds.has(m.id));
        if (incoming.length > 0) setMessages(prev => [...prev, ...incoming]);
      } catch { /* silent */ }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // ── Send ───────────────────────────────────────────────────────────────────
  async function handleSend(content: string) {
    if (!content.trim() || !groupId) return;
    const msg = await api.post<GroupMessage>(
      `/api/catchat/groups/${groupId}/messages`,
      { content: content.trim() }
    );
    setMessages(prev => [...prev, msg]);
  }

  function handleLogout() { clearToken(); navigate('/login', { replace: true }); }

  return (
    <div className="chat-root">
      <Sidebar
        currentUser={currentUser}
        conversations={conversations}
        activePeer={null}
        activeGroupId={groupId ?? null}
        onLogout={handleLogout}
      />
      <GroupChatWindow
        currentUser={currentUser}
        group={group}
        messages={messages}
        loading={loadingMsgs}
        onSend={handleSend}
      />
    </div>
  );
}
