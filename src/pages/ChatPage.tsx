import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { api, clearToken } from '../api';
import type { Conversation, Message, CurrentUser, UserLookup, Broadcast } from '../types';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import './ChatPage.css';

const POLL_INTERVAL_MS = 3000;
const CONV_REFRESH_MS  = 8000;

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

  const [currentUser, setCurrentUser]     = useState<CurrentUser | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId]   = useState<string | null>(null);
  const [messages, setMessages]           = useState<Message[]>([]);
  const [loadingConvs, setLoadingConvs]   = useState(true);
  const [loadingMsgs, setLoadingMsgs]     = useState(false);

  const activeConvIdRef = useRef<string | null>(null);
  const isBroadcastRef  = useRef(false);
  const messagesRef     = useRef<Message[]>([]);
  activeConvIdRef.current = activeConvId;
  isBroadcastRef.current  = isBroadcast;
  messagesRef.current     = messages;

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    api.get<CurrentUser>('/user/profile')
      .then(setCurrentUser)
      .catch(() => { clearToken(); navigate('/login', { replace: true }); });
  }, [navigate]);

  // ── Conversations list (sidebar) ──────────────────────────────────────────
  const refreshConversations = useCallback(async () => {
    try {
      const convs = await api.get<Conversation[]>('/api/catchat/conversations');
      setConversations(convs);
    } catch { /* silent */ }
    finally { setLoadingConvs(false); }
  }, []);

  useEffect(() => {
    refreshConversations();
    const id = setInterval(refreshConversations, CONV_REFRESH_MS);
    return () => clearInterval(id);
  }, [refreshConversations]);

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
  }, [peer, isBroadcast, navigate]);

  // ── Messages load when active conv changes ────────────────────────────────
  useEffect(() => {
    if (isBroadcast || !activeConvId) return;
    api.get<Message[]>(`/api/catchat/conversations/${activeConvId}/messages?limit=50`)
      .then(msgs => setMessages([...msgs].reverse()))
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
          if (incoming.length > 0) setMessages(prev => [...prev, ...incoming]);
        }
      } catch { /* silent */ }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // ── Send ──────────────────────────────────────────────────────────────────
  async function handleSend(content: string) {
    if (!content.trim()) return;
    if (isBroadcast) {
      const b = await api.post<Broadcast>('/api/catchat/broadcasts', { content: content.trim() });
      setMessages(prev => [...prev, broadcastToMessage(b)]);
      return;
    }
    if (!activeConvId) return;
    const msg = await api.post<Message>(
      `/api/catchat/conversations/${activeConvId}/messages`,
      { content: content.trim() }
    );
    setMessages(prev => [...prev, msg]);
    setConversations(prev => {
      const updated = prev.map(c =>
        c.id === activeConvId ? { ...c, last_message_at: msg.created_at } : c
      );
      return updated.sort((a, b) =>
        (b.last_message_at ?? b.created_at).localeCompare(a.last_message_at ?? a.created_at)
      );
    });
  }

  async function handleUserSearch(username: string): Promise<UserLookup | null> {
    try { return await api.get<UserLookup>(`/user/by-username/${encodeURIComponent(username)}`); }
    catch { return null; }
  }

  function handleLogout() { clearToken(); navigate('/login', { replace: true }); }

  const isAdmin    = currentUser?.role === 'admin';
  const activeConv = conversations.find(c => c.id === activeConvId) ?? null;
  // sidebar uses '__broadcast__' as sentinel for highlight when on /broadcast
  const activePeer = isBroadcast ? '__broadcast__' : (peer ?? null);

  return (
    <div className="chat-root">
      <Sidebar
        currentUser={currentUser}
        conversations={conversations}
        activePeer={activePeer}
        loading={loadingConvs}
        onUserSearch={handleUserSearch}
        onLogout={handleLogout}
      />
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
    </div>
  );
}
