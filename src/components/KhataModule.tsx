import React, { useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Printer,
  ArrowUpRight,
  ArrowDownLeft,
  Trash2,
  Edit3,
  Phone,
  MapPin,
  FileText,
  X,
} from 'lucide-react';
import {
  Language,
  Party,
  KhataEntry,
  PartyType,
  EntryType,
  PaymentMethod,
} from '../types';
import { translations, paymentMethodLabels } from '../i18n/translations';

interface KhataModuleProps {
  lang: Language;
  currency: string;
  parties: Party[];
  khataEntries: KhataEntry[];
  onSaveParty: (party: Omit<Party, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>, existingId?: string) => Promise<void>;
  onDeleteParty: (partyId: string) => Promise<void>;
  onAddKhataEntry: (entry: {
    partyId: string;
    partyName: string;
    entryType: EntryType;
    amount: number;
    paymentMethod: PaymentMethod;
    referenceNo: string;
    description: string;
    entryDate: string;
  }) => Promise<void>;
  onDeleteKhataEntry: (entry: KhataEntry) => Promise<void>;
}

export const KhataModule: React.FC<KhataModuleProps> = ({
  lang,
  currency,
  parties,
  khataEntries,
  onSaveParty,
  onDeleteParty,
  onAddKhataEntry,
  onDeleteKhataEntry,
}) => {
  const t = translations[lang];
  const pmLabels = paymentMethodLabels[lang];

  const [typeFilter, setTypeFilter] = useState<'all' | PartyType>('all');
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'receivable' | 'payable' | 'settled'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(
    parties[0]?.id || null
  );

  // Modals state
  const [showPartyModal, setShowPartyModal] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [partyForm, setPartyForm] = useState({
    name: '',
    partyType: 'customer' as PartyType,
    phone: '',
    address: '',
    openingBalance: '',
    openingDirection: 'receivable' as 'receivable' | 'payable',
    notes: '',
  });

  const [showEntryModal, setShowEntryModal] = useState(false);
  const [entryForm, setEntryForm] = useState({
    entryType: 'debit' as EntryType,
    amount: '',
    paymentMethod: 'cash' as PaymentMethod,
    referenceNo: '',
    description: '',
    entryDate: new Date().toISOString().slice(0, 10),
  });

  const filteredParties = useMemo(() => {
    return parties.filter((p) => {
      if (typeFilter !== 'all' && p.partyType !== typeFilter) return false;
      if (balanceFilter === 'receivable' && p.balance <= 0) return false;
      if (balanceFilter === 'payable' && p.balance >= 0) return false;
      if (balanceFilter === 'settled' && p.balance !== 0) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.phone.toLowerCase().includes(q) ||
          p.address.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [parties, typeFilter, balanceFilter, searchQuery]);

  const activeParty = useMemo(() => {
    return parties.find((p) => p.id === selectedPartyId) || filteredParties[0] || null;
  }, [parties, selectedPartyId, filteredParties]);

  // Compute chronological ledger entries with running balance for activeParty
  const partyEntriesWithRunningBalance = useMemo(() => {
    if (!activeParty) return [];
    const list = khataEntries
      .filter((e) => e.partyId === activeParty.id)
      .sort((a, b) => a.entryDate.localeCompare(b.entryDate) || a.createdAt.localeCompare(b.createdAt));

    // Calculate initial opening balance before recorded entries
    const sumDelta = list.reduce(
      (acc, item) => acc + (item.entryType === 'debit' ? item.amount : -item.amount),
      0
    );
    let running = activeParty.balance - sumDelta;

    return list
      .map((item) => {
        running += item.entryType === 'debit' ? item.amount : -item.amount;
        return {
          ...item,
          runningBalance: running,
        };
      })
      .reverse();
  }, [activeParty, khataEntries]);

  const totals = useMemo(() => {
    let receivable = 0;
    let payable = 0;
    for (const p of parties) {
      if (p.balance > 0) receivable += p.balance;
      if (p.balance < 0) payable += Math.abs(p.balance);
    }
    return { receivable, payable, net: receivable - payable };
  }, [parties]);

  const openAddParty = () => {
    setEditingParty(null);
    setPartyForm({
      name: '',
      partyType: 'customer',
      phone: '',
      address: '',
      openingBalance: '0',
      openingDirection: 'receivable',
      notes: '',
    });
    setShowPartyModal(true);
  };

  const openEditParty = (party: Party) => {
    setEditingParty(party);
    setPartyForm({
      name: party.name,
      partyType: party.partyType,
      phone: party.phone,
      address: party.address,
      openingBalance: String(Math.abs(party.balance)),
      openingDirection: party.balance >= 0 ? 'receivable' : 'payable',
      notes: party.notes,
    });
    setShowPartyModal(true);
  };

  const handlePartySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = partyForm.name.trim().slice(0, 120);
    if (!cleanName) return;

    const rawBal = Math.max(0, Math.min(1000000000, Number(partyForm.openingBalance) || 0));
    const signedBalance = partyForm.openingDirection === 'receivable' ? rawBal : -rawBal;

    await onSaveParty(
      {
        name: cleanName,
        partyType: partyForm.partyType,
        phone: partyForm.phone.trim().slice(0, 30),
        address: partyForm.address.trim().slice(0, 250),
        balance: editingParty ? editingParty.balance : signedBalance,
        totalDebit: editingParty
          ? editingParty.totalDebit
          : partyForm.openingDirection === 'receivable'
          ? rawBal
          : 0,
        totalCredit: editingParty
          ? editingParty.totalCredit
          : partyForm.openingDirection === 'payable'
          ? rawBal
          : 0,
        notes: partyForm.notes.trim().slice(0, 500),
      },
      editingParty?.id
    );
    setShowPartyModal(false);
  };

  const openEntryModal = (type: EntryType) => {
    if (!activeParty) return;
    setEntryForm({
      entryType: type,
      amount: '',
      paymentMethod: 'cash',
      referenceNo: '',
      description: '',
      entryDate: new Date().toISOString().slice(0, 10),
    });
    setShowEntryModal(true);
  };

  const handleEntrySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeParty) return;
    const amt = Math.min(1000000000, Number(entryForm.amount) || 0);
    if (amt <= 0) return;

    await onAddKhataEntry({
      partyId: activeParty.id,
      partyName: activeParty.name.slice(0, 120),
      entryType: entryForm.entryType,
      amount: amt,
      paymentMethod: entryForm.paymentMethod,
      referenceNo: entryForm.referenceNo.trim().slice(0, 60),
      description: entryForm.description.trim().slice(0, 300),
      entryDate: entryForm.entryDate,
    });
    setShowEntryModal(false);
  };

  const formatMoney = (val: number) => {
    return `${currency} ${Math.abs(val).toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;
  };

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t.khataTitle}</h1>
          <p className="text-sm text-slate-600 mt-1">{t.khataSubtitle}</p>
        </div>
        <button
          onClick={openAddParty}
          className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t.addCustomerSupplier}</span>
        </button>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">{t.totalReceivable}</div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-700 tabular-nums">
              {formatMoney(totals.receivable)}
            </span>
            <span className="text-xs text-emerald-700 font-medium flex items-center gap-1">
              <ArrowDownLeft className="w-3.5 h-3.5" />
              {t.youWillGet}
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">{t.totalPayable}</div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-red-700 tabular-nums">
              {formatMoney(totals.payable)}
            </span>
            <span className="text-xs text-red-700 font-medium flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5" />
              {t.youWillGive}
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">{t.netCashPosition}</div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span
              className={`text-2xl font-bold tabular-nums ${
                totals.net >= 0 ? 'text-slate-900' : 'text-red-700'
              }`}
            >
              {totals.net < 0 ? '-' : ''}
              {formatMoney(totals.net)}
            </span>
            <span className="text-xs text-slate-500">
              {parties.length} {t.allParties}
            </span>
          </div>
        </div>
      </div>

      {/* Master-Detail Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Parties List & Filters */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden no-print">
          <div className="p-4 border-b border-slate-200 space-y-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.searchPartyPlaceholder}
                className="w-full min-h-[40px] pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 focus:bg-white transition-colors"
              />
            </div>

            {/* Interactive Segmented Filter Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {(['all', 'customer', 'supplier'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setTypeFilter(tab)}
                    className={`min-h-[34px] px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      typeFilter === tab
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab === 'all'
                      ? t.allParties
                      : tab === 'customer'
                      ? t.customersOnly
                      : t.suppliersOnly}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {(['all', 'receivable', 'payable', 'settled'] as const).map((bTab) => (
                  <button
                    key={bTab}
                    onClick={() => setBalanceFilter(bTab)}
                    className={`min-h-[34px] px-2 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      balanceFilter === bTab
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {bTab === 'all'
                      ? t.allParties
                      : bTab === 'receivable'
                      ? t.filterReceivable
                      : bTab === 'payable'
                      ? t.filterPayable
                      : t.filterSettled}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Party List Rows */}
          <div className="divide-y divide-slate-100 max-h-[560px] overflow-y-auto">
            {filteredParties.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-slate-500">{t.noPartiesFound}</p>
                <button
                  onClick={openAddParty}
                  className="mt-3 min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t.addCustomerSupplier}</span>
                </button>
              </div>
            ) : (
              filteredParties.map((party) => {
                const isSelected = activeParty?.id === party.id;
                return (
                  <button
                    key={party.id}
                    onClick={() => setSelectedPartyId(party.id)}
                    className={`w-full text-left p-4 flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                      isSelected ? 'bg-slate-900/5' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">
                        {party.name}
                      </div>
                      {/* Clean unboxed metadata per Zero-Pill rule */}
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                        <span>{party.partyType === 'customer' ? t.customer : t.supplier}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{party.phone || '—'}</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div
                        className={`text-sm font-bold tabular-nums ${
                          party.balance > 0
                            ? 'text-emerald-700'
                            : party.balance < 0
                            ? 'text-red-700'
                            : 'text-slate-600'
                        }`}
                      >
                        {formatMoney(party.balance)}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {party.balance > 0
                          ? t.youWillGet
                          : party.balance < 0
                          ? t.youWillGive
                          : t.settled}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Detailed Account Ledger Statement */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          {!activeParty ? (
            <div className="p-12 text-center">
              <FileText className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="mt-3 text-sm text-slate-600">{t.noPartySelected}</p>
            </div>
          ) : (
            <div>
              {/* Party Statement Header */}
              <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{activeParty.name}</h2>
                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                    <span>
                      {activeParty.partyType === 'customer' ? t.customer : t.supplier}
                    </span>
                    {activeParty.phone && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          {activeParty.phone}
                        </span>
                      </>
                    )}
                    {activeParty.address && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {activeParty.address}
                        </span>
                      </>
                    )}
                  </div>
                  {activeParty.notes && (
                    <p className="mt-1.5 text-xs text-slate-500">{activeParty.notes}</p>
                  )}
                </div>

                <div className="flex flex-col sm:items-end shrink-0">
                  <div className="text-xs text-slate-500">
                    {activeParty.balance > 0
                      ? t.youWillGet
                      : activeParty.balance < 0
                      ? t.youWillGive
                      : t.settled}
                  </div>
                  <div
                    className={`text-2xl font-bold tabular-nums mt-0.5 ${
                      activeParty.balance > 0
                        ? 'text-emerald-700'
                        : activeParty.balance < 0
                        ? 'text-red-700'
                        : 'text-slate-900'
                    }`}
                  >
                    {formatMoney(activeParty.balance)}
                  </div>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 no-print">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => openEntryModal('debit')}
                    className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    <span>{t.youGaveDebit}</span>
                  </button>
                  <button
                    onClick={() => openEntryModal('credit')}
                    className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <ArrowDownLeft className="w-4 h-4" />
                    <span>{t.youGotCredit}</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>{t.printStatement}</span>
                  </button>
                  <button
                    onClick={() => openEditParty(activeParty)}
                    className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Edit Account"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDeleteParty(activeParty.id)}
                    className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    title={t.deleteParty}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Ledger Statement Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/60 text-[11px] font-semibold text-slate-500">
                      <th className="py-3 px-4">{t.date}</th>
                      <th className="py-3 px-4">{t.description}</th>
                      <th className="py-3 px-4 text-right">{t.youGaveDebit}</th>
                      <th className="py-3 px-4 text-right">{t.youGotCredit}</th>
                      <th className="py-3 px-4 text-right">Balance</th>
                      <th className="py-3 px-3 text-right no-print"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {partyEntriesWithRunningBalance.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-slate-500">
                          No ledger entries recorded yet for this account. Use the buttons above to log Debit (Udhaar) or Credit (Wusooli).
                        </td>
                      </tr>
                    ) : (
                      partyEntriesWithRunningBalance.map((entry) => (
                        <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="font-medium text-slate-900 tabular-nums">
                              {entry.entryDate}
                            </div>
                            {entry.referenceNo && (
                              <div className="text-[11px] text-slate-500 tabular-nums">
                                {entry.referenceNo}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-slate-900 font-medium">
                              {entry.description || '—'}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {pmLabels[entry.paymentMethod] || entry.paymentMethod}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-red-700 tabular-nums whitespace-nowrap">
                            {entry.entryType === 'debit' ? formatMoney(entry.amount) : '—'}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-emerald-700 tabular-nums whitespace-nowrap">
                            {entry.entryType === 'credit' ? formatMoney(entry.amount) : '—'}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900 tabular-nums whitespace-nowrap">
                            {entry.runningBalance < 0 ? '-' : ''}
                            {formatMoney(entry.runningBalance)}
                          </td>
                          <td className="py-3 px-3 text-right no-print">
                            <button
                              onClick={() => onDeleteKhataEntry(entry)}
                              className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                              title="Delete Entry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Party Modal */}
      {showPartyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-xl bg-white border border-slate-200 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">
                {editingParty ? 'Edit Account' : t.addCustomerSupplier}
              </h3>
              <button
                onClick={() => setShowPartyModal(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handlePartySubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.partyName} *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={120}
                    value={partyForm.name}
                    onChange={(e) => setPartyForm({ ...partyForm, name: e.target.value })}
                    className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                    placeholder="e.g., Al-Madina General Store"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.partyType}
                  </label>
                  <select
                    value={partyForm.partyType}
                    onChange={(e) =>
                      setPartyForm({ ...partyForm, partyType: e.target.value as PartyType })
                    }
                    className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-slate-900"
                  >
                    <option value="customer">{t.customer}</option>
                    <option value="supplier">{t.supplier}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.phone}
                  </label>
                  <input
                    type="text"
                    maxLength={30}
                    value={partyForm.phone}
                    onChange={(e) => setPartyForm({ ...partyForm, phone: e.target.value })}
                    className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 tabular-nums"
                    placeholder="0300-1234567"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.address}
                  </label>
                  <input
                    type="text"
                    maxLength={250}
                    value={partyForm.address}
                    onChange={(e) => setPartyForm({ ...partyForm, address: e.target.value })}
                    className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                    placeholder="Market / Street / City"
                  />
                </div>

                {!editingParty && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.openingBalance}
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={1000000000}
                        value={partyForm.openingBalance}
                        onChange={(e) =>
                          setPartyForm({ ...partyForm, openingBalance: e.target.value })
                        }
                        className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.openingBalanceType}
                      </label>
                      <select
                        value={partyForm.openingDirection}
                        onChange={(e) =>
                          setPartyForm({
                            ...partyForm,
                            openingDirection: e.target.value as 'receivable' | 'payable',
                          })
                        }
                        className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-slate-900"
                      >
                        <option value="receivable">{t.youWillGet}</option>
                        <option value="payable">{t.youWillGive}</option>
                      </select>
                    </div>
                  </>
                )}

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.notes}
                  </label>
                  <textarea
                    rows={2}
                    maxLength={500}
                    value={partyForm.notes}
                    onChange={(e) => setPartyForm({ ...partyForm, notes: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                    placeholder="Payment cycle, credit limit, or special instructions"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPartyModal(false)}
                  className="min-h-[42px] px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="min-h-[42px] px-5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer"
                >
                  {t.saveAccount}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Khata Entry Modal */}
      {showEntryModal && activeParty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl bg-white border border-slate-200 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {entryForm.entryType === 'debit' ? t.youGaveDebit : t.youGotCredit}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{activeParty.name}</p>
              </div>
              <button
                onClick={() => setShowEntryModal(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleEntrySubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setEntryForm({ ...entryForm, entryType: 'debit' })}
                  className={`min-h-[38px] py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    entryForm.entryType === 'debit'
                      ? 'bg-red-600 text-white'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  {t.youGaveDebit}
                </button>
                <button
                  type="button"
                  onClick={() => setEntryForm({ ...entryForm, entryType: 'credit' })}
                  className={`min-h-[38px] py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    entryForm.entryType === 'credit'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  {t.youGotCredit}
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.amount} ({currency}) *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={1000000000}
                  step="any"
                  value={entryForm.amount}
                  onChange={(e) => setEntryForm({ ...entryForm, amount: e.target.value })}
                  className="w-full min-h-[44px] px-3 py-2 text-base font-bold border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 tabular-nums"
                  placeholder="0"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.paymentMethod}
                  </label>
                  <select
                    value={entryForm.paymentMethod}
                    onChange={(e) =>
                      setEntryForm({
                        ...entryForm,
                        paymentMethod: e.target.value as PaymentMethod,
                      })
                    }
                    className="w-full min-h-[42px] px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-slate-900"
                  >
                    {(['cash', 'bank', 'jazzcash', 'easypaisa', 'cheque', 'credit'] as const).map(
                      (m) => (
                        <option key={m} value={m}>
                          {pmLabels[m]}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.date}
                  </label>
                  <input
                    type="date"
                    required
                    value={entryForm.entryDate}
                    onChange={(e) => setEntryForm({ ...entryForm, entryDate: e.target.value })}
                    className="w-full min-h-[42px] px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.referenceNo}
                </label>
                <input
                  type="text"
                  maxLength={60}
                  value={entryForm.referenceNo}
                  onChange={(e) => setEntryForm({ ...entryForm, referenceNo: e.target.value })}
                  className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 tabular-nums"
                  placeholder="e.g., INV-1024 or Slip #"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.description}
                </label>
                <input
                  type="text"
                  maxLength={300}
                  value={entryForm.description}
                  onChange={(e) => setEntryForm({ ...entryForm, description: e.target.value })}
                  className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                  placeholder="Details of items or payment remarks"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEntryModal(false)}
                  className="min-h-[42px] px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className={`min-h-[42px] px-5 py-2 text-xs font-semibold text-white rounded-lg cursor-pointer ${
                    entryForm.entryType === 'debit'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {t.saveEntry}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
