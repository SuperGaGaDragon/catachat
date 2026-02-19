import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearToken } from '../api';
import type { Conversation, Message, CurrentUser, UserLookup } from '../types';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import './ChatPage.css';

export default function ChatPage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

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

  useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);

  // Fetch messages for active conversation
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

  async function handleSend(content: string) {
    if (!activeConvId || !content.trim()) return;
    const msg = await api.post<Message>(
      `/api/catchat/conversations/${activeConvId}/messages`,
      { content: content.trim() }
    );
    setMessages(prev => [...prev, msg]);
    // bump conversation to top
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
    // attach username for display
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
