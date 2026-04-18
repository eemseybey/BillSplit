import { useState, useEffect } from 'react';
import { Save, Send, Phone, Key, Bell, Users, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSettings } from '../hooks/useFirestore';
import { sendSMS } from '../lib/sms';
import { DEFAULT_SPLIT_RULES, DEFAULT_UTILITY_DUE_DAYS, FAMILIES, FAMILY_NAMES, FAMILY_COLORS } from '../lib/constants';
import { useHousehold } from '../context/HouseholdContext';
import { SMS_ENABLED } from '../lib/features';
import type { AppSettings, Family, FamilyName, SplitRules, UtilityType } from '../types';
import ErrorPanel from '../components/ErrorPanel';

export default function Settings() {
  const { household, clearHousehold } = useHousehold();
  const { settings, save, loading, error, refresh } = useSettings();
  const [apiKey, setApiKey] = useState('');
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [reminderDays, setReminderDays] = useState(3);
  const [families, setFamilies] = useState<Family[]>(FAMILIES);
  const [utilityDueDays, setUtilityDueDays] = useState<Record<UtilityType, number>>(DEFAULT_UTILITY_DUE_DAYS);
  const [splitRules, setSplitRules] = useState<SplitRules>(DEFAULT_SPLIT_RULES);
  const [saving, setSaving] = useState(false);
  const [testNumber, setTestNumber] = useState('');

  useEffect(() => {
    if (settings) {
      setApiKey(settings.smsConfig?.apiKey || '');
      setSmsEnabled(settings.smsConfig?.enabled || false);
      setReminderDays(settings.smsConfig?.reminderDaysBefore || 3);
      setUtilityDueDays({
        VECO: settings.utilityDueDays?.VECO ?? DEFAULT_UTILITY_DUE_DAYS.VECO,
        PLDT: settings.utilityDueDays?.PLDT ?? DEFAULT_UTILITY_DUE_DAYS.PLDT,
        MCWD: settings.utilityDueDays?.MCWD ?? DEFAULT_UTILITY_DUE_DAYS.MCWD,
      });
      setSplitRules(settings.splitRules ?? DEFAULT_SPLIT_RULES);
      if (settings.families?.length > 0) {
        setFamilies(settings.families);
      }
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const newSettings: AppSettings = {
        smsConfig: {
          apiKey,
          enabled: SMS_ENABLED ? smsEnabled : false,
          reminderDaysBefore: reminderDays,
        },
        families,
        splitRules,
        utilityDueDays,
      };
      await save(newSettings);
      toast.success('Settings saved!');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestSMS = async () => {
    if (!apiKey || !testNumber) {
      toast.error('Enter API key and test number');
      return;
    }
    const result = await sendSMS(apiKey, testNumber, 'Test from BillSplit Tracker! Your SMS notifications are working.');
    toast[result.success ? 'success' : 'error'](result.message);
  };

  const updateFamilyPhone = (index: number, phone: string) => {
    const updated = [...families];
    updated[index] = { ...updated[index], phone };
    setFamilies(updated);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 fade-slide-in">
      <h2 className="text-lg font-bold">Settings</h2>
      {error && <ErrorPanel message={error} onRetry={refresh} />}

      {/* Family Phone Numbers */}
      <div className="glass-panel rounded-2xl p-4 hover-lift">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-primary-400" />
          <h3 className="font-semibold">Family Phone Numbers</h3>
        </div>
        <div className="space-y-3">
          {families.map((family, i) => (
            <div key={family.id}>
              <label className="block text-xs text-slate-400 mb-1">{family.name}</label>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-slate-500" />
                <input
                  type="tel"
                  value={family.phone || ''}
                  onChange={(e) => updateFamilyPhone(i, e.target.value)}
                  placeholder="09171234567"
                  className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SMS Configuration */}
      {SMS_ENABLED ? (
        <div className="glass-panel rounded-2xl p-4 hover-lift">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-5 h-5 text-primary-400" />
            <h3 className="font-semibold">SMS Notifications</h3>
          </div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm">Enable SMS Alerts</span>
            <button
              onClick={() => setSmsEnabled(!smsEnabled)}
              role="switch"
              aria-checked={smsEnabled}
              aria-label="Enable SMS alerts"
              className={`w-12 h-6 rounded-full transition-colors relative ${
                smsEnabled ? 'bg-primary-500' : 'bg-slate-600'
              }`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${
                  smsEnabled ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
          <div className="mb-4">
            <label className="block text-xs text-slate-400 mb-1">Semaphore API Key</label>
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-slate-500" />
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your Semaphore API key"
                className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-xs text-slate-400 mb-1">Send reminder X days before due date</label>
            <input
              type="number"
              min={1}
              max={10}
              value={reminderDays}
              onChange={(e) => setReminderDays(parseInt(e.target.value, 10) || 3)}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
            />
          </div>
          <div className="bg-slate-900/50 rounded-xl p-3 border border-slate-700/60">
            <label className="block text-xs text-slate-400 mb-2">Test SMS</label>
            <div className="flex gap-2">
              <input
                type="tel"
                value={testNumber}
                onChange={(e) => setTestNumber(e.target.value)}
                placeholder="09171234567"
                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
              />
              <button
                onClick={handleTestSMS}
                className="flex items-center gap-1 px-4 py-2 bg-primary-600 rounded-lg text-sm font-medium hover:bg-primary-500 transition-colors"
              >
                <Send className="w-4 h-4" />
                Test
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl p-4 text-sm text-slate-400">
          SMS features are disabled in this build.
        </div>
      )}

      {/* Due Day Defaults */}
      <div className="glass-panel rounded-2xl p-4 hover-lift">
        <h3 className="font-semibold mb-3">Utility Due Days</h3>
        <div className="grid grid-cols-3 gap-2">
          {(['VECO', 'PLDT', 'MCWD'] as UtilityType[]).map((utility) => (
            <label key={utility} className="text-xs text-slate-400">
              {utility}
              <input
                type="number"
                min={1}
                max={31}
                value={utilityDueDays[utility]}
                onChange={(event) =>
                  setUtilityDueDays((prev) => ({ ...prev, [utility]: Math.max(1, Math.min(31, parseInt(event.target.value, 10) || 25)) }))
                }
                className="mt-1 w-full bg-slate-900 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-primary-500"
              />
            </label>
          ))}
        </div>
      </div>

      {/* Split Rules */}
      <div className="glass-panel rounded-2xl p-4 hover-lift">
        <h3 className="font-semibold mb-3">Split Rules</h3>
        <p className="text-xs text-slate-500 mb-3">
          Equal = split total evenly across all families. Custom = set fixed amounts for any family, and pick who covers the remainder.
        </p>
        <div className="space-y-3">
          {(['VECO', 'PLDT', 'MCWD'] as UtilityType[]).map((utility) => {
            const rule = splitRules[utility];
            const isCustom = rule.type === 'custom' || rule.type === 'fixed-ocanada';
            const fixedAmounts = rule.fixedAmounts ?? {};
            const remainderFamilies = rule.remainderFamilies ?? [];

            const toggleFixed = (family: FamilyName) => {
              setSplitRules((prev) => {
                const current = prev[utility];
                const currentFixed = { ...(current.fixedAmounts ?? {}) };
                if (family in currentFixed) {
                  delete currentFixed[family];
                } else {
                  currentFixed[family] = 0;
                }
                return {
                  ...prev,
                  [utility]: {
                    type: 'custom',
                    fixedAmounts: currentFixed,
                    remainderFamilies: current.remainderFamilies ?? [],
                  },
                };
              });
            };

            const setFixedAmount = (family: FamilyName, amount: number) => {
              setSplitRules((prev) => ({
                ...prev,
                [utility]: {
                  type: 'custom',
                  fixedAmounts: { ...(prev[utility].fixedAmounts ?? {}), [family]: amount },
                  remainderFamilies: prev[utility].remainderFamilies ?? [],
                },
              }));
            };

            const toggleRemainder = (family: FamilyName) => {
              setSplitRules((prev) => {
                const current = prev[utility];
                const currentRemainder = current.remainderFamilies ?? [];
                const next = currentRemainder.includes(family)
                  ? currentRemainder.filter((f) => f !== family)
                  : [...currentRemainder, family];
                return {
                  ...prev,
                  [utility]: {
                    type: 'custom',
                    fixedAmounts: current.fixedAmounts ?? {},
                    remainderFamilies: next,
                  },
                };
              });
            };

            return (
              <div key={utility} className="bg-slate-900/50 rounded-xl p-3 border border-slate-700/60">
                <p className="text-sm font-medium mb-2">{utility}</p>
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setSplitRules((prev) => ({ ...prev, [utility]: { type: 'equal' } }))}
                    className={`px-2 py-1 rounded text-xs ${rule.type === 'equal' ? 'bg-primary-600 text-white' : 'bg-slate-700 text-slate-300'}`}
                  >
                    Equal Split
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSplitRules((prev) => ({
                        ...prev,
                        [utility]: {
                          type: 'custom',
                          fixedAmounts: prev[utility].fixedAmounts ?? {},
                          remainderFamilies: prev[utility].remainderFamilies ?? [],
                        },
                      }))
                    }
                    className={`px-2 py-1 rounded text-xs ${isCustom ? 'bg-primary-600 text-white' : 'bg-slate-700 text-slate-300'}`}
                  >
                    Custom
                  </button>
                </div>

                {isCustom && (
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-slate-400 mb-2">Fixed amounts</p>
                      <div className="space-y-2">
                        {FAMILY_NAMES.map((family) => {
                          const hasFixed = family in fixedAmounts;
                          return (
                            <div key={family} className="flex items-center gap-2">
                              <label className="flex items-center gap-2 flex-1 text-xs">
                                <input
                                  type="checkbox"
                                  checked={hasFixed}
                                  onChange={() => toggleFixed(family)}
                                  className="w-4 h-4 accent-primary-500"
                                />
                                <span style={{ color: FAMILY_COLORS[family] }}>{family}</span>
                              </label>
                              {hasFixed && (
                                <div className="relative w-28">
                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">₱</span>
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={fixedAmounts[family] ?? 0}
                                    onChange={(event) => setFixedAmount(family, parseFloat(event.target.value) || 0)}
                                    className="w-full bg-slate-800 border border-slate-600 rounded-lg pl-5 pr-2 py-1 text-xs text-right text-slate-100 focus:outline-none focus:border-primary-500"
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-slate-400 mb-2">Who covers the remainder?</p>
                      <div className="flex flex-wrap gap-2">
                        {FAMILY_NAMES.map((family) => {
                          const isActive = remainderFamilies.includes(family);
                          return (
                            <button
                              key={family}
                              type="button"
                              onClick={() => toggleRemainder(family)}
                              className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                                isActive
                                  ? 'border-primary-500 bg-primary-500/20 text-primary-200'
                                  : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500'
                              }`}
                            >
                              {family}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-2">
                        {remainderFamilies.length === 0
                          ? 'No one covers the remainder — any leftover goes to the first fixed family.'
                          : remainderFamilies.length === 1
                          ? `${remainderFamilies[0]} pays 100% of the remainder.`
                          : `Remainder split equally between ${remainderFamilies.join(' & ')}.`}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 animated-gradient-btn disabled:bg-slate-600 rounded-2xl font-medium flex items-center justify-center gap-2 transition-all hover-lift"
      >
        <Save className="w-5 h-5" />
        {saving ? 'Saving...' : 'Save Settings'}
      </button>

      {/* Switch Household */}
      <button
        onClick={clearHousehold}
        className="w-full py-3 glass-panel rounded-2xl font-medium flex items-center justify-center gap-2 transition-colors text-slate-300 hover:border-primary-500 interactive-press"
      >
        <LogOut className="w-5 h-5" />
        Switch Household (current: {household})
      </button>
    </div>
  );
}
