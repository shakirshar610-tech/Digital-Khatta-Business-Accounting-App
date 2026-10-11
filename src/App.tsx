/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  BookOpen,
  Package,
  FileText,
  Receipt,
  Users,
  Cloud,
  CloudOff,
  Database,
  Globe,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  AlertTriangle,
} from 'lucide-react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  signInWithGooglePopup,
  signOutUser,
} from './lib/firebase';
import {
  AttendanceRecord,
  AttendanceState,
  BackupPayload,
  CurrencyCode,
  EntryType,
  Expense,
  InventoryItem,
  Invoice,
  InvoiceLineItem,
  KhataEntry,
  Language,
  NavSection,
  Party,
  paymentMethod,
  PaymentMethod,
  PayrollRecord,
  StaffMember,
  SyncCollectionName,
  SyncQueueItem,
  UserProfile,
} from './types';
import { translations } from './i18n/translations';
import { generateSampleData } from './lib/sampleData';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { PWAInstallButton } from './components/PWAInstallButton';
import { KhataModule } from './components/KhataModule';
import { InventoryModule } from './components/InventoryModule';
import { InvoicesModule } from './components/InvoicesModule';
import { ExpensesModule } from './components/ExpensesModule';
import { StaffPayrollModule } from './components/StaffPayrollModule';
import { BackupSyncModal } from './components/BackupSyncModal';

const STORAGE_KEYS = {
  PROFILE: 'kkp_profile_v1',
  PARTIES: 'kkp_parties_v1',
  KHATA: 'kkp_khata_v1',
  INVENTORY: 'kkp_inventory_v1',
  INVOICES: 'kkp_invoices_v1',
  EXPENSES: 'kkp_expenses_v1',
  STAFF: 'kkp_staff_v1',
  ATTENDANCE: 'kkp_attendance_v1',
  PAYROLL: 'kkp_payroll_v1',
  SYNC_QUEUE: 'kkp_sync_queue_v1',
  LAST_SYNC: 'kkp_last_sync_v1',
};

function loadLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveLocal<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('Local storage quota warning:', e);
  }
}

function makeValidId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 9);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

export default function App() {
  const isOnline = useOnlineStatus();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const defaultOwnerId = currentUser?.uid || 'local_owner_01';

  // Initialize state from localStorage (or sample data on very first launch)
  const initialSample = useMemo(() => generateSampleData('local_owner_01'), []);

  const [profile, setProfile] = useState<UserProfile>(() =>
    loadLocal<UserProfile>(STORAGE_KEYS.PROFILE, {
      ownerId: 'local_owner_01',
      businessName: 'Al-Barakah Wholesale & Traders',
      businessCategory: 'Wholesale Kiryana & General Merchants',
      currency: 'PKR',
      language: 'en',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  );

  const [parties, setParties] = useState<Party[]>(() =>
    loadLocal<Party[]>(STORAGE_KEYS.PARTIES, initialSample.parties)
  );
  const [khataEntries, setKhataEntries] = useState<KhataEntry[]>(() =>
    loadLocal<KhataEntry[]>(STORAGE_KEYS.KHATA, initialSample.khataEntries)
  );
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>(() =>
    loadLocal<InventoryItem[]>(STORAGE_KEYS.INVENTORY, initialSample.inventoryItems)
  );
  const [invoices, setInvoices] = useState<Invoice[]>(() =>
    loadLocal<Invoice[]>(STORAGE_KEYS.INVOICES, initialSample.invoices)
  );
  const [expenses, setExpenses] = useState<Expense[]>(() =>
    loadLocal<Expense[]>(STORAGE_KEYS.EXPENSES, initialSample.expenses)
  );
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>(() =>
    loadLocal<StaffMember[]>(STORAGE_KEYS.STAFF, initialSample.staffMembers)
  );
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() =>
    loadLocal<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, initialSample.attendanceRecords)
  );
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>(() =>
    loadLocal<PayrollRecord[]>(STORAGE_KEYS.PAYROLL, initialSample.payrollRecords)
  );

  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>(() =>
    loadLocal<SyncQueueItem[]>(STORAGE_KEYS.SYNC_QUEUE, [])
  );
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(() =>
    loadLocal<string | null>(STORAGE_KEYS.LAST_SYNC, null)
  );
  const [isSyncing, setIsSyncing] = useState(false);

  const [activeNav, setActiveNav] = useState<NavSection>('dashboard');
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [triggerNewInvoice, setTriggerNewInvoice] = useState(0);

  const lang = profile.language;
  const currency = profile.currency;
  const t = translations[lang];

  // Persist to localStorage automatically for instant offline availability
  useEffect(() => saveLocal(STORAGE_KEYS.PROFILE, profile), [profile]);
  useEffect(() => saveLocal(STORAGE_KEYS.PARTIES, parties), [parties]);
  useEffect(() => saveLocal(STORAGE_KEYS.KHATA, khataEntries), [khataEntries]);
  useEffect(() => saveLocal(STORAGE_KEYS.INVENTORY, inventoryItems), [inventoryItems]);
  useEffect(() => saveLocal(STORAGE_KEYS.INVOICES, invoices), [invoices]);
  useEffect(() => saveLocal(STORAGE_KEYS.EXPENSES, expenses), [expenses]);
  useEffect(() => saveLocal(STORAGE_KEYS.STAFF, staffMembers), [staffMembers]);
  useEffect(() => saveLocal(STORAGE_KEYS.ATTENDANCE, attendanceRecords), [attendanceRecords]);
  useEffect(() => saveLocal(STORAGE_KEYS.PAYROLL, payrollRecords), [payrollRecords]);
  useEffect(() => saveLocal(STORAGE_KEYS.SYNC_QUEUE, syncQueue), [syncQueue]);
  useEffect(() => saveLocal(STORAGE_KEYS.LAST_SYNC, lastSyncedAt), [lastSyncedAt]);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Attach real-time Firestore listeners when authenticated
  useEffect(() => {
    if (!authReady || !currentUser || !currentUser.emailVerified) return;
    const uid = currentUser.uid;

    const unsubParties = onSnapshot(
      query(collection(db, 'parties'), where('ownerId', '==', uid)),
      (snap) => {
        if (!snap.empty) {
          const docs = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Party, 'id'>),
          }));
          setParties(docs);
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'parties')
    );

    const unsubKhata = onSnapshot(
      query(collection(db, 'khata_entries'), where('ownerId', '==', uid)),
      (snap) => {
        if (!snap.empty) {
          const docs = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<KhataEntry, 'id'>),
          }));
          setKhataEntries(docs);
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'khata_entries')
    );

    const unsubInventory = onSnapshot(
      query(collection(db, 'inventory_items'), where('ownerId', '==', uid)),
      (snap) => {
        if (!snap.empty) {
          const docs = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<InventoryItem, 'id'>),
          }));
          setInventoryItems(docs);
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'inventory_items')
    );

    const unsubInvoices = onSnapshot(
      query(collection(db, 'invoices'), where('ownerId', '==', uid)),
      (snap) => {
        if (!snap.empty) {
          const docs = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Invoice, 'id'>),
          }));
          setInvoices(docs);
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'invoices')
    );

    const unsubExpenses = onSnapshot(
      query(collection(db, 'expenses'), where('ownerId', '==', uid)),
      (snap) => {
        if (!snap.empty) {
          const docs = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Expense, 'id'>),
          }));
          setExpenses(docs);
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'expenses')
    );

    const unsubStaff = onSnapshot(
      query(collection(db, 'staff_members'), where('ownerId', '==', uid)),
      (snap) => {
        if (!snap.empty) {
          const docs = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<StaffMember, 'id'>),
          }));
          setStaffMembers(docs);
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'staff_members')
    );

    const unsubAttendance = onSnapshot(
      query(collection(db, 'attendance_records'), where('ownerId', '==', uid)),
      (snap) => {
        if (!snap.empty) {
          const docs = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<AttendanceRecord, 'id'>),
          }));
          setAttendanceRecords(docs);
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'attendance_records')
    );

    const unsubPayroll = onSnapshot(
      query(collection(db, 'payroll_records'), where('ownerId', '==', uid)),
      (snap) => {
        if (!snap.empty) {
          const docs = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<PayrollRecord, 'id'>),
          }));
          setPayrollRecords(docs);
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'payroll_records')
    );

    return () => {
      unsubParties();
      unsubKhata();
      unsubInventory();
      unsubInvoices();
      unsubExpenses();
      unsubStaff();
      unsubAttendance();
      unsubPayroll();
    };
  }, [authReady, currentUser]);

  // Helper to push a mutation to Firestore or queue it when offline
  const syncMutation = useCallback(
    async (
      colName: SyncCollectionName,
      docId: string,
      action: 'create' | 'update' | 'delete',
      payload?: Record<string, unknown>
    ) => {
      if (!currentUser || !currentUser.emailVerified || !isOnline) {
        setSyncQueue((prev) => [
          ...prev.filter((q) => !(q.collection === colName && q.docId === docId && q.action === action)),
          {
            id: makeValidId('sq'),
            collection: colName,
            docId,
            action,
            payload,
            timestamp: new Date().toISOString(),
          },
        ]);
        return;
      }

      const path = `${colName}/${docId}`;
      try {
        if (action === 'delete') {
          await deleteDoc(doc(db, colName, docId));
        } else if (action === 'create' && payload) {
          await setDoc(doc(db, colName, docId), {
            ...payload,
            ownerId: currentUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else if (action === 'update' && payload) {
          await updateDoc(doc(db, colName, docId), {
            ...payload,
            updatedAt: serverTimestamp(),
          });
        }
        setLastSyncedAt(new Date().toISOString());
      } catch (err) {
        handleFirestoreError(
          err,
          action === 'delete'
            ? OperationType.DELETE
            : action === 'create'
            ? OperationType.CREATE
            : OperationType.UPDATE,
          path
        );
      }
    },
    [currentUser, isOnline]
  );

  // Flush offline syncQueue automatically when internet connection & auth are available
  const flushSyncQueue = useCallback(async () => {
    if (!isOnline || !currentUser || !currentUser.emailVerified || syncQueue.length === 0) return;
    setIsSyncing(true);
    try {
      const remaining: SyncQueueItem[] = [];
      for (const item of syncQueue) {
        try {
          if (item.action === 'delete') {
            await deleteDoc(doc(db, item.collection, item.docId));
          } else if (item.action === 'create' && item.payload) {
            await setDoc(doc(db, item.collection, item.docId), {
              ...item.payload,
              ownerId: currentUser.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } else if (item.action === 'update' && item.payload) {
            await updateDoc(doc(db, item.collection, item.docId), {
              ...item.payload,
              updatedAt: serverTimestamp(),
            });
          }
        } catch {
          remaining.push(item);
        }
      }
      setSyncQueue(remaining);
      setLastSyncedAt(new Date().toISOString());
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, currentUser, syncQueue]);

  useEffect(() => {
    if (isOnline && currentUser && syncQueue.length > 0) {
      flushSyncQueue();
    }
  }, [isOnline, currentUser, syncQueue.length, flushSyncQueue]);

  // =========================================================================
  // Business Logic Handlers
  // =========================================================================

  const toggleLanguage = () => {
    setProfile((prev) => ({
      ...prev,
      language: prev.language === 'en' ? 'ur' : 'en',
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleSaveParty = async (
    data: Omit<Party, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) => {
    const now = new Date().toISOString();
    if (existingId) {
      setParties((prev) =>
        prev.map((p) => (p.id === existingId ? { ...p, ...data, updatedAt: now } : p))
      );
      await syncMutation('parties', existingId, 'update', {
        name: data.name,
        phone: data.phone,
        address: data.address,
        partyType: data.partyType,
        balance: data.balance,
        totalDebit: data.totalDebit,
        totalCredit: data.totalCredit,
        notes: data.notes,
      });
    } else {
      const id = makeValidId('party');
      const newParty: Party = {
        id,
        ownerId: defaultOwnerId,
        ...data,
        createdAt: now,
        updatedAt: now,
      };
      setParties((prev) => [newParty, ...prev]);
      await syncMutation('parties', id, 'create', {
        name: data.name,
        phone: data.phone,
        address: data.address,
        partyType: data.partyType,
        balance: data.balance,
        totalDebit: data.totalDebit,
        totalCredit: data.totalCredit,
        notes: data.notes,
      });
    }
  };

  const handleDeleteParty = async (partyId: string) => {
    setParties((prev) => prev.filter((p) => p.id !== partyId));
    setKhataEntries((prev) => prev.filter((e) => e.partyId !== partyId));
    await syncMutation('parties', partyId, 'delete');
  };

  const handleAddKhataEntry = async (entryData: {
    partyId: string;
    partyName: string;
    entryType: EntryType;
    amount: number;
    paymentMethod: PaymentMethod;
    referenceNo: string;
    description: string;
    entryDate: string;
  }) => {
    const now = new Date().toISOString();
    const id = makeValidId('khata');
    const newEntry: KhataEntry = {
      id,
      ownerId: defaultOwnerId,
      ...entryData,
      createdAt: now,
      updatedAt: now,
    };
    setKhataEntries((prev) => [newEntry, ...prev]);

    // Update linked party balance
    const targetParty = parties.find((p) => p.id === entryData.partyId);
    if (targetParty) {
      const delta = entryData.entryType === 'debit' ? entryData.amount : -entryData.amount;
      const nextBalance = targetParty.balance + delta;
      const nextDebit =
        entryData.entryType === 'debit'
          ? targetParty.totalDebit + entryData.amount
          : targetParty.totalDebit;
      const nextCredit =
        entryData.entryType === 'credit'
          ? targetParty.totalCredit + entryData.amount
          : targetParty.totalCredit;

      setParties((prev) =>
        prev.map((p) =>
          p.id === targetParty.id
            ? {
                ...p,
                balance: nextBalance,
                totalDebit: nextDebit,
                totalCredit: nextCredit,
                updatedAt: now,
              }
            : p
        )
      );

      await syncMutation('parties', targetParty.id, 'update', {
        balance: nextBalance,
        totalDebit: nextDebit,
        totalCredit: nextCredit,
      });
    }

    await syncMutation('khata_entries', id, 'create', entryData);
  };

  const handleDeleteKhataEntry = async (entry: KhataEntry) => {
    const now = new Date().toISOString();
    setKhataEntries((prev) => prev.filter((e) => e.id !== entry.id));

    const targetParty = parties.find((p) => p.id === entry.partyId);
    if (targetParty) {
      const reverseDelta = entry.entryType === 'debit' ? -entry.amount : entry.amount;
      const nextBalance = targetParty.balance + reverseDelta;
      const nextDebit =
        entry.entryType === 'debit'
          ? Math.max(0, targetParty.totalDebit - entry.amount)
          : targetParty.totalDebit;
      const nextCredit =
        entry.entryType === 'credit'
          ? Math.max(0, targetParty.totalCredit - entry.amount)
          : targetParty.totalCredit;

      setParties((prev) =>
        prev.map((p) =>
          p.id === targetParty.id
            ? {
                ...p,
                balance: nextBalance,
                totalDebit: nextDebit,
                totalCredit: nextCredit,
                updatedAt: now,
              }
            : p
        )
      );

      await syncMutation('parties', targetParty.id, 'update', {
        balance: nextBalance,
        totalDebit: nextDebit,
        totalCredit: nextCredit,
      });
    }

    await syncMutation('khata_entries', entry.id, 'delete');
  };

  // Inventory Handlers
  const handleSaveInventoryItem = async (
    itemData: Omit<InventoryItem, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) => {
    const now = new Date().toISOString();
    if (existingId) {
      setInventoryItems((prev) =>
        prev.map((item) => (item.id === existingId ? { ...item, ...itemData, updatedAt: now } : item))
      );
      await syncMutation('inventory_items', existingId, 'update', itemData);
    } else {
      const id = makeValidId('item');
      const newItem: InventoryItem = {
        id,
        ownerId: defaultOwnerId,
        ...itemData,
        createdAt: now,
        updatedAt: now,
      };
      setInventoryItems((prev) => [newItem, ...prev]);
      await syncMutation('inventory_items', id, 'create', itemData);
    }
  };

  const handleAdjustStock = async (itemId: string, newQuantity: number) => {
    const now = new Date().toISOString();
    setInventoryItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, stockQuantity: newQuantity, updatedAt: now } : item
      )
    );
    await syncMutation('inventory_items', itemId, 'update', {
      stockQuantity: newQuantity,
    });
  };

  const handleDeleteInventoryItem = async (itemId: string) => {
    setInventoryItems((prev) => prev.filter((i) => i.id !== itemId));
    await syncMutation('inventory_items', itemId, 'delete');
  };

  // Invoice & Bill Handlers
  const handleCreateInvoice = async (
    invData: Omit<Invoice, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>,
    lineItems: InvoiceLineItem[]
  ) => {
    const now = new Date().toISOString();
    const id = makeValidId('inv');
    const newInvoice: Invoice = {
      id,
      ownerId: defaultOwnerId,
      ...invData,
      createdAt: now,
      updatedAt: now,
    };
    setInvoices((prev) => [newInvoice, ...prev]);
    await syncMutation('invoices', id, 'create', invData);

    // Automatically adjust inventory stock quantities
    for (const line of lineItems) {
      const invItem = inventoryItems.find((i) => i.id === line.itemId);
      if (invItem) {
        const nextQty =
          invData.invoiceType === 'sale'
            ? Math.max(0, invItem.stockQuantity - line.quantity)
            : Math.min(10000000, invItem.stockQuantity + line.quantity);
        await handleAdjustStock(invItem.id, nextQty);
      }
    }

    // Automatically record unpaid balanceDue in Customer/Supplier Khata ledger
    if (invData.balanceDue > 0 && invData.partyId !== 'walkin_customer') {
      const targetParty = parties.find((p) => p.id === invData.partyId);
      if (targetParty) {
        const entryType: EntryType = invData.invoiceType === 'sale' ? 'debit' : 'credit';
        await handleAddKhataEntry({
          partyId: targetParty.id,
          partyName: targetParty.name,
          entryType,
          amount: invData.balanceDue,
          paymentMethod: 'credit',
          referenceNo: invData.invoiceNumber,
          description: `${invData.invoiceType === 'sale' ? 'Sale Invoice' : 'Purchase Bill'} balance`,
          entryDate: invData.invoiceDate,
        });
      }
    }
  };

  const handleRecordInvoicePayment = async (invoice: Invoice, additionalPayment: number) => {
    const now = new Date().toISOString();
    const nextPaid = Math.min(invoice.totalAmount, invoice.paidAmount + additionalPayment);
    const nextDue = Math.max(0, invoice.totalAmount - nextPaid);
    const nextStatus = nextDue === 0 ? 'paid' : 'issued';

    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === invoice.id
          ? {
              ...inv,
              paidAmount: nextPaid,
              balanceDue: nextDue,
              invoiceStatus: nextStatus,
              updatedAt: now,
            }
          : inv
      )
    );

    await syncMutation('invoices', invoice.id, 'update', {
      paidAmount: nextPaid,
      balanceDue: nextDue,
      invoiceStatus: nextStatus,
      paymentMethod: invoice.paymentMethod,
    });

    if (invoice.partyId !== 'walkin_customer') {
      const targetParty = parties.find((p) => p.id === invoice.partyId);
      if (targetParty) {
        const entryType: EntryType = invoice.invoiceType === 'sale' ? 'credit' : 'debit';
        await handleAddKhataEntry({
          partyId: targetParty.id,
          partyName: targetParty.name,
          entryType,
          amount: additionalPayment,
          paymentMethod: 'cash',
          referenceNo: invoice.invoiceNumber,
          description: `Settlement against ${invoice.invoiceNumber}`,
          entryDate: now.slice(0, 10),
        });
      }
    }
  };

  const handleCancelInvoice = async (invoice: Invoice) => {
    const now = new Date().toISOString();
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === invoice.id ? { ...inv, invoiceStatus: 'cancelled', updatedAt: now } : inv
      )
    );
    await syncMutation('invoices', invoice.id, 'update', {
      invoiceStatus: 'cancelled',
    });
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    setInvoices((prev) => prev.filter((inv) => inv.id !== invoiceId));
    await syncMutation('invoices', invoiceId, 'delete');
  };

  // Expense Handlers
  const handleSaveExpense = async (
    expData: Omit<Expense, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) => {
    const now = new Date().toISOString();
    if (existingId) {
      setExpenses((prev) =>
        prev.map((e) => (e.id === existingId ? { ...e, ...expData, updatedAt: now } : e))
      );
      await syncMutation('expenses', existingId, 'update', expData);
    } else {
      const id = makeValidId('exp');
      const newExp: Expense = {
        id,
        ownerId: defaultOwnerId,
        ...expData,
        createdAt: now,
        updatedAt: now,
      };
      setExpenses((prev) => [newExp, ...prev]);
      await syncMutation('expenses', id, 'create', expData);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
    await syncMutation('expenses', expenseId, 'delete');
  };

  // Staff & Payroll Handlers
  const handleSaveStaff = async (
    staffData: Omit<StaffMember, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) => {
    const now = new Date().toISOString();
    if (existingId) {
      setStaffMembers((prev) =>
        prev.map((s) => (s.id === existingId ? { ...s, ...staffData, updatedAt: now } : s))
      );
      await syncMutation('staff_members', existingId, 'update', staffData);
    } else {
      const id = makeValidId('staff');
      const newStaff: StaffMember = {
        id,
        ownerId: defaultOwnerId,
        ...staffData,
        createdAt: now,
        updatedAt: now,
      };
      setStaffMembers((prev) => [newStaff, ...prev]);
      await syncMutation('staff_members', id, 'create', staffData);
    }
  };

  const handleDeleteStaff = async (staffId: string) => {
    setStaffMembers((prev) => prev.filter((s) => s.id !== staffId));
    await syncMutation('staff_members', staffId, 'delete');
  };

  const handleMarkAttendance = async (
    staff: StaffMember,
    date: string,
    state: AttendanceState,
    overtimeHours: number,
    notes: string
  ) => {
    const now = new Date().toISOString();
    const recordId = `att_${staff.id}_${date}`.replace(/[^a-zA-Z0-9_-]/g, '');
    const existing = attendanceRecords.find((r) => r.id === recordId);

    if (existing) {
      setAttendanceRecords((prev) =>
        prev.map((r) =>
          r.id === recordId
            ? { ...r, attendanceState: state, overtimeHours, notes, updatedAt: now }
            : r
        )
      );
      await syncMutation('attendance_records', recordId, 'update', {
        attendanceState: state,
        overtimeHours,
        notes,
      });
    } else {
      const newRec: AttendanceRecord = {
        id: recordId,
        ownerId: defaultOwnerId,
        staffId: staff.id,
        staffName: staff.name,
        attendanceDate: date,
        attendanceState: state,
        overtimeHours,
        notes,
        createdAt: now,
        updatedAt: now,
      };
      setAttendanceRecords((prev) => [newRec, ...prev]);
      await syncMutation('attendance_records', recordId, 'create', {
        staffId: staff.id,
        staffName: staff.name,
        attendanceDate: date,
        attendanceState: state,
        overtimeHours,
        notes,
      });
    }
  };

  const handleDisbursePayroll = async (
    payrollData: Omit<PayrollRecord, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>,
    deductFromAdvance: number
  ) => {
    const now = new Date().toISOString();
    const id = makeValidId('pay');
    const newPayroll: PayrollRecord = {
      id,
      ownerId: defaultOwnerId,
      ...payrollData,
      createdAt: now,
      updatedAt: now,
    };
    setPayrollRecords((prev) => [newPayroll, ...prev]);
    await syncMutation('payroll_records', id, 'create', payrollData);

    // Reduce staff advanceBalance if advance was deducted
    if (deductFromAdvance > 0) {
      const staff = staffMembers.find((s) => s.id === payrollData.staffId);
      if (staff) {
        const nextAdvance = Math.max(0, staff.advanceBalance - deductFromAdvance);
        setStaffMembers((prev) =>
          prev.map((s) =>
            s.id === staff.id ? { ...s, advanceBalance: nextAdvance, updatedAt: now } : s
          )
        );
        await syncMutation('staff_members', staff.id, 'update', {
          advanceBalance: nextAdvance,
          monthlySalary: staff.monthlySalary,
        });
      }
    }

    // Automatically log salary disbursement in Expenses
    if (payrollData.netPaid > 0) {
      await handleSaveExpense({
        title: `Salary Paid: ${payrollData.staffName} (${payrollData.monthYear})`,
        category: 'payroll',
        amount: payrollData.netPaid,
        paymentMethod: payrollData.paymentMethod,
        referenceNo: id.slice(0, 16),
        notes: 'Automated payroll disbursement entry',
        expenseDate: payrollData.paymentDate,
      });
    }
  };

  const handleLoadSampleData = () => {
    const sample = generateSampleData(defaultOwnerId);
    setParties(sample.parties);
    setKhataEntries(sample.khataEntries);
    setInventoryItems(sample.inventoryItems);
    setInvoices(sample.invoices);
    setExpenses(sample.expenses);
    setStaffMembers(sample.staffMembers);
    setAttendanceRecords(sample.attendanceRecords);
    setPayrollRecords(sample.payrollRecords);
  };

  const handleRestoreBackup = async (payload: BackupPayload) => {
    if (payload.businessProfile) setProfile(payload.businessProfile);
    setParties(payload.parties);
    setKhataEntries(payload.khataEntries || []);
    setInventoryItems(payload.inventoryItems);
    setInvoices(payload.invoices || []);
    setExpenses(payload.expenses || []);
    setStaffMembers(payload.staffMembers || []);
    setAttendanceRecords(payload.attendanceRecords || []);
    setPayrollRecords(payload.payrollRecords || []);
  };

  // Overview Dashboard Computed Metrics
  const dashboardStats = useMemo(() => {
    let receivable = 0;
    let payable = 0;
    for (const p of parties) {
      if (p.balance > 0) receivable += p.balance;
      if (p.balance < 0) payable += Math.abs(p.balance);
    }
    const stockCost = inventoryItems.reduce(
      (sum, item) => sum + item.purchasePrice * item.stockQuantity,
      0
    );
    const lowStock = inventoryItems.filter((i) => i.stockQuantity <= i.lowStockThreshold);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    return {
      receivable,
      payable,
      stockCost,
      lowStock,
      totalExpenses,
    };
  }, [parties, inventoryItems, expenses]);

  const formatMoney = (val: number) =>
    `${currency} ${Math.abs(val).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  return (
    <div
      dir={lang === 'ur' ? 'rtl' : 'ltr'}
      className={`min-h-screen bg-slate-50 text-slate-900 flex flex-col ${
        lang === 'ur' ? 'font-urdu-aware' : ''
      }`}
    >
      {/* Top Bar Contract: 3 Zones separated by gap-8 (Wordmark — 5 concise nav links — 1 primary action) */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between gap-8 no-print">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#overview"
          onClick={(e) => {
            e.preventDefault();
            setActiveNav('dashboard');
          }}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          {t.appName}
        </a>

        {/* Zone 2: 5 concise single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          {(
            [
              { id: 'dashboard', label: t.navDashboard },
              { id: 'khata', label: t.navKhata },
              { id: 'inventory', label: t.navInventory },
              { id: 'invoices', label: t.navInvoices },
              { id: 'staff', label: t.navStaff },
            ] as const
          ).map((link) => (
            <a
              key={link.id}
              href={`#${link.id}`}
              onClick={(e) => {
                e.preventDefault();
                setActiveNav(link.id);
              }}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeNav === link.id
                  ? 'border-slate-900 text-slate-900 font-semibold'
                  : 'border-transparent hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            onClick={() => {
              setActiveNav('invoices');
              setTriggerNewInvoice((c) => c + 1);
            }}
            className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {t.primaryNewInvoice}
          </button>
        </div>
      </header>

      {/* Main Workspace Layout (Sidebar + Content Viewport) */}
      <div className="flex-1 flex">
        {/* Desktop Sidebar Navigation (260px) */}
        <aside className="hidden lg:flex w-64 shrink-0 bg-white border-x border-slate-200 flex-col justify-between p-4 no-print">
          <div className="space-y-1">
            <div className="px-3 py-2 mb-2">
              <div className="text-xs font-bold text-slate-900 truncate">
                {profile.businessName}
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                {profile.businessCategory} · {profile.currency}
              </div>
            </div>

            {(
              [
                { id: 'dashboard', label: t.navDashboard, icon: LayoutDashboard },
                { id: 'khata', label: t.navKhata, icon: BookOpen },
                { id: 'inventory', label: t.navInventory, icon: Package },
                { id: 'invoices', label: t.navInvoices, icon: FileText },
                { id: 'expenses', label: t.navExpenses, icon: Receipt },
                { id: 'staff', label: t.navStaff, icon: Users },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveNav(item.id)}
                  className={`w-full min-h-[42px] px-3 py-2.5 rounded-lg flex items-center gap-3 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Offline/Cloud Sync Summary Card in Sidebar */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
              {isOnline ? (
                <Cloud className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <CloudOff className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <span className="truncate">
                {isOnline ? t.onlineSyncActive : t.offlineModeActive}
              </span>
            </div>
            <div className="text-[11px] text-slate-500">
              {currentUser
                ? `${t.cloudConnected} (${syncQueue.length} ${t.pendingChanges})`
                : `${t.localMode} · ${syncQueue.length} queued`}
            </div>
            <button
              onClick={() => setShowBackupModal(true)}
              className="w-full min-h-[36px] px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              {t.backupRestore}
            </button>
          </div>
        </aside>

        {/* Main Content Viewport */}
        <main className="flex-1 min-w-0 pb-24 lg:pb-12">
          {/* Workspace Utility Toolbar */}
          <div className="bg-white border-b border-slate-200 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 no-print">
            <div className="flex items-center gap-3 text-xs text-slate-600">
              <button
                onClick={() => setShowBackupModal(true)}
                className="min-h-[36px] inline-flex items-center gap-1.5 font-medium text-slate-700 hover:text-slate-900 cursor-pointer"
              >
                {isOnline ? (
                  <Cloud className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <CloudOff className="w-3.5 h-3.5 text-amber-600" />
                )}
                <span>{isOnline ? t.onlineSyncActive : t.offlineModeActive}</span>
                {syncQueue.length > 0 && (
                  <span className="tabular-nums text-amber-700 font-semibold">
                    ({syncQueue.length} {t.pendingChanges})
                  </span>
                )}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={ toggleLanguage }
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5 text-slate-500" />
                <span>{t.languageLabel}</span>
              </button>

              <button
                onClick={() => setShowBackupModal(true)}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Database className="w-3.5 h-3.5 text-slate-500" />
                <span>{t.backupRestore}</span>
              </button>

              <button
                onClick={handleLoadSampleData}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>{t.loadSampleData}</span>
              </button>

              <PWAInstallButton lang={lang} />
            </div>
          </div>

          {/* Active Module Container */}
          <div className="max-w-7xl mx-auto p-6">
            {activeNav === 'dashboard' && (
              <div className="space-y-6">
                {/* Dashboard Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                      {profile.businessName}
                    </h1>
                    <p className="text-sm text-slate-600 mt-0.5">
                      {profile.businessCategory} · {t.navDashboard}
                    </p>
                  </div>

                  {/* Quick Workflow Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setActiveNav('khata')}
                      className="min-h-[42px] inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t.recordKhataEntry}</span>
                    </button>
                    <button
                      onClick={() => setActiveNav('inventory')}
                      className="min-h-[42px] inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t.addStockItem}</span>
                    </button>
                    <button
                      onClick={() => setActiveNav('expenses')}
                      className="min-h-[42px] inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t.recordExpense}</span>
                    </button>
                  </div>
                </div>

                {/* 4-Column Financial & Inventory KPI Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <button
                    onClick={() => setActiveNav('khata')}
                    className="bg-white border border-slate-200 rounded-xl p-5 text-left hover:border-slate-300 transition-colors cursor-pointer"
                  >
                    <div className="text-xs font-medium text-slate-500">{t.totalReceivable}</div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-2xl font-bold text-emerald-700 tabular-nums">
                        {formatMoney(dashboardStats.receivable)}
                      </span>
                      <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {parties.filter((p) => p.balance > 0).length} accounts receivable
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveNav('khata')}
                    className="bg-white border border-slate-200 rounded-xl p-5 text-left hover:border-slate-300 transition-colors cursor-pointer"
                  >
                    <div className="text-xs font-medium text-slate-500">{t.totalPayable}</div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-2xl font-bold text-red-700 tabular-nums">
                        {formatMoney(dashboardStats.payable)}
                      </span>
                      <ArrowUpRight className="w-4 h-4 text-red-600" />
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {parties.filter((p) => p.balance < 0).length} supplier payables
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveNav('inventory')}
                    className="bg-white border border-slate-200 rounded-xl p-5 text-left hover:border-slate-300 transition-colors cursor-pointer"
                  >
                    <div className="text-xs font-medium text-slate-500">{t.stockValuation}</div>
                    <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
                      {formatMoney(dashboardStats.stockCost)}
                    </div>
                    <div className="mt-1 text-xs text-amber-700 font-medium">
                      {dashboardStats.lowStock.length} {t.lowStockItems}
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveNav('expenses')}
                    className="bg-white border border-slate-200 rounded-xl p-5 text-left hover:border-slate-300 transition-colors cursor-pointer"
                  >
                    <div className="text-xs font-medium text-slate-500">{t.monthlyExpenses}</div>
                    <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
                      {formatMoney(dashboardStats.totalExpenses)}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {staffMembers.filter((s) => s.employmentStatus === 'active').length} active staff
                    </div>
                  </button>
                </div>

                {/* Two-Column Recent Activity & Low Stock Alerts */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                  {/* Recent Khata Ledger Entries */}
                  <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
                    <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                      <h2 className="text-sm font-bold text-slate-900">{t.recentKhataEntries}</h2>
                      <button
                        onClick={() => setActiveNav('khata')}
                        className="text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                      >
                        View All →
                      </button>
                    </div>
                    <div className="overflow-x-auto flex-1">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                            <th className="py-2.5 px-4">{t.date}</th>
                            <th className="py-2.5 px-4">{t.partyName}</th>
                            <th className="py-2.5 px-4 text-right">{t.amount}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {khataEntries.slice(0, 6).map((ent) => (
                            <tr key={ent.id} className="hover:bg-slate-50/80">
                              <td className="py-3 px-4 tabular-nums text-slate-600 whitespace-nowrap">
                                {ent.entryDate}
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-semibold text-slate-900">{ent.partyName}</div>
                                <div className="text-[11px] text-slate-500 truncate max-w-xs">
                                  {ent.description}
                                </div>
                              </td>
                              <td
                                className={`py-3 px-4 text-right font-bold tabular-nums whitespace-nowrap ${
                                  ent.entryType === 'debit' ? 'text-red-700' : 'text-emerald-700'
                                }`}
                              >
                                {ent.entryType === 'debit' ? '-' : '+'}
                                {formatMoney(ent.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Low Stock Alerts & Recent Invoices */}
                  <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
                    <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                      <h2 className="text-sm font-bold text-slate-900">{t.lowStockItems}</h2>
                      <button
                        onClick={() => setActiveNav('inventory')}
                        className="text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                      >
                        Manage Stock →
                      </button>
                    </div>
                    <div className="divide-y divide-slate-100 flex-1">
                      {dashboardStats.lowStock.length === 0 ? (
                        <div className="p-8 text-center text-xs text-slate-500">
                          All inventory items are well stocked above their minimum threshold.
                        </div>
                      ) : (
                        dashboardStats.lowStock.map((item) => (
                          <div
                            key={item.id}
                            className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-900 truncate">
                                {item.name}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                                SKU: {item.sku} · Min Alert: {item.lowStockThreshold} {item.unit}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 tabular-nums">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>
                                  {item.stockQuantity} {item.unit}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeNav === 'khata' && (
              <KhataModule
                lang={lang}
                currency={currency}
                parties={parties}
                khataEntries={khataEntries}
                onSaveParty={handleSaveParty}
                onDeleteParty={handleDeleteParty}
                onAddKhataEntry={handleAddKhataEntry}
                onDeleteKhataEntry={handleDeleteKhataEntry}
              />
            )}

            {activeNav === 'inventory' && (
              <InventoryModule
                lang={lang}
                currency={currency}
                items={inventoryItems}
                onSaveItem={handleSaveInventoryItem}
                onAdjustStock={handleAdjustStock}
                onDeleteItem={handleDeleteInventoryItem}
              />
            )}

            {activeNav === 'invoices' && (
              <InvoicesModule
                lang={lang}
                currency={currency}
                businessName={profile.businessName}
                invoices={invoices}
                parties={parties}
                inventoryItems={inventoryItems}
                triggerNewModal={triggerNewInvoice}
                onCreateInvoice={handleCreateInvoice}
                onRecordInvoicePayment={handleRecordInvoicePayment}
                onCancelInvoice={handleCancelInvoice}
                onDeleteInvoice={handleDeleteInvoice}
              />
            )}

            {activeNav === 'expenses' && (
              <ExpensesModule
                lang={lang}
                currency={currency}
                expenses={expenses}
                onSaveExpense={handleSaveExpense}
                onDeleteExpense={handleDeleteExpense}
              />
            )}

            {activeNav === 'staff' && (
              <StaffPayrollModule
                lang={lang}
                currency={currency}
                businessName={profile.businessName}
                staffMembers={staffMembers}
                attendanceRecords={attendanceRecords}
                payrollRecords={payrollRecords}
                onSaveStaff={handleSaveStaff}
                onDeleteStaff={handleDeleteStaff}
                onMarkAttendance={handleMarkAttendance}
                onDisbursePayroll={handleDisbursePayroll}
              />
            )}
          </div>
        </main>
      </div>

      {/* Mobile Fixed Bottom Navigation Bar (Android Touch Ergonomics: 44x44px hitboxes) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-5 items-center h-16 no-print">
        {(
          [
            { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
            { id: 'khata', label: 'Khata', icon: BookOpen },
            { id: 'inventory', label: 'Stock', icon: Package },
            { id: 'invoices', label: 'Bills', icon: FileText },
            { id: 'staff', label: 'Staff', icon: Users },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeNav === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveNav(tab.id)}
              className={`min-h-[44px] min-w-[44px] flex flex-col items-center justify-center transition-colors cursor-pointer ${
                isActive ? 'text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] tracking-tight mt-1 whitespace-nowrap">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Offline Sync & Backup/Restore Modal */}
      <BackupSyncModal
        isOpen={showBackupModal}
        onClose={() => setShowBackupModal(false)}
        lang={lang}
        isOnline={isOnline}
        userEmail={currentUser?.email || null}
        syncQueue={syncQueue}
        lastSyncedAt={lastSyncedAt}
        isSyncing={isSyncing}
        profile={profile}
        parties={parties}
        khataEntries={khataEntries}
        inventoryItems={inventoryItems}
        invoices={invoices}
        expenses={expenses}
        staffMembers={staffMembers}
        attendanceRecords={attendanceRecords}
        payrollRecords={payrollRecords}
        onSignIn={async () => {
          await signInWithGooglePopup();
        }}
        onSignOut={async () => {
          await signOutUser();
        }}
        onSyncNow={flushSyncQueue}
        onUpdateProfile={async (businessName, businessCategory, nextCurrency: CurrencyCode) => {
          const now = new Date().toISOString();
          setProfile((prev) => ({
            ...prev,
            businessName,
            businessCategory,
            currency: nextCurrency,
            updatedAt: now,
          }));
        }}
        onRestoreBackup={handleRestoreBackup}
      />
    </div>
  );
}
