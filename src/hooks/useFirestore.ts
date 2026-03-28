import { useCallback } from 'react';
import type { AppSettings } from '../types';
import { useAppData } from '../context/AppDataContext';
import { saveSettings } from '../lib/firestore';

export function useBills() {
  const { bills, billsLoading, billsError, refreshBills } = useAppData();
  return { bills, loading: billsLoading, error: billsError, refresh: refreshBills };
}

export function usePayments() {
  const { payments, paymentsLoading, paymentsError, refreshPayments } = useAppData();
  return { payments, loading: paymentsLoading, error: paymentsError, refresh: refreshPayments };
}

export function useSettings() {
  const { settings, settingsLoading, settingsError, refreshSettings } = useAppData();

  const save = useCallback(async (newSettings: AppSettings) => {
    await saveSettings(newSettings);
    await refreshSettings();
  }, [refreshSettings]);

  return { settings, loading: settingsLoading, error: settingsError, save, refresh: refreshSettings };
}
