import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useOutletContext } from 'react-router-dom';
import { api } from '../api';
import type { Group, GroupMessage } from '../types';
import GroupChatWindow from '../components/GroupChatWindow';
import GroupSettingsPanel from '../components/GroupSettingsPanel';
import type { ChatLayoutContext } from './ChatLayout';
import '../components/GroupSettingsPanel.css';

const POLL_INTERVAL_MS = 3000;

export default function GroupPage() {
  const navigate = useNavigate();
  const { groupId } = useParams<{ groupId: string }>();

  const { currentUser } = useOutletContext<ChatLayoutContext>();

  const [group, setGroup]             = useState<Group | null>(null);
  const [messages, setMessages]       = useState<GroupMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [panelOpen, setPanelOpen]     = useState(false);

  const groupIdRef  = useRef<string | null>(null);
  const messagesRef = useRef<GroupMessage[]>([]);
  groupIdRef.current  = groupId ?? null;
  messagesRef.current = messages;

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

  return (
    <div className="group-page-layout">
      <GroupChatWindow
        currentUser={currentUser}
        group={group}
        messages={messages}
        loading={loadingMsgs}
        onSend={handleSend}
        onOpenSettings={() => setPanelOpen(true)}
      />
      {panelOpen && group && (
        <GroupSettingsPanel
          group={group}
          currentUser={currentUser}
          onClose={() => setPanelOpen(false)}
          onGroupUpdated={setGroup}
          onLeft={() => navigate('/', { replace: true })}
        />
      )}
    </div>
  );
}
