import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { apiFetch } from '../services/apiFetch';

export interface AccessRule {
  division: string;
  position: string;
  modules: {
    mysteryShop: boolean;
    onboarding:  boolean;
    learning:    boolean;
  };
}

interface AccessContextType {
  canMysteryShop: boolean;
  canOnboarding:  boolean;
  canLearning:    boolean;
  isLoading:      boolean;
  matrix:         AccessRule[] | null;
  refreshMatrix:  () => Promise<void>;
}

const AccessContext = createContext<AccessContextType | null>(null);

export const AccessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [matrix, setMatrix]       = useState<AccessRule[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchMatrix = useCallback(async () => {
    setIsLoading(true);
    try {
      const res  = await apiFetch('/api/access-matrix');
      const data = await res.json() as { rules: AccessRule[] };
      setMatrix(data.rules);
    } catch {
      setMatrix([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchMatrix();
    else setMatrix(null);
  }, [user, fetchMatrix]);

  const rule = matrix?.find(
    r => r.division === user?.division && r.position === user?.position
  );

  const canMysteryShop = user?.isAdmin ? true : (rule?.modules.mysteryShop ?? false);
  const canOnboarding  = user?.isAdmin ? true : (rule?.modules.onboarding  ?? false);
  const canLearning    = user?.isAdmin ? true : (rule?.modules.learning    ?? false);

  return (
    <AccessContext.Provider value={{ canMysteryShop, canOnboarding, canLearning, isLoading, matrix, refreshMatrix: fetchMatrix }}>
      {children}
    </AccessContext.Provider>
  );
};

export const useAccess = () => {
  const ctx = useContext(AccessContext);
  if (!ctx) throw new Error('useAccess must be used within AccessProvider');
  return ctx;
};
