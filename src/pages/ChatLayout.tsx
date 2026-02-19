/**
 * ChatLayout — persistent shell that wraps all auth'd chat routes.
 *
 * By living outside the per-route components, Sidebar never unmounts when
 * the user navigates between /chat/:peer, /group/:groupId, /broadcast, etc.
 * This eliminates the flash caused by Sidebar remounting on every navigation.
 *
 * Manages:
 *   - currentUser (auth)
 *   - conversations list + polling (passed to Sidebar & shared with child pages)
 *   - logout
 *
 * Child pages receive shared state via <Outlet context={...} />.
 */
import { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { api, clearToken } from '../api';
import type { Conversation, CurrentUser } from '../types';
import Sidebar from '../components/Sidebar';
import './ChatPage.css';   // .chat-root lives here

export interface ChatLayoutContext {
  currentUser: CurrentUser | null;
  conversations: Conversation[];
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
}

const CONV_REFRESH_MS = 8000;

export default function ChatLayout() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser]     = useState<CurrentUser | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConvs, setLoadingConvs]   = useState(true);

  // ── Auth ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    api.get<CurrentUser>('/user/profile')
      .then(setCurrentUser)
      .catch(() => { clearToken(); navigate('/login', { replace: true }); });
  }, [navigate]);

  // ── Conversations list ───────────────────────────────────────────────────────
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

  function handleLogout() { clearToken(); navigate('/login', { replace: true }); }

  const context: ChatLayoutContext = { currentUser, conversations, setConversations };

  return (
    <div className="chat-root">
      <Sidebar
        currentUser={currentUser}
        conversations={conversations}
        loading={loadingConvs}
        onLogout={handleLogout}
      />
      {/* Child page renders here — Sidebar above never remounts on navigation */}
      <Outlet context={context} />
    </div>
  );
}
