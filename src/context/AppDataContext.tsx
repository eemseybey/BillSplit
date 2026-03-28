import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AppSettings, Bill, Payment } from '../types';
import { getBills, getPayments, getSettings, saveSettings, subscribeToBills, subscribeToPayments, subscribeToSettings } from '../lib/firestore';
import { useHousehold } from './HouseholdContext';

interface AppDataContextType {
  bills: Bill[];
  payments: Payment[];
  settings: AppSettings | null;
  billsLoading: boolean;
  paymentsLoading: boolean;
  settingsLoading: boolean;
  billsError: string | null;
  paymentsError: string | null;
  settingsError: string | null;
  refreshBills: () => Promise<void>;
  refreshPayments: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  saveAppSettings: (newSettings: AppSettings) => Promise<void>;
}

const AppDataContext = createContext<AppDataContextType | null>(null);

function normalizeHouseholdId(value: string | undefined, fallback: string): string {
  return value ?? fallback;
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { household } = useHousehold();
  const householdId = household ?? '';
  const [rawBills, setRawBills] = useState<Bill[]>([]);
  const [rawPayments, setRawPayments] = useState<Payment[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  const [billsLoading, setBillsLoading] = useState(true);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);

  const [billsError, setBillsError] = useState<string | null>(null);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeBills = subscribeToBills(
      (nextBills) => {
        setRawBills(nextBills);
        setBillsLoading(false);
        setBillsError(null);
      },
      (error) => {
        setBillsLoading(false);
        setBillsError(error.message || 'Failed to subscribe to bills');
      }
    );

    const unsubscribePayments = subscribeToPayments(
      (nextPayments) => {
        setRawPayments(nextPayments);
        setPaymentsLoading(false);
        setPaymentsError(null);
      },
      (error) => {
        setPaymentsLoading(false);
        setPaymentsError(error.message || 'Failed to subscribe to payments');
      }
    );

    const unsubscribeSettings = subscribeToSettings(
      (nextSettings) => {
        setSettings(nextSettings);
        setSettingsLoading(false);
        setSettingsError(null);
      },
      (error) => {
        setSettingsLoading(false);
        setSettingsError(error.message || 'Failed to subscribe to settings');
      }
    );

    return () => {
      unsubscribeBills();
      unsubscribePayments();
      unsubscribeSettings();
    };
  }, []);

  const refreshBills = useCallback(async () => {
    try {
      setBillsLoading(true);
      const next = await getBills();
      setRawBills(next);
      setBillsError(null);
    } catch (error) {
      setBillsError(error instanceof Error ? error.message : 'Failed to refresh bills');
    } finally {
      setBillsLoading(false);
    }
  }, []);

  const refreshPayments = useCallback(async () => {
    try {
      setPaymentsLoading(true);
      const next = await getPayments();
      setRawPayments(next);
      setPaymentsError(null);
    } catch (error) {
      setPaymentsError(error instanceof Error ? error.message : 'Failed to refresh payments');
    } finally {
      setPaymentsLoading(false);
    }
  }, []);

  const refreshSettings = useCallback(async () => {
    try {
      setSettingsLoading(true);
      const next = await getSettings();
      setSettings(next);
      setSettingsError(null);
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : 'Failed to refresh settings');
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  const saveAppSettings = useCallback(async (newSettings: AppSettings) => {
    await saveSettings(newSettings);
    setSettings(newSettings);
  }, []);

  const bills = useMemo(
    () =>
      rawBills.filter((bill) => {
        if (!householdId) return true;
        return normalizeHouseholdId(bill.householdId, householdId) === householdId;
      }),
    [rawBills, householdId]
  );

  const payments = useMemo(
    () =>
      rawPayments.filter((payment) => {
        if (!householdId) return true;
        return normalizeHouseholdId(payment.householdId, householdId) === householdId;
      }),
    [rawPayments, householdId]
  );

  const value = useMemo<AppDataContextType>(
    () => ({
      bills,
      payments,
      settings,
      billsLoading,
      paymentsLoading,
      settingsLoading,
      billsError,
      paymentsError,
      settingsError,
      refreshBills,
      refreshPayments,
      refreshSettings,
      saveAppSettings,
    }),
    [
      bills,
      payments,
      settings,
      billsLoading,
      paymentsLoading,
      settingsLoading,
      billsError,
      paymentsError,
      settingsError,
      refreshBills,
      refreshPayments,
      refreshSettings,
      saveAppSettings,
    ]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) {
    throw new Error('useAppData must be used within AppDataProvider');
  }
  return ctx;
}
