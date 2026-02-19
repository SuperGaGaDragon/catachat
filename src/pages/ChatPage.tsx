import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearToken } from '../api';
import type { Conversation, Message, CurrentUser, UserLookup } from '../types';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import './ChatPage.css';

const POLL_INTERVAL_MS = 3000;   // new messages in active conv
const CONV_REFRESH_MS  = 8000;   // sidebar conversation list

export default function ChatPage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  // Refs so polling callbacks always see latest values without re-creating timers
  const activeConvIdRef = useRef<string | null>(null);
  const messagesRef = useRef<Message[]>([]);
  activeConvIdRef.current = activeConvId;
  messagesRef.current = messages;

  // Fetch current user profile
  useEffect(() => {
    api.get<CurrentUser>('/user/profile')
      .then(setCurrentUser)
      .catch(() => {
        clearToken();
        navigate('/login', { replace: true });
      });
  }, [navigate]);

  // Fetch conversations list
  const refreshConversations = useCallback(async () => {
    try {
      const convs = await api.get<Conversation[]>('/api/catchat/conversations');
      setConversations(convs);
    } catch {
      // ignore
    } finally {
      setLoadingConvs(false);
    }
  }, []);

  // Initial load + periodic refresh of conversation list
  useEffect(() => {
    refreshConversations();
    const id = setInterval(refreshConversations, CONV_REFRESH_MS);
    return () => clearInterval(id);
  }, [refreshConversations]);

  // Initial load of messages when active conv changes (with loading spinner)
  useEffect(() => {
    if (!activeConvId) {
      setMessages([]);
      return;
    }
    setLoadingMsgs(true);
    api.get<Message[]>(`/api/catchat/conversations/${activeConvId}/messages?limit=50`)
      .then(msgs => setMessages([...msgs].reverse()))
      .catch(() => setMessages([]))
      .finally(() => setLoadingMsgs(false));
  }, [activeConvId]);

  // Silent polling: fetch latest messages and append only NEW ones (no flicker)
  useEffect(() => {
    const id = setInterval(async () => {
      const convId = activeConvIdRef.current;
      if (!convId) return;
      try {
        const latest = await api.get<Message[]>(
          `/api/catchat/conversations/${convId}/messages?limit=50`
        );
        const reversed = [...latest].reverse();
        const existing = messagesRef.current;
        // Find messages not already in state
        const existingIds = new Set(existing.map(m => m.id));
        const incoming = reversed.filter(m => !existingIds.has(m.id));
        if (incoming.length > 0) {
          setMessages(prev => [...prev, ...incoming]);
        }
      } catch {
        // silent
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []); // intentionally empty — uses refs

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
      return updated.sort((a, b) => {
        const at = a.last_message_at ?? a.created_at;
        const bt = b.last_message_at ?? b.created_at;
        return bt.localeCompare(at);
      });
    });
  }

  async function handleStartConversation(otherUserId: string, otherUsername: string) {
    const conv = await api.post<Conversation>('/api/catchat/conversations', { user_id: otherUserId });
    const enriched: Conversation = { ...conv, other_username: otherUsername };
    setConversations(prev => {
      const exists = prev.find(c => c.id === enriched.id);
      if (exists) return prev;
      return [enriched, ...prev];
    });
    setActiveConvId(enriched.id);
  }

  async function handleUserSearch(username: string): Promise<UserLookup | null> {
    try {
      return await api.get<UserLookup>(`/user/by-username/${encodeURIComponent(username)}`);
    } catch {
      return null;
    }
  }

  function handleLogout() {
    clearToken();
    navigate('/login', { replace: true });
  }

  const activeConv = conversations.find(c => c.id === activeConvId) ?? null;

  return (
    <div className="chat-root">
      <Sidebar
        currentUser={currentUser}
        conversations={conversations}
        activeConvId={activeConvId}
        loading={loadingConvs}
        onSelectConv={setActiveConvId}
        onStartConversation={handleStartConversation}
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
