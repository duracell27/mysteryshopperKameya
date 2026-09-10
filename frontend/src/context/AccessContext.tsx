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
    shop:        boolean;
    library:     boolean;
  };
}

export interface LearningRule {
  division:  string;
  group?:    string;
  position?: string;
  sections: {
    general:    boolean;
    start:      boolean;
    consultant: boolean;
    managers:   boolean;
    marketing:  boolean;
  };
}

export type LearningAccess = LearningRule['sections'];

const DEFAULT_LEARNING_ACCESS: LearningAccess = {
  general: false, start: false, consultant: false, managers: false, marketing: false,
};

function matchLearningRule(rules: LearningRule[], division: string, group: string, position: string): LearningRule | undefined {
  return rules.find(r => {
    if (r.division !== division) return false;
    if (r.group === 'other') return group !== 'marketing';
    if (r.group && r.group !== group) return false;
    if (r.position && r.position !== position) return false;
    return true;
  });
}

interface AccessContextType {
  canMysteryShop: boolean;
  canOnboarding:  boolean;
  canLearning:    boolean;
  canShop:        boolean;
  canLibrary:     boolean;
  learningAccess: LearningAccess;
  isLoading:      boolean;
  matrix:         AccessRule[]    | null;
  learningMatrix: LearningRule[]  | null;
  refreshMatrix:  () => Promise<void>;
}

const AccessContext = createContext<AccessContextType | null>(null);

export const AccessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [matrix, setMatrix]               = useState<AccessRule[]   | null>(null);
  const [learningMatrix, setLearningMatrix] = useState<LearningRule[] | null>(null);
  const [isLoading, setIsLoading]         = useState(false);

  const fetchMatrix = useCallback(async () => {
    setIsLoading(true);
    try {
      const res  = await apiFetch('/api/access-matrix');
      const data = await res.json() as { rules: AccessRule[]; learningRules: LearningRule[] };
      setMatrix(data.rules);
      setLearningMatrix(data.learningRules ?? []);
    } catch {
      setMatrix([]);
      setLearningMatrix([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchMatrix();
    else { setMatrix(null); setLearningMatrix(null); }
  }, [user, fetchMatrix]);

  const rule = matrix?.find(
    r => r.division === user?.division && r.position === user?.position
  );

  const canMysteryShop = user?.isAdmin ? true : (rule?.modules.mysteryShop ?? false);
  const canOnboarding  = user?.isAdmin ? true : (rule?.modules.onboarding  ?? false);
  const canLearning    = user?.isAdmin ? true : (rule?.modules.learning    ?? false);
  const canShop        = user?.isAdmin ? true : (rule?.modules.shop        ?? false);
  const canLibrary     = user?.isAdmin ? true : (rule?.modules.library     ?? false);

  const learningAccess: LearningAccess = user?.isAdmin
    ? { general: true, start: true, consultant: true, managers: true, marketing: true }
    : (learningMatrix && user
        ? (matchLearningRule(learningMatrix, user.division, user.group, user.position)?.sections ?? DEFAULT_LEARNING_ACCESS)
        : DEFAULT_LEARNING_ACCESS);

  return (
    <AccessContext.Provider value={{
      canMysteryShop, canOnboarding, canLearning, canShop, canLibrary,
      learningAccess, isLoading,
      matrix, learningMatrix,
      refreshMatrix: fetchMatrix,
    }}>
      {children}
    </AccessContext.Provider>
  );
};

export const useAccess = () => {
  const ctx = useContext(AccessContext);
  if (!ctx) throw new Error('useAccess must be used within AccessProvider');
  return ctx;
};
