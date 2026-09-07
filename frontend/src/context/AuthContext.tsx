import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthUser } from '../types';
import { loginApi } from '../services/authService';
import { UNAUTHORIZED_EVENT } from '../services/apiFetch';

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
    const storedUser = localStorage.getItem('kameya_user');
    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('kameya_token');
        localStorage.removeItem('kameya_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (phone: string, password: string) => {
    const { token: newToken, user: newUser } = await loginApi(phone, password);
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('kameya_token', newToken);
    localStorage.setItem('kameya_user', JSON.stringify(newUser));
  };

  const updateUser = useCallback((patch: Partial<AuthUser>) => {
    setUser(prev => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      localStorage.setItem('kameya_user', JSON.stringify(next));
      return next;
    });
  }, []);

  const updatePoints = useCallback((points: number) => {
    setUser(prev => {
      if (!prev) return prev;
      const next = { ...prev, points };
      localStorage.setItem('kameya_user', JSON.stringify(next));
      return next;
    });
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('kameya_token');
    localStorage.removeItem('kameya_user');
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
