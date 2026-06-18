import { createContext, useContext, useEffect, useState } from 'react';
import { setUnauthorizedHandler, getToken, storeToken, clearToken } from '../api/client';

const AuthContext = createContext(null);

const USER_KEY = 'pulse_user';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(getToken);
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null);
      setUser(null);
      localStorage.removeItem(USER_KEY);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  function login(newToken, newUser) {
    storeToken(newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }

  function logout() {
    clearToken();
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
