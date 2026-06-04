import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { FamilyName } from '../types';
import { FAMILY_NAMES } from '../lib/constants';

interface HouseholdContextType {
  household: FamilyName;
  selectHousehold: (family: FamilyName) => void;
}

const HouseholdContext = createContext<HouseholdContextType | null>(null);

const STORAGE_KEY = 'billsplit-household';
const DEFAULT_HOUSEHOLD: FamilyName = FAMILY_NAMES[0];

function getStoredHousehold(): FamilyName {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (FAMILY_NAMES.includes(stored as FamilyName)) {
    return stored as FamilyName;
  }
  return DEFAULT_HOUSEHOLD;
}

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const [household, setHousehold] = useState<FamilyName>(getStoredHousehold);

  const selectHousehold = useCallback((family: FamilyName) => {
    localStorage.setItem(STORAGE_KEY, family);
    setHousehold(family);
  }, []);

  return (
    <HouseholdContext.Provider value={{ household, selectHousehold }}>
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
