import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import ProtectedRoute from './auth/ProtectedRoute';
import ParticleBackground from './components/ParticleBackground';
import AppShell from './components/AppShell';

import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Onboarding from './pages/Onboarding';
import Feed from './pages/Feed';
import Stats from './pages/Stats';
import Library from './pages/Library';
import Profile from './pages/Profile';

function Protected({ children }) {
  return <ProtectedRoute><AppShell>{children}</AppShell></ProtectedRoute>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        {/* Fixed full-viewport canvas, z-index 0, pointer-events off */}
        <ParticleBackground />

        {/* All page content sits above the particle layer */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <Routes>
            {/* Public — no sidebar */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Post-registration onboarding — authenticated, no AppShell */}
            <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

            {/*
              Feed + item detail share a single parent element so Feed never
              remounts when navigating between /feed and /items/:id. The
              pathless Route keeps the same component tree alive — only
              useParams().id changes, toggling the split panel.
            */}
            <Route element={<Protected><Feed /></Protected>}>
              <Route path="/feed" element={null} />
              <Route path="/items/:id" element={null} />
            </Route>

            {/* Protected — wrapped in AppShell (sidebar + main area) */}
            <Route path="/stats"     element={<Protected><Stats /></Protected>} />
            <Route path="/library"   element={<Protected><Library /></Protected>} />
            <Route path="/profile"   element={<Protected><Profile /></Protected>} />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
