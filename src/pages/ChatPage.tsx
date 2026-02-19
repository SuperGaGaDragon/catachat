import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, clearToken } from '../api';
import type { Conversation, Message, CurrentUser, UserLookup } from '../types';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import './ChatPage.css';

const POLL_INTERVAL_MS = 3000;
const CONV_REFRESH_MS  = 8000;

export default function ChatPage() {
  const navigate = useNavigate();
  const { peer } = useParams<{ peer: string }>();   // username of the other person

  const [currentUser, setCurrentUser]     = useState<CurrentUser | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId]   = useState<string | null>(null);
  const [messages, setMessages]           = useState<Message[]>([]);
  const [loadingConvs, setLoadingConvs]   = useState(true);
  const [loadingMsgs, setLoadingMsgs]     = useState(false);

  const activeConvIdRef = useRef<string | null>(null);
  const messagesRef     = useRef<Message[]>([]);
  activeConvIdRef.current = activeConvId;
  messagesRef.current     = messages;

  // ── Auth: load current user ────────────────────────────────────────────────
  useEffect(() => {
    api.get<CurrentUser>('/user/profile')
      .then(setCurrentUser)
      .catch(() => { clearToken(); navigate('/login', { replace: true }); });
  }, [navigate]);

  // ── Conversations: initial load + periodic refresh ─────────────────────────
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

  // ── URL → conversation: when :peer changes, resolve and open ──────────────
  useEffect(() => {
    if (!peer) {
      setActiveConvId(null);
      setMessages([]);
      return;
    }
    let cancelled = false;
    async function openPeerConversation() {
      // 1. Resolve username → userId
      const userInfo = await api.get<UserLookup>(`/user/by-username/${encodeURIComponent(peer!)}`);
      // 2. Get or create the conversation
      const conv = await api.post<Conversation>('/api/catchat/conversations', { user_id: userInfo.id });
      if (cancelled) return;
      // Ensure the conversation appears in the sidebar with the correct username
      setConversations(prev => {
        const enriched: Conversation = { ...conv, other_username: peer };
        const idx = prev.findIndex(c => c.id === enriched.id);
        if (idx === -1) return [enriched, ...prev];
        // Update username in case it was missing
        const updated = [...prev];
        updated[idx] = { ...prev[idx], other_username: peer };
        return updated;
      });
      setActiveConvId(conv.id);
    }
    setLoadingMsgs(true);
    openPeerConversation().catch(() => navigate('/', { replace: true }));
    return () => { cancelled = true; };
  }, [peer, navigate]);

  // ── Messages: load when active conv changes ───────────────────────────────
  useEffect(() => {
    if (!activeConvId) { setMessages([]); return; }
    api.get<Message[]>(`/api/catchat/conversations/${activeConvId}/messages?limit=50`)
      .then(msgs => setMessages([...msgs].reverse()))
      .catch(() => setMessages([]))
      .finally(() => setLoadingMsgs(false));
  }, [activeConvId]);

  // ── Silent polling: append only NEW messages every 3s ────────────────────
  useEffect(() => {
    const id = setInterval(async () => {
      const convId = activeConvIdRef.current;
      if (!convId) return;
      try {
        const latest = await api.get<Message[]>(
          `/api/catchat/conversations/${convId}/messages?limit=50`
        );
        const reversed    = [...latest].reverse();
        const existingIds = new Set(messagesRef.current.map(m => m.id));
        const incoming    = reversed.filter(m => !existingIds.has(m.id));
        if (incoming.length > 0) setMessages(prev => [...prev, ...incoming]);
      } catch { /* silent */ }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // ── Send message ──────────────────────────────────────────────────────────
  async function handleSend(content: string) {
    if (!activeConvId || !content.trim()) return;
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

  // ── User search (for NewChatDialog) ──────────────────────────────────────
  async function handleUserSearch(username: string): Promise<UserLookup | null> {
    try { return await api.get<UserLookup>(`/user/by-username/${encodeURIComponent(username)}`); }
    catch { return null; }
  }

  function handleLogout() { clearToken(); navigate('/login', { replace: true }); }

  const activeConv = conversations.find(c => c.id === activeConvId) ?? null;

  return (
    <div className="chat-root">
      <Sidebar
        currentUser={currentUser}
        conversations={conversations}
        activePeer={peer ?? null}
        loading={loadingConvs}
        onUserSearch={handleUserSearch}
        onLogout={handleLogout}
      />
      <ChatWindow
        currentUser={currentUser}
        conversation={activeConv}
        messages={messages}
        loading={loadingMsgs}
        onSend={handleSend}
      />
    </div>
  );
}
