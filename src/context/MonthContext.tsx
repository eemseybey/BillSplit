import { createContext, useContext, useState, type ReactNode } from 'react';
import { getMonthKey } from '../lib/billCalculator';

interface MonthContextType {
  month: string;
  setMonth: (month: string) => void;
}

const MonthContext = createContext<MonthContextType | null>(null);

export function MonthProvider({ children }: { children: ReactNode }) {
  const [month, setMonth] = useState(getMonthKey());
  return (
    <MonthContext.Provider value={{ month, setMonth }}>
      {children}
    </MonthContext.Provider>
  );
}

export function useMonth() {
  const ctx = useContext(MonthContext);
  if (!ctx) {
    throw new Error('useMonth must be used within a MonthProvider');
  }
  return ctx;
}
