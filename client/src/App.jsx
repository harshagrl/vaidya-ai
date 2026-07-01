import React from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Header from './components/Header';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import UploadPage from './pages/UploadPage';
import ManualEntry from './components/ManualEntry';
import Timeline from './components/Timeline';
import ChatInterface from './components/ChatInterface';

/**
 * Wrapper that redirects unauthenticated users to /login.
 * Renders child routes via <Outlet /> when authenticated.
 */
function ProtectedRoute() {
  const { token } = useAuth();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

export default function App() {
  const { token } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header self-hides when !user, but we also gate on token so it never flashes */}
      {token && <Header />}

      <Routes>
        {/* Public route — redirects to dashboard if already logged in */}
        <Route
          path="/login"
          element={token ? <Navigate to="/" replace /> : <LoginPage />}
        />

        {/* All protected routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/manual" element={<ManualEntry />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/chat" element={<ChatInterface />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
