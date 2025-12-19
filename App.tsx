
import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import ChatInterface from './components/ChatInterface';
import { User, ChatSession } from './types';
import { backend } from './backendService';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    // Establishing connection to virtual backend
    const savedSessions = backend.getSessions();
    const savedUser = backend.getUser();

    if (savedSessions) setSessions(savedSessions);
    if (savedUser) setUser(savedUser);

    const timer = setTimeout(() => setIsInitializing(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isInitializing) {
      backend.saveSessions(sessions);
    }
  }, [sessions, isInitializing]);

  const handleLogin = (username: string) => {
    const newUser: User = { username, isAuthenticated: true };
    setUser(newUser);
    backend.saveUser(newUser);
  };

  const handleLogout = () => {
    setUser(null);
    setSessions([]);
    backend.clearAuth();
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#050807] flex items-center justify-center mono">
        <div className="text-center space-y-6">
          <div className="w-64 h-1 bg-amber-900/10 relative overflow-hidden rounded-full border border-amber-900/10">
            <div className="absolute top-0 left-0 h-full bg-amber-500/80 animate-loading-bar"></div>
          </div>
          <p className="text-[10px] gold-text tracking-[0.8em] uppercase animate-pulse">Etablerar Diagnostisk Upplänk</p>
        </div>
        <style>{`
          @keyframes loading-bar {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
          .animate-loading-bar {
            width: 100%;
            animation: loading-bar 2s infinite cubic-bezier(0.65, 0, 0.35, 1);
          }
        `}</style>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <ChatInterface
      user={user}
      sessions={sessions}
      setSessions={setSessions}
      onLogout={handleLogout}
    />
  );
};

export default App;
