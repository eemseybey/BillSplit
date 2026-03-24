import { useState, useEffect } from 'react';
import { Save, Send, Phone, Key, Bell, Users, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSettings } from '../hooks/useFirestore';
import { sendSMS } from '../lib/sms';
import { FAMILIES } from '../lib/constants';
import { useHousehold } from '../context/HouseholdContext';
import type { AppSettings, Family } from '../types';

export default function Settings() {
  const { household, clearHousehold } = useHousehold();
  const { settings, save, loading } = useSettings();
  const [apiKey, setApiKey] = useState('');
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [reminderDays, setReminderDays] = useState(3);
  const [families, setFamilies] = useState<Family[]>(FAMILIES);
  const [saving, setSaving] = useState(false);
  const [testNumber, setTestNumber] = useState('');

  useEffect(() => {
    if (settings) {
      setApiKey(settings.smsConfig?.apiKey || '');
      setSmsEnabled(settings.smsConfig?.enabled || false);
      setReminderDays(settings.smsConfig?.reminderDaysBefore || 3);
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
          enabled: smsEnabled,
          reminderDaysBefore: reminderDays,
        },
        families,
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
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Settings</h2>

      {/* Family Phone Numbers */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
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
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-primary-400" />
          <h3 className="font-semibold">SMS Notifications</h3>
        </div>

        {/* Enable Toggle */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm">Enable SMS Alerts</span>
          <button
            onClick={() => setSmsEnabled(!smsEnabled)}
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

        {/* API Key */}
        <div className="mb-4">
          <label className="block text-xs text-slate-400 mb-1">
            Semaphore API Key
          </label>
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
          <p className="text-xs text-slate-500 mt-1">
            Get your free API key at semaphore.co (50 free SMS credits)
          </p>
        </div>

        {/* Reminder Days */}
        <div className="mb-4">
          <label className="block text-xs text-slate-400 mb-1">
            Send reminder X days before due date
          </label>
          <input
            type="number"
            min={1}
            max={10}
            value={reminderDays}
            onChange={(e) => setReminderDays(parseInt(e.target.value) || 3)}
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
          />
        </div>

        {/* Test SMS */}
        <div className="bg-slate-900/50 rounded-lg p-3">
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

      {/* Split Rules Info */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
        <h3 className="font-semibold mb-3">Split Rules</h3>
        <div className="space-y-2 text-sm text-slate-300">
          <div className="flex items-start gap-2">
            <span className="text-yellow-400 font-mono text-xs mt-0.5">VECO</span>
            <span>Ocanada = ₱300 fixed, rest split between Bacarisas & Patino</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-blue-400 font-mono text-xs mt-0.5">PLDT</span>
            <span>Ocanada = ₱100 fixed, rest split between Bacarisas & Patino</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-cyan-400 font-mono text-xs mt-0.5">MCWD</span>
            <span>Equal 3-way split</span>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 bg-primary-600 hover:bg-primary-500 disabled:bg-slate-600 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
      >
        <Save className="w-5 h-5" />
        {saving ? 'Saving...' : 'Save Settings'}
      </button>

      {/* Switch Household */}
      <button
        onClick={clearHousehold}
        className="w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors text-slate-300"
      >
        <LogOut className="w-5 h-5" />
        Switch Household (current: {household})
      </button>
    </div>
  );
}
