import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthUser } from '../types';
import { loginApi } from '../services/authService';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => void;
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

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('kameya_token');
    localStorage.removeItem('kameya_user');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
