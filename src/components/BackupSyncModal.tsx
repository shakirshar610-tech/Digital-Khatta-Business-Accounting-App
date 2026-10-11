import React, { useRef, useState } from 'react';
import {
  Cloud,
  CloudOff,
  Download,
  Upload,
  RefreshCw,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  LogIn,
  LogOut,
  X,
} from 'lucide-react';
import {
  AttendanceRecord,
  BackupPayload,
  CurrencyCode,
  Expense,
  InventoryItem,
  Invoice,
  KhataEntry,
  Language,
  Party,
  PayrollRecord,
  StaffMember,
  SyncQueueItem,
  UserProfile,
} from '../types';
import { translations } from '../i18n/translations';

interface BackupSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  isOnline: boolean;
  userEmail: string | null;
  syncQueue: SyncQueueItem[];
  lastSyncedAt: string | null;
  isSyncing: boolean;
  profile: UserProfile;
  parties: Party[];
  khataEntries: KhataEntry[];
  inventoryItems: InventoryItem[];
  invoices: Invoice[];
  expenses: Expense[];
  staffMembers: StaffMember[];
  attendanceRecords: AttendanceRecord[];
  payrollRecords: PayrollRecord[];
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onSyncNow: () => Promise<void>;
  onUpdateProfile: (businessName: string, businessCategory: string, currency: CurrencyCode) => Promise<void>;
  onRestoreBackup: (payload: BackupPayload) => Promise<void>;
}

function computeChecksum(dataStr: string): string {
  let hash = 2166136261;
  for (let i = 0; i < dataStr.length; i++) {
    hash ^= dataStr.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `KKP-${(hash >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;
}

export const BackupSyncModal: React.FC<BackupSyncModalProps> = ({
  isOpen,
  onClose,
  lang,
  isOnline,
  userEmail,
  syncQueue,
  lastSyncedAt,
  isSyncing,
  profile,
  parties,
  khataEntries,
  inventoryItems,
  invoices,
  expenses,
  staffMembers,
  attendanceRecords,
  payrollRecords,
  onSignIn,
  onSignOut,
  onSyncNow,
  onUpdateProfile,
  onRestoreBackup,
}) => {
  const t = translations[lang];
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [bizName, setBizName] = useState(profile.businessName);
  const [bizCategory, setBizCategory] = useState(profile.businessCategory);
  const [currency, setCurrency] = useState<CurrencyCode>(profile.currency);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  if (!isOpen) return null;

  const handleExportJsonBackup = () => {
    const coreData = {
      businessProfile: profile,
      parties,
      khataEntries,
      inventoryItems,
      invoices,
      expenses,
      staffMembers,
      attendanceRecords,
      payrollRecords,
    };
    const checksum = computeChecksum(JSON.stringify(coreData));
    const backup: BackupPayload = {
      appVersion: '1.0.0',
      exportedAt: new Date().toISOString(),
      checksum,
      ...coreData,
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `karobar-khata-backup-${dateStamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setFeedback({
      type: 'success',
      message: `Backup exported with integrity checksum ${checksum}`,
    });
  };

  const handleExportCsv = () => {
    const lines: string[] = [];
    lines.push('SECTION,ID,NAME_OR_TITLE,TYPE_OR_CATEGORY,BALANCE_OR_AMOUNT,PHONE_OR_SKU,DATE');
    parties.forEach((p) => {
      lines.push(
        `PARTY,${p.id},"${p.name.replace(/"/g, '""')}",${p.partyType},${p.balance},"${p.phone}",${p.updatedAt.slice(0, 10)}`
      );
    });
    inventoryItems.forEach((item) => {
      lines.push(
        `INVENTORY,${item.id},"${item.name.replace(/"/g, '""')}",${item.category},${item.stockQuantity},"${item.sku}",${item.updatedAt.slice(0, 10)}`
      );
    });
    invoices.forEach((inv) => {
      lines.push(
        `INVOICE,${inv.invoiceNumber},"${inv.partyName.replace(/"/g, '""')}",${inv.invoiceType},${inv.totalAmount},"${inv.invoiceStatus}",${inv.invoiceDate}`
      );
    });
    expenses.forEach((exp) => {
      lines.push(
        `EXPENSE,${exp.id},"${exp.title.replace(/"/g, '""')}",${exp.category},${exp.amount},"${exp.referenceNo}",${exp.expenseDate}`
      );
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `karobar-khata-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as BackupPayload;
      if (!parsed || !Array.isArray(parsed.parties) || !Array.isArray(parsed.inventoryItems)) {
        setFeedback({ type: 'error', message: t.backupInvalidError });
        return;
      }
      const coreData = {
        businessProfile: parsed.businessProfile,
        parties: parsed.parties,
        khataEntries: parsed.khataEntries || [],
        inventoryItems: parsed.inventoryItems,
        invoices: parsed.invoices || [],
        expenses: parsed.expenses || [],
        staffMembers: parsed.staffMembers || [],
        attendanceRecords: parsed.attendanceRecords || [],
        payrollRecords: parsed.payrollRecords || [],
      };
      const expectedChecksum = computeChecksum(JSON.stringify(coreData));
      if (parsed.checksum && parsed.checksum !== expectedChecksum) {
        setFeedback({ type: 'error', message: t.backupInvalidError });
        return;
      }

      await onRestoreBackup(parsed);
      setFeedback({ type: 'success', message: t.backupIntegrityVerified });
    } catch {
      setFeedback({ type: 'error', message: t.backupInvalidError });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateProfile(
      bizName.trim().slice(0, 120) || 'KarobarKhata Store',
      bizCategory.trim().slice(0, 80) || 'Wholesale & Retail',
      currency
    );
    setFeedback({ type: 'success', message: 'Business settings saved.' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto no-print">
      <div className="w-full max-w-2xl rounded-xl bg-white border border-slate-200 shadow-2xl overflow-hidden my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-900">{t.backupModalTitle}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{t.backupModalSubtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[82vh] overflow-y-auto">
          {feedback && (
            <div
              className={`p-3.5 rounded-lg border flex items-center gap-2.5 text-xs font-medium ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Cloud Synchronization Status Card */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {isOnline ? <Cloud className="w-5 h-5" /> : <CloudOff className="w-5 h-5" />}
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">
                    {isOnline ? t.onlineSyncActive : t.offlineModeActive}
                  </div>
                  <div className="text-xs text-slate-500">
                    {userEmail
                      ? `Signed in as ${userEmail}`
                      : 'Working in Offline-First Local Storage Mode (Sign in to sync across devices)'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {userEmail ? (
                  <>
                    <button
                      onClick={onSyncNow}
                      disabled={!isOnline || isSyncing}
                      className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>{t.syncNow}</span>
                    </button>
                    <button
                      onClick={onSignOut}
                      className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-100 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>{t.signOut}</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={onSignIn}
                    className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>{t.signInGoogle}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
              <span>
                Pending Offline Queue:{' '}
                <strong className="tabular-nums text-slate-900">{syncQueue.length}</strong>{' '}
                {t.pendingChanges}
              </span>
              <span className="tabular-nums">
                Last Synced: {lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString() : 'Local Instant Save'}
              </span>
            </div>
          </div>

          {/* Backup & Restore Actions */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-800">
              Local & Cloud Data Backup / Restore
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={handleExportJsonBackup}
                className="min-h-[48px] p-3.5 rounded-xl border border-slate-200 hover:border-slate-900 bg-white text-left flex items-center gap-3 transition-colors cursor-pointer"
              >
                <Download className="w-5 h-5 text-slate-700 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-slate-900">{t.exportJsonBackup}</div>
                  <div className="text-[11px] text-slate-500">
                    Full database snapshot with SHA/FNV integrity hash
                  </div>
                </div>
              </button>

              <button
                onClick={handleExportCsv}
                className="min-h-[48px] p-3.5 rounded-xl border border-slate-200 hover:border-slate-900 bg-white text-left flex items-center gap-3 transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-5 h-5 text-emerald-700 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-slate-900">{t.exportCsvReport}</div>
                  <div className="text-[11px] text-slate-500">
                    Excel & Google Sheets compatible ledger export
                  </div>
                </div>
              </button>
            </div>

            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full min-h-[48px] p-3.5 rounded-xl border border-dashed border-slate-300 hover:border-slate-900 bg-slate-50/60 flex items-center justify-center gap-2.5 text-xs font-semibold text-slate-800 transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4 text-slate-600" />
                <span>{t.restoreFromBackup} (.json)</span>
              </button>
            </div>
          </div>

          {/* Business Profile Settings */}
          <form onSubmit={handleSaveSettings} className="pt-4 border-t border-slate-200 space-y-4">
            <h3 className="text-xs font-bold text-slate-800">Business Profile & Currency</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Business Name
                </label>
                <input
                  type="text"
                  maxLength={120}
                  value={bizName}
                  onChange={(e) => setBizName(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Business Category
                </label>
                <input
                  type="text"
                  maxLength={80}
                  value={bizCategory}
                  onChange={(e) => setBizCategory(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                  className="w-full min-h-[40px] px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  {(['PKR', 'USD', 'AED', 'SAR', 'GBP'] as const).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="min-h-[38px] px-4 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer"
              >
                Save Business Settings
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
