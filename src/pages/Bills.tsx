import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Plus, X, Camera } from 'lucide-react';
import toast from 'react-hot-toast';
import { useBills } from '../hooks/useFirestore';
import { calculateSplits, getMonthKey, formatCurrency } from '../lib/billCalculator';
import { addBill, updateBill, deleteBill } from '../lib/firestore';
import { uploadBillImage } from '../lib/storage';
import { UTILITIES, FAMILY_NAMES } from '../lib/constants';
import type { UtilityType, FamilyName, BillSplit } from '../types';
import MonthPicker from '../components/MonthPicker';
import BillCard from '../components/BillCard';

export default function Bills() {
  const [month, setMonth] = useState(getMonthKey());
  const { bills, refresh, loading } = useBills();
  const [showForm, setShowForm] = useState(false);
  const [formUtility, setFormUtility] = useState<UtilityType>('VECO');
  const [formAmount, setFormAmount] = useState('');
  const [formImage, setFormImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [customSplits, setCustomSplits] = useState<Record<FamilyName, string>>({
    Bacarisas: '', Ocanada: '', Patino: '',
  });

  // Recalculate default splits when amount or utility changes
  useEffect(() => {
    const amount = parseFloat(formAmount);
    if (!isNaN(amount) && amount > 0) {
      const splits = calculateSplits(formUtility, amount);
      setCustomSplits(
        Object.fromEntries(splits.map((s) => [s.family, s.amount.toFixed(2)])) as Record<FamilyName, string>
      );
    } else {
      setCustomSplits({ Bacarisas: '', Ocanada: '', Patino: '' });
    }
  }, [formAmount, formUtility]);

  const monthBills = useMemo(() => bills.filter((b) => b.month === month), [bills, month]);

  const existingUtilities = useMemo(
    () => new Set(monthBills.map((b) => b.utility)),
    [monthBills]
  );

  const availableUtilities = useMemo(
    () => UTILITIES.filter((u) => !existingUtilities.has(u.type)),
    [existingUtilities]
  );

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }
    setFormImage(file);
    setImagePreview(URL.createObjectURL(file));
  }, []);

  const clearImage = useCallback(() => {
    setFormImage(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [imagePreview]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const amount = parseFloat(formAmount);
      if (isNaN(amount) || amount <= 0) {
        toast.error('Please enter a valid amount');
        return;
      }

      const splitTotal = FAMILY_NAMES.reduce((sum, f) => sum + (parseFloat(customSplits[f]) || 0), 0);
      const diff = Math.abs(splitTotal - amount);
      if (diff > 0.02) {
        toast.error(`Split amounts don't add up to total (off by ${formatCurrency(diff)})`);
        return;
      }

      setSubmitting(true);
      try {
        let imageUrl: string | undefined;
        if (formImage) {
          imageUrl = await uploadBillImage(formImage, month, formUtility);
        }

        const splits: BillSplit[] = FAMILY_NAMES.map((family) => ({
          family,
          amount: parseFloat(customSplits[family]) || 0,
          isPaid: false,
        }));
        await addBill({
          month,
          utility: formUtility,
          totalAmount: amount,
          dueDate: `${month}-25`,
          createdAt: new Date().toISOString(),
          splits,
          isPaidToProvider: false,
          ...(imageUrl && { imageUrl }),
        });
        toast.success(`${formUtility} bill added!`);
        setFormAmount('');
        clearImage();
        setShowForm(false);
        await refresh();
      } catch (err) {
        console.error('Failed to add bill:', err);
        toast.error('Failed to add bill');
      } finally {
        setSubmitting(false);
      }
    },
    [formAmount, formImage, formUtility, month, refresh, clearImage, customSplits]
  );

  const handleTogglePaid = useCallback(
    async (billId: string, family: FamilyName) => {
      const bill = bills.find((b) => b.id === billId);
      if (!bill) return;

      const newSplits: BillSplit[] = bill.splits.map((s) =>
        s.family === family
          ? { ...s, isPaid: !s.isPaid, paidDate: !s.isPaid ? new Date().toISOString() : undefined }
          : s
      );

      try {
        await updateBill(billId, { splits: newSplits });
        toast.success(`${family}'s payment ${newSplits.find((s) => s.family === family)?.isPaid ? 'confirmed' : 'unmarked'}`);
        await refresh();
      } catch {
        toast.error('Failed to update payment');
      }
    },
    [bills, refresh]
  );

  const handleDelete = useCallback(
    async (billId: string) => {
      if (!confirm('Delete this bill?')) return;
      try {
        await deleteBill(billId);
        toast.success('Bill deleted');
        await refresh();
      } catch {
        toast.error('Failed to delete bill');
      }
    },
    [refresh]
  );

  const handleTogglePaidToProvider = useCallback(
    async (billId: string) => {
      try {
        await updateBill(billId, { isPaidToProvider: true });
        toast.success('Bill marked as paid to provider!');
        await refresh();
      } catch {
        toast.error('Failed to update bill');
      }
    },
    [refresh]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <MonthPicker value={month} onChange={setMonth} />

      {/* Add Bill Button */}
      {availableUtilities.length > 0 && !showForm && (
        <button
          onClick={() => {
            setFormUtility(availableUtilities[0].type);
            setShowForm(true);
          }}
          className="w-full py-3 rounded-xl border-2 border-dashed border-slate-600 text-slate-400 hover:border-primary-500 hover:text-primary-400 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Bill for This Month
        </button>
      )}

      {/* Bill Entry Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-slate-800 rounded-xl p-4 border border-primary-500/30 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">New Bill</h3>
            <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Utility Selector */}
          <div>
            <label className="block text-xs text-slate-400 mb-2">Utility</label>
            <div className="grid grid-cols-3 gap-2">
              {availableUtilities.map((u) => (
                <button
                  key={u.type}
                  type="button"
                  onClick={() => setFormUtility(u.type)}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    formUtility === u.type
                      ? 'bg-primary-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {u.type}
                </button>
              ))}
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-xs text-slate-400 mb-2">Total Amount (₱)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formAmount}
              onChange={(e) => setFormAmount(e.target.value)}
              placeholder="Enter total bill amount"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-lg font-semibold focus:outline-none focus:border-primary-500 transition-colors"
              autoFocus
            />
          </div>

          {/* Bill Photo */}
          <div>
            <label className="block text-xs text-slate-400 mb-2">Bill Photo (optional)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageSelect}
              className="hidden"
            />
            {imagePreview ? (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Bill preview"
                  className="w-full h-40 object-cover rounded-lg border border-slate-600"
                />
                <button
                  type="button"
                  onClick={clearImage}
                  className="absolute top-2 right-2 p-1 bg-slate-900/80 rounded-full text-slate-300 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-4 rounded-lg border border-dashed border-slate-600 text-slate-400 hover:border-primary-500 hover:text-primary-400 transition-colors flex flex-col items-center gap-1"
              >
                <Camera className="w-5 h-5" />
                <span className="text-xs">Take photo or upload</span>
              </button>
            )}
          </div>

          {/* Adjustable Split */}
          {formAmount && parseFloat(formAmount) > 0 && (
            <div className="bg-slate-900/50 rounded-lg p-3">
              <p className="text-xs text-slate-400 mb-2">Split (adjust amounts)</p>
              <div className="space-y-2">
                {FAMILY_NAMES.map((family) => (
                  <div key={family} className="flex items-center justify-between gap-3">
                    <span className="text-sm min-w-[80px]">{family}</span>
                    <div className="relative flex-1 max-w-[140px]">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">₱</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={customSplits[family]}
                        onChange={(e) => setCustomSplits((prev) => ({ ...prev, [family]: e.target.value }))}
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg pl-7 pr-3 py-1.5 text-sm text-right font-medium focus:outline-none focus:border-primary-500 transition-colors"
                      />
                    </div>
                  </div>
                ))}
              </div>
              {(() => {
                const splitTotal = FAMILY_NAMES.reduce((sum, f) => sum + (parseFloat(customSplits[f]) || 0), 0);
                const diff = Math.round((splitTotal - parseFloat(formAmount)) * 100) / 100;
                if (diff === 0) return null;
                return (
                  <p className={`text-xs mt-2 ${Math.abs(diff) > 0.02 ? 'text-red-400' : 'text-slate-500'}`}>
                    {diff > 0 ? `Over by ${formatCurrency(diff)}` : `Under by ${formatCurrency(Math.abs(diff))}`}
                  </p>
                );
              })()}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-primary-600 hover:bg-primary-500 disabled:bg-slate-600 rounded-lg font-medium transition-colors"
          >
            {submitting ? 'Adding...' : 'Add Bill'}
          </button>
        </form>
      )}

      {/* Bills List */}
      {monthBills.length === 0 && !showForm ? (
        <div className="text-center py-12">
          <p className="text-slate-500">No bills for this month</p>
        </div>
      ) : (
        <div className="space-y-3">
          {monthBills.map((bill) => (
            <BillCard
              key={bill.id}
              bill={bill}
              onTogglePaid={handleTogglePaid}
              onDelete={handleDelete}
              onTogglePaidToProvider={handleTogglePaidToProvider}
            />
          ))}
        </div>
      )}
    </div>
  );
}
