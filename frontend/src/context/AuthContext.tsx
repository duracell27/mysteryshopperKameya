import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthUser } from '../types';
import { loginApi } from '../services/authService';
import { UNAUTHORIZED_EVENT } from '../services/apiFetch';

function decodeTokenUser(token: string): AuthUser | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (!payload.userId) return null;
    return {
      id: payload.userId,
      phone: payload.phone ?? '',
      name: payload.name ?? '',
      isAdmin: payload.isAdmin ?? false,
      division: payload.division ?? '',
      group: payload.group ?? '',
      position: payload.position ?? '',
      points: payload.points ?? 0,
      avatarUrl: payload.avatarUrl ?? null,
    };
  } catch {
    return null;
  }
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (patch: Partial<AuthUser>) => void;
  updatePoints: (points: number) => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('kameya_token');
    if (!storedToken) {
      setIsLoading(false);
      return;
    }
    setToken(storedToken);
    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${storedToken}` },
    })
      .then(async res => {
        if (res.status === 401) {
          localStorage.removeItem('kameya_token');
          setToken(null);
          return;
        }
        if (!res.ok) {
          // Server/network error — use JWT payload as fallback so user stays logged in
          const fallback = decodeTokenUser(storedToken);
          if (fallback) setUser(fallback);
          return;
        }
        const userData: AuthUser = await res.json();
        setUser(userData);
      })
      .catch(() => {
        // Network error — use JWT payload as fallback, don't remove token
        const fallback = decodeTokenUser(storedToken);
        if (fallback) setUser(fallback);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (phone: string, password: string) => {
    const { token: newToken, user: newUser } = await loginApi(phone, password);
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('kameya_token', newToken);
  };

  const updateUser = useCallback((patch: Partial<AuthUser>) => {
    setUser(prev => prev ? { ...prev, ...patch } : prev);
  }, []);

  const updatePoints = useCallback((points: number) => {
    setUser(prev => prev ? { ...prev, points } : prev);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('kameya_token');
  }, []);

  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, logout);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, logout);
  }, [logout]);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateUser, updatePoints, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
