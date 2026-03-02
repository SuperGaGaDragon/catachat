import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation, useOutletContext } from 'react-router-dom';
import { api } from '../api';
import type { Conversation, Message, UserLookup, Broadcast } from '../types';
import ChatWindow from '../components/ChatWindow';
import type { ChatLayoutContext } from './ChatLayout';
import { markBroadcastSeen, markConversationSeen } from '../unread';
import './ChatPage.css';

const POLL_INTERVAL_MS = 3000;

function broadcastToMessage(b: Broadcast): Message {
  return {
    id: b.id,
    conversation_id: 'broadcast',
    sender_id: b.sender_id,
    sender_name: b.sender_name,
    content: b.content,
    created_at: b.created_at,
  };
}

export default function ChatPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { peer }  = useParams<{ peer: string }>();
  const isBroadcast = location.pathname === '/broadcast';

  const { currentUser, conversations, setConversations } =
    useOutletContext<ChatLayoutContext>();

  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages]         = useState<Message[]>([]);
  const [loadingMsgs, setLoadingMsgs]   = useState(false);

  const activeConvIdRef = useRef<string | null>(null);
  const isBroadcastRef  = useRef(false);
  const messagesRef     = useRef<Message[]>([]);
  activeConvIdRef.current = activeConvId;
  isBroadcastRef.current  = isBroadcast;
  messagesRef.current     = messages;

  function touchConversation(convId: string, latestAt: string) {
    setConversations(prev => {
      const updated = prev.map(c =>
        c.id === convId ? { ...c, last_message_at: latestAt } : c
      );
      return updated.sort((a, b) =>
        (b.last_message_at ?? b.created_at).localeCompare(a.last_message_at ?? a.created_at)
      );
    });
  }

  // ── Broadcast mode: load + poll ────────────────────────────────────────────
  useEffect(() => {
    if (!isBroadcast) return;
    setActiveConvId(null);
    setLoadingMsgs(true);
    api.get<Broadcast[]>('/api/catchat/broadcasts?limit=50')
      .then(bs => setMessages(bs.map(broadcastToMessage).reverse()))
      .catch(() => setMessages([]))
      .finally(() => setLoadingMsgs(false));
  }, [isBroadcast]);

  // ── Peer mode: resolve username → conversation ────────────────────────────
  useEffect(() => {
    if (isBroadcast || !peer) {
      if (!isBroadcast) { setActiveConvId(null); setMessages([]); }
      return;
    }
    let cancelled = false;
    setLoadingMsgs(true);
    async function open() {
      const u = await api.get<UserLookup>(`/user/by-username/${encodeURIComponent(peer!)}`);
      const conv = await api.post<Conversation>('/api/catchat/conversations', { user_id: u.id });
      if (cancelled) return;
      setConversations(prev => {
        const enriched: Conversation = { ...conv, other_username: peer };
        const idx = prev.findIndex(c => c.id === enriched.id);
        if (idx === -1) return [enriched, ...prev];
        const updated = [...prev];
        updated[idx] = { ...prev[idx], other_username: peer };
        return updated;
      });
      setActiveConvId(conv.id);
    }
    open().catch(() => navigate('/', { replace: true }));
    return () => { cancelled = true; };
  }, [peer, isBroadcast, navigate, setConversations]);

  // ── Messages load when active conv changes ────────────────────────────────
  useEffect(() => {
    if (isBroadcast || !activeConvId) return;
    api.get<Message[]>(`/api/catchat/conversations/${activeConvId}/messages?limit=50`)
      .then(msgs => {
        const ordered = [...msgs].reverse();
        setMessages(ordered);
        const latestAt = ordered[ordered.length - 1]?.created_at;
        markConversationSeen(activeConvId, latestAt ?? new Date().toISOString());
      })
      .catch(() => setMessages([]))
      .finally(() => setLoadingMsgs(false));
  }, [activeConvId, isBroadcast]);

  // ── Silent polling (messages + broadcasts) ────────────────────────────────
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        if (isBroadcastRef.current) {
          const latest = await api.get<Broadcast[]>('/api/catchat/broadcasts?limit=50');
          const reversed = latest.map(broadcastToMessage).reverse();
          const existingIds = new Set(messagesRef.current.map(m => m.id));
          const incoming = reversed.filter(m => !existingIds.has(m.id));
          if (incoming.length > 0) setMessages(prev => [...prev, ...incoming]);
        } else {
          const convId = activeConvIdRef.current;
          if (!convId) return;
          const latest = await api.get<Message[]>(
            `/api/catchat/conversations/${convId}/messages?limit=50`
          );
          const reversed = [...latest].reverse();
          const existingIds = new Set(messagesRef.current.map(m => m.id));
          const incoming = reversed.filter(m => !existingIds.has(m.id));
          if (incoming.length > 0) {
            setMessages(prev => [...prev, ...incoming]);
            touchConversation(convId, incoming[incoming.length - 1].created_at);
          }
        }
      } catch { /* silent */ }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    async function refreshNow() {
      try {
        if (isBroadcastRef.current) {
          const latest = await api.get<Broadcast[]>('/api/catchat/broadcasts?limit=50');
          const reversed = latest.map(broadcastToMessage).reverse();
          const existingIds = new Set(messagesRef.current.map(m => m.id));
          const incoming = reversed.filter(m => !existingIds.has(m.id));
          if (incoming.length > 0) setMessages(prev => [...prev, ...incoming]);
          return;
        }

        const convId = activeConvIdRef.current;
        if (!convId) return;
        const latest = await api.get<Message[]>(
          `/api/catchat/conversations/${convId}/messages?limit=50`
        );
        const reversed = [...latest].reverse();
        const existingIds = new Set(messagesRef.current.map(m => m.id));
        const incoming = reversed.filter(m => !existingIds.has(m.id));
        if (incoming.length > 0) {
          setMessages(prev => [...prev, ...incoming]);
          touchConversation(convId, incoming[incoming.length - 1].created_at);
        }
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
    if (isBroadcast) {
      const latestAt = messages[messages.length - 1]?.created_at;
      markBroadcastSeen(latestAt ?? new Date().toISOString());
      return;
    }
    if (!activeConvId) return;
    const latestAt = messages[messages.length - 1]?.created_at;
    markConversationSeen(activeConvId, latestAt ?? new Date().toISOString());
  }, [isBroadcast, activeConvId, messages]);

  // ── Send ──────────────────────────────────────────────────────────────────
  async function handleSend(content: string) {
    if (!content.trim()) return;
    if (isBroadcast) {
      const b = await api.post<Broadcast>('/api/catchat/broadcasts', { content: content.trim() });
      const msg = broadcastToMessage(b);
      setMessages(prev => [...prev, msg]);
      markBroadcastSeen(msg.created_at);
      return;
    }
    if (!activeConvId) return;
    const msg = await api.post<Message>(
      `/api/catchat/conversations/${activeConvId}/messages`,
      { content: content.trim() }
    );
    setMessages(prev => [...prev, msg]);
    touchConversation(activeConvId, msg.created_at);
    markConversationSeen(activeConvId, msg.created_at);
  }

  const isAdmin    = currentUser?.role === 'admin';
  const activeConv = conversations.find(c => c.id === activeConvId) ?? null;

  return (
    <ChatWindow
      currentUser={currentUser}
      conversation={isBroadcast ? null : activeConv}
      messages={messages}
      loading={loadingMsgs}
      onSend={handleSend}
      title={isBroadcast ? 'Broadcast' : undefined}
      isBroadcast={isBroadcast}
      canSend={isBroadcast ? isAdmin : true}
    />
  );
}
