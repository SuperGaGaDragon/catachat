import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getToken, saveToken } from './api';
import LoginPage from './pages/LoginPage';
import ChatPage from './pages/ChatPage';

// If catachess passes ?token=<jwt> in the URL, persist it immediately
// so the user lands directly in the chat without re-logging in.
function bootstrapTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const urlToken = params.get('token');
  if (urlToken && !getToken()) {
    saveToken(urlToken, true);
    // Clean the token out of the URL bar (cosmetic)
    const clean = window.location.pathname + (params.toString().replace(/token=[^&]+&?/, '').replace(/^&/, '') ? '?' + params.toString().replace(/token=[^&]+&?/, '').replace(/^&/, '') : '');
    window.history.replaceState({}, '', clean);
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
        <Route
          path="/*"
          element={
            <RequireAuth>
              <ChatPage />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
