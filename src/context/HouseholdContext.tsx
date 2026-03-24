import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { FamilyName } from '../types';

interface HouseholdContextType {
  household: FamilyName | null;
  selectHousehold: (family: FamilyName) => void;
  clearHousehold: () => void;
}

const HouseholdContext = createContext<HouseholdContextType | null>(null);

const STORAGE_KEY = 'billsplit-household';

function getStoredHousehold(): FamilyName | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'Bacarisas' || stored === 'Ocanada' || stored === 'Patino') {
    return stored;
  }
  return null;
}

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const [household, setHousehold] = useState<FamilyName | null>(getStoredHousehold);

  const selectHousehold = useCallback((family: FamilyName) => {
    localStorage.setItem(STORAGE_KEY, family);
    setHousehold(family);
  }, []);

  const clearHousehold = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setHousehold(null);
  }, []);

  return (
    <HouseholdContext.Provider value={{ household, selectHousehold, clearHousehold }}>
      {children}
    </HouseholdContext.Provider>
  );
}

export function useHousehold() {
  const ctx = useContext(HouseholdContext);
  if (!ctx) {
    throw new Error('useHousehold must be used within a HouseholdProvider');
  }
  return ctx;
}
