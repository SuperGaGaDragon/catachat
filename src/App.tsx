import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getToken, saveToken } from './api';
import LoginPage from './pages/LoginPage';
import ChatLayout from './pages/ChatLayout';
import ChatPage from './pages/ChatPage';
import GroupPage from './pages/GroupPage';

// If catachess passes ?token=<jwt> in the URL, persist it immediately
// so the user lands directly in the chat without re-logging in.
function bootstrapTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const urlToken = params.get('token');
  if (urlToken && !getToken()) {
    saveToken(urlToken, true);
    params.delete('token');
    const qs = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (qs ? '?' + qs : ''));
  }
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
          <Route path="/group/:groupId" element={<GroupPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
