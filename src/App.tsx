import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getToken, saveToken } from './api';
import LoginPage from './pages/LoginPage';
import ChatLayout from './pages/ChatLayout';
import ChatPage from './pages/ChatPage';
import GroupPage from './pages/GroupPage';

// Consume a browser handoff before the router/auth guard mounts.
// The fragment is preferred because it is never sent to the static host,
// reverse proxy, or referrer. Query tokens remain accepted for old links.
function bootstrapTokenFromUrl() {
  const query = new URLSearchParams(window.location.search);
  const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const fragmentToken = fragment.get('token');
  const queryToken = query.get('token');
  const urlToken = fragmentToken || queryToken;
  if (!urlToken) return;

  // A fresh handoff must replace any stale CataChat token. The previous
  // implementation ignored the handoff whenever *any* token existed, causing
  // an expired token to force a second login.
  const remember = fragmentToken ? fragment.get('persist') !== '0' : true;
  saveToken(urlToken, remember);

  query.delete('token');
  fragment.delete('token');
  fragment.delete('persist');
  const qs = query.toString();
  const hash = fragment.toString();
  window.history.replaceState(
    {},
    '',
    `${window.location.pathname}${qs ? `?${qs}` : ''}${hash ? `#${hash}` : ''}`,
  );
}
bootstrapTokenFromUrl();

function RequireAuth({ children }: { children: React.ReactNode }) {
  return getToken() ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Persistent shell — Sidebar lives here and never remounts on navigation */}
        <Route element={<RequireAuth><ChatLayout /></RequireAuth>}>
          <Route path="/"              element={<ChatPage />} />
          <Route path="/broadcast"     element={<ChatPage />} />
          <Route path="/chat/:peer"    element={<ChatPage />} />
          <Route path="/conversation/:conversationId" element={<ChatPage />} />
          <Route path="/group/:groupId" element={<GroupPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
