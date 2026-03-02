import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useOutletContext } from 'react-router-dom';
import { api } from '../api';
import type { Group, GroupMessage } from '../types';
import GroupChatWindow from '../components/GroupChatWindow';
import GroupSettingsPanel from '../components/GroupSettingsPanel';
import type { ChatLayoutContext } from './ChatLayout';
import { markGroupSeen } from '../unread';
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
      .then(g => {
        setGroup(g);
        markGroupSeen(groupId, g.last_message_at ?? new Date().toISOString());
      })
      .catch(() => navigate('/', { replace: true }));
  }, [groupId, navigate]);

  // ── Load messages ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!groupId) return;
    setLoadingMsgs(true);
    api.get<GroupMessage[]>(`/api/catchat/groups/${groupId}/messages?limit=50`)
      .then(msgs => {
        const ordered = [...msgs].reverse();
        setMessages(ordered);
        const latestAt = ordered[ordered.length - 1]?.created_at;
        markGroupSeen(groupId, latestAt ?? new Date().toISOString());
      })
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

  useEffect(() => {
    async function refreshNow() {
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
      } catch {
        // silent
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void refreshNow();
      }
    }
    function onFocusOrOnline() {
      void refreshNow();
    }

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocusOrOnline);
    window.addEventListener('online', onFocusOrOnline);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocusOrOnline);
      window.removeEventListener('online', onFocusOrOnline);
    };
  }, []);

  useEffect(() => {
    if (!groupId) return;
    const latestAt = messages[messages.length - 1]?.created_at;
    markGroupSeen(groupId, latestAt ?? new Date().toISOString());
  }, [groupId, messages]);

  // ── Send ───────────────────────────────────────────────────────────────────
  async function handleSend(content: string) {
    if (!content.trim() || !groupId) return;
    const msg = await api.post<GroupMessage>(
      `/api/catchat/groups/${groupId}/messages`,
      { content: content.trim() }
    );
    setMessages(prev => [...prev, msg]);
    markGroupSeen(groupId, msg.created_at);
    setGroup(prev => (prev ? { ...prev, last_message_at: msg.created_at } : prev));
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
