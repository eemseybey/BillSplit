import type { Family, FamilyName, UtilityType, SplitRules } from '../types';

export const FAMILIES: Family[] = [
  { id: 'bacarisas', name: 'Bacarisas', color: '#3b82f6' },
  { id: 'ocanada', name: 'Ocanada', color: '#22c55e' },
  { id: 'patino', name: 'Patino', color: '#f59e0b' },
];

export const FAMILY_NAMES: FamilyName[] = ['Bacarisas', 'Ocanada', 'Patino'];

export const UTILITIES: { type: UtilityType; label: string; icon: string; color: string }[] = [
  { type: 'VECO', label: 'VECO (Electricity)', icon: 'Zap', color: '#eab308' },
  { type: 'PLDT', label: 'PLDT (WiFi)', icon: 'Wifi', color: '#3b82f6' },
  { type: 'MCWD', label: 'MCWD (Water)', icon: 'Droplets', color: '#06b6d4' },
];

export const BILL_DUE_DAY = 25;

// Fixed amounts for Ocanada
export const OCANADA_FIXED: Partial<Record<UtilityType, number>> = {
  VECO: 300,
  PLDT: 100,
};

export const DEFAULT_UTILITY_DUE_DAYS: Record<UtilityType, number> = {
  VECO: BILL_DUE_DAY,
  PLDT: BILL_DUE_DAY,
  MCWD: BILL_DUE_DAY,
};

export const DEFAULT_SPLIT_RULES: SplitRules = {
  VECO: {
    type: 'custom',
    fixedAmounts: { Ocanada: 300 },
    remainderFamilies: ['Bacarisas', 'Patino'],
  },
  PLDT: {
    type: 'custom',
    fixedAmounts: { Ocanada: 100 },
    remainderFamilies: ['Bacarisas', 'Patino'],
  },
  MCWD: { type: 'equal' },
};

export const FAMILY_COLORS: Record<FamilyName, string> = {
  Bacarisas: '#3b82f6',
  Ocanada: '#22c55e',
  Patino: '#f59e0b',
};
