import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Plus, X, Camera } from 'lucide-react';
import toast from 'react-hot-toast';
import { useBills, useSettings } from '../hooks/useFirestore';
import { calculateSplits, getMonthKey, formatCurrency } from '../lib/billCalculator';
import { addBill, updateBill, deleteBill } from '../lib/firestore';
import { deleteBillImage, uploadBillImage } from '../lib/storage';
import { DEFAULT_UTILITY_DUE_DAYS, FAMILY_NAMES, UTILITIES } from '../lib/constants';
import type { Bill, BillSplit, FamilyName, UtilityType } from '../types';
import { useHousehold } from '../context/HouseholdContext';
import BillCard from '../components/BillCard';
import ConfirmDialog from '../components/ConfirmDialog';
import ErrorPanel from '../components/ErrorPanel';
import MonthPicker from '../components/MonthPicker';

export default function Bills() {
  const { household } = useHousehold();
  const [month, setMonth] = useState(getMonthKey());
  const { bills, refresh, loading, error } = useBills();
  const { settings } = useSettings();
  const [showForm, setShowForm] = useState(false);
  const [formUtility, setFormUtility] = useState<UtilityType>('VECO');
  const [formAmount, setFormAmount] = useState('');
  const [formImage, setFormImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteQueue, setDeleteQueue] = useState<Record<string, number>>({});
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editSplits, setEditSplits] = useState<Record<FamilyName, string>>({
    Bacarisas: '',
    Ocanada: '',
    Patino: '',
  });
  const [editImage, setEditImage] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const [customSplits, setCustomSplits] = useState<Record<FamilyName, string>>({
    Bacarisas: '', Ocanada: '', Patino: '',
  });

  // Recalculate default splits when amount or utility changes
  useEffect(() => {
    const amount = parseFloat(formAmount);
    if (!isNaN(amount) && amount > 0) {
      const splits = calculateSplits(formUtility, amount, settings?.splitRules);
      setCustomSplits(
        Object.fromEntries(splits.map((s) => [s.family, s.amount.toFixed(2)])) as Record<FamilyName, string>
      );
    } else {
      setCustomSplits({ Bacarisas: '', Ocanada: '', Patino: '' });
    }
  }, [formAmount, formUtility, settings?.splitRules]);

  useEffect(
    () => () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
      if (editImagePreview && editImagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(editImagePreview);
      }
      Object.values(deleteQueue).forEach((timeoutId) => window.clearTimeout(timeoutId));
    },
    [imagePreview, editImagePreview, deleteQueue]
  );

  const monthBills = useMemo(() => bills.filter((b) => b.month === month), [bills, month]);
  const previousMonthBills = useMemo(() => {
    const [year, monthPart] = month.split('-').map(Number);
    const date = new Date(year, monthPart - 2);
    const previousMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return bills.filter((bill) => bill.month === previousMonth);
  }, [bills, month]);

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
          householdId: household ?? undefined,
          utility: formUtility,
          totalAmount: amount,
          dueDate: `${month}-${String(settings?.utilityDueDays?.[formUtility] ?? DEFAULT_UTILITY_DUE_DAYS[formUtility]).padStart(2, '0')}`,
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
    [customSplits, formAmount, formImage, formUtility, month, household, refresh, clearImage, settings?.utilityDueDays]
  );

  const handleTogglePaid = useCallback(
    async (billId: string, family: FamilyName) => {
      const bill = bills.find((b) => b.id === billId);
      if (!bill) return;

      const newSplits: BillSplit[] = bill.splits.map((s) => {
        if (s.family !== family) return s;
        const next: BillSplit = { ...s, isPaid: !s.isPaid };
        if (!s.isPaid) {
          next.paidDate = new Date().toISOString();
        } else {
          delete next.paidDate;
          delete next.paidTo;
        }
        return next;
      });

      try {
        await updateBill(billId, { splits: newSplits });
        toast.success(`${family}'s payment ${newSplits.find((s) => s.family === family)?.isPaid ? 'confirmed' : 'unmarked'}`);
        await refresh();
      } catch (err) {
        console.error('Failed to update payment:', err);
        toast.error('Failed to update payment');
      }
    },
    [bills, refresh]
  );

  const queueDelete = useCallback(
    (billId: string) => {
      setPendingDeleteId(billId);
    },
    []
  );

  const confirmDelete = useCallback(async () => {
    const billId = pendingDeleteId;
    setPendingDeleteId(null);
    if (!billId) return;

    const timeoutId = window.setTimeout(async () => {
      try {
        await deleteBill(billId);
        await refresh();
      } catch {
        toast.error('Failed to delete bill');
      } finally {
        setDeleteQueue((prev) => {
          const next = { ...prev };
          delete next[billId];
          return next;
        });
      }
    }, 5000);
    setDeleteQueue((prev) => ({ ...prev, [billId]: timeoutId }));

    toast((t) => (
      <div className="flex items-center gap-2">
        <span className="text-sm">Bill deletion queued.</span>
        <button
          className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600"
          onClick={() => {
            window.clearTimeout(timeoutId);
            setDeleteQueue((prev) => {
              const next = { ...prev };
              delete next[billId];
              return next;
            });
            toast.dismiss(t.id);
            toast.success('Deletion undone');
          }}
        >
          Undo
        </button>
      </div>
    ), { duration: 5000 });
  }, [pendingDeleteId, refresh]);

  const handleCopyPreviousMonth = useCallback(() => {
    const existing = new Set(monthBills.map((bill) => bill.utility));
    const candidate = previousMonthBills.find((bill) => !existing.has(bill.utility));
    if (!candidate) {
      toast('Nothing to copy from previous month.');
      return;
    }
    setFormUtility(candidate.utility);
    setFormAmount(candidate.totalAmount.toFixed(2));
    setCustomSplits(
      Object.fromEntries(candidate.splits.map((split) => [split.family, split.amount.toFixed(2)])) as Record<FamilyName, string>
    );
    setShowForm(true);
    toast.success(`Copied ${candidate.utility} from previous month. Review before saving.`);
  }, [monthBills, previousMonthBills]);

  const openEditBill = useCallback((bill: Bill) => {
    if (editImagePreview && editImagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(editImagePreview);
    }
    setEditingBill(bill);
    setEditAmount(bill.totalAmount.toFixed(2));
    setEditSplits(
      Object.fromEntries(bill.splits.map((split) => [split.family, split.amount.toFixed(2)])) as Record<FamilyName, string>
    );
    setEditImage(null);
    setEditImagePreview(bill.imageUrl ?? null);
    if (editFileInputRef.current) {
      editFileInputRef.current.value = '';
    }
  }, [editImagePreview]);

  const closeEditModal = useCallback(() => {
    if (editImagePreview && editImagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(editImagePreview);
    }
    setEditingBill(null);
    setEditAmount('');
    setEditSplits({ Bacarisas: '', Ocanada: '', Patino: '' });
    setEditImage(null);
    setEditImagePreview(null);
    if (editFileInputRef.current) {
      editFileInputRef.current.value = '';
    }
  }, [editImagePreview]);

  const handleEditImageSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }
    if (editImagePreview && editImagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(editImagePreview);
    }
    setEditImage(file);
    setEditImagePreview(URL.createObjectURL(file));
  }, [editImagePreview]);

  const handleSaveEdit = useCallback(async () => {
    if (!editingBill) return;
    const amount = parseFloat(editAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    const splitTotal = FAMILY_NAMES.reduce((sum, family) => sum + (parseFloat(editSplits[family]) || 0), 0);
    const diff = Math.abs(splitTotal - amount);
    if (diff > 0.02) {
      toast.error(`Split amounts don't add up to total (off by ${formatCurrency(diff)})`);
      return;
    }

    setEditSubmitting(true);
    try {
      let nextImageUrl = editingBill.imageUrl;
      if (editImage) {
        nextImageUrl = await uploadBillImage(editImage, editingBill.month, editingBill.utility);
        if (editingBill.imageUrl && editingBill.imageUrl !== nextImageUrl) {
          await deleteBillImage(editingBill.imageUrl);
        }
      }

      const nextSplits: BillSplit[] = editingBill.splits.map((split) => ({
        ...split,
        amount: parseFloat(editSplits[split.family]) || 0,
      }));

      await updateBill(editingBill.id, {
        totalAmount: amount,
        splits: nextSplits,
        imageUrl: nextImageUrl,
      });

      toast.success(`${editingBill.utility} bill updated`);
      closeEditModal();
      await refresh();
    } catch (error) {
      console.error('Failed to update bill:', error);
      toast.error('Failed to update bill');
    } finally {
      setEditSubmitting(false);
    }
  }, [editingBill, editAmount, editImage, editSplits, closeEditModal, refresh]);

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
    <div className="space-y-4 fade-slide-in">
      <MonthPicker value={month} onChange={setMonth} />
      {error && <ErrorPanel message={error} onRetry={() => void refresh()} />}

      {previousMonthBills.length > 0 && (
        <button
          onClick={handleCopyPreviousMonth}
          className="w-full py-2.5 rounded-2xl glass-panel text-sm text-slate-300 hover:border-primary-500 hover:text-primary-300 transition-colors hover-lift interactive-press"
        >
          Copy missing utility from previous month
        </button>
      )}

      {/* Add Bill Button */}
      {availableUtilities.length > 0 && !showForm && (
        <button
          onClick={() => {
            setFormUtility(availableUtilities[0].type);
            setShowForm(true);
          }}
          className="w-full py-3 rounded-2xl glass-panel border-2 border-dashed border-slate-600 text-slate-400 hover:border-primary-500 hover:text-primary-400 transition-colors flex items-center justify-center gap-2 hover-lift interactive-press"
        >
          <Plus className="w-5 h-5" />
          Add Bill for This Month
        </button>
      )}

      {/* Bill Entry Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="glass-panel gradient-outline rounded-2xl p-4 space-y-4 fade-slide-in">
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
                      ? 'animated-gradient-btn text-white shadow-[0_0_22px_rgba(59,130,246,0.35)]'
                      : 'bg-slate-700/80 text-slate-300 hover:bg-slate-600'
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
                  className="w-full h-40 object-cover rounded-xl border border-slate-600"
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
                className="w-full py-4 rounded-xl border border-dashed border-slate-600 text-slate-400 hover:border-primary-500 hover:text-primary-400 transition-colors flex flex-col items-center gap-1 interactive-press"
              >
                <Camera className="w-5 h-5" />
                <span className="text-xs">Take photo or upload</span>
              </button>
            )}
          </div>

          {/* Adjustable Split */}
          {formAmount && parseFloat(formAmount) > 0 && (
            <div className="bg-slate-900/50 rounded-xl p-3 border border-slate-700/60">
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
            className="w-full py-3 animated-gradient-btn disabled:bg-slate-600 rounded-xl font-medium transition-all hover-lift"
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
        <div className="space-y-3 stagger-list">
          {monthBills.map((bill) => (
            <BillCard
              key={bill.id}
              bill={bill}
              onTogglePaid={handleTogglePaid}
              onDelete={queueDelete}
              onTogglePaidToProvider={handleTogglePaidToProvider}
              onEdit={openEditBill}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingDeleteId)}
        title="Delete bill?"
        description="This bill will be deleted after 5 seconds unless you use Undo from the toast."
        confirmLabel="Delete"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDeleteId(null)}
      />

      {editingBill && (
        <div
          className="fixed inset-0 z-[130] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={closeEditModal}
          role="presentation"
        >
          <div
            className="w-full max-w-md glass-heavy rounded-2xl p-4 space-y-4 fade-slide-in"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Edit {editingBill.utility} Bill</h3>
              <button onClick={closeEditModal} className="text-slate-400 hover:text-white interactive-press" aria-label="Close edit bill">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-2">Total Amount (₱)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={editAmount}
                onChange={(event) => setEditAmount(event.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary-500"
              />
            </div>

            <div className="bg-slate-900/45 border border-slate-700/60 rounded-xl p-3">
              <p className="text-xs text-slate-400 mb-2">Edit split amounts</p>
              <div className="space-y-2">
                {FAMILY_NAMES.map((family) => (
                  <div key={family} className="flex items-center justify-between gap-3">
                    <span className="text-sm min-w-[80px]">{family}</span>
                    <div className="relative flex-1 max-w-[140px]">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">₱</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editSplits[family]}
                        onChange={(event) => setEditSplits((prev) => ({ ...prev, [family]: event.target.value }))}
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg pl-7 pr-3 py-1.5 text-sm text-right font-medium focus:outline-none focus:border-primary-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-2">Reupload Bill Photo (optional)</label>
              <input
                ref={editFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleEditImageSelect}
                className="hidden"
              />
              {editImagePreview ? (
                <div className="relative">
                  <img src={editImagePreview} alt="Bill preview" className="w-full h-36 object-cover rounded-xl border border-slate-600" />
                  <button
                    type="button"
                    onClick={() => editFileInputRef.current?.click()}
                    className="absolute bottom-2 right-2 px-2.5 py-1.5 rounded-lg bg-slate-900/90 text-xs text-slate-200 hover:bg-slate-800"
                  >
                    Replace
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => editFileInputRef.current?.click()}
                  className="w-full py-3 rounded-xl border border-dashed border-slate-600 text-slate-400 hover:border-primary-500 hover:text-primary-300 transition-colors"
                >
                  Upload bill image
                </button>
              )}
            </div>

            <button
              onClick={() => void handleSaveEdit()}
              disabled={editSubmitting}
              className="w-full py-2.5 rounded-xl animated-gradient-btn font-medium disabled:bg-slate-600"
            >
              {editSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
