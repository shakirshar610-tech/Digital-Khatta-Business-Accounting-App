import React, { useMemo, useState } from 'react';
import { Plus, Search, Trash2, Edit3, X } from 'lucide-react';
import { Expense, ExpenseCategory, Language } from '../types';
import {
  translations,
  expenseCategoryLabels,
  paymentMethodLabels,
} from '../i18n/translations';

interface ExpensesModuleProps {
  lang: Language;
  currency: string;
  expenses: Expense[];
  onSaveExpense: (
    expense: Omit<Expense, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) => Promise<void>;
  onDeleteExpense: (expenseId: string) => Promise<void>;
}

const ALL_CATEGORIES: ExpenseCategory[] = [
  'rent',
  'utilities',
  'refreshments',
  'transport',
  'packaging',
  'maintenance',
  'payroll',
  'marketing',
  'other',
];

export const ExpensesModule: React.FC<ExpensesModuleProps> = ({
  lang,
  currency,
  expenses,
  onSaveExpense,
  onDeleteExpense,
}) => {
  const t = translations[lang];
  const catLabels = expenseCategoryLabels[lang];
  const pmLabels = paymentMethodLabels[lang];

  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [form, setForm] = useState({
    title: '',
    category: 'utilities' as ExpenseCategory,
    amount: '',
    paymentMethod: 'cash' as Expense['paymentMethod'],
    referenceNo: '',
    notes: '',
    expenseDate: new Date().toISOString().slice(0, 10),
  });

  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      if (categoryFilter !== 'all' && exp.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          exp.title.toLowerCase().includes(q) ||
          exp.referenceNo.toLowerCase().includes(q) ||
          exp.notes.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [expenses, categoryFilter, searchQuery]);

  const summary = useMemo(() => {
    const total = expenses.reduce((sum, e) => sum + e.amount, 0);
    const byCat: Record<string, number> = {};
    for (const e of expenses) {
      byCat[e.category] = (byCat[e.category] || 0) + e.amount;
    }
    const topCategories = Object.entries(byCat)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    return { total, topCategories };
  }, [expenses]);

  const openAdd = () => {
    setEditingExpense(null);
    setForm({
      title: '',
      category: 'utilities',
      amount: '',
      paymentMethod: 'cash',
      referenceNo: '',
      notes: '',
      expenseDate: new Date().toISOString().slice(0, 10),
    });
    setShowModal(true);
  };

  const openEdit = (exp: Expense) => {
    setEditingExpense(exp);
    setForm({
      title: exp.title,
      category: exp.category,
      amount: String(exp.amount),
      paymentMethod: exp.paymentMethod,
      referenceNo: exp.referenceNo,
      notes: exp.notes,
      expenseDate: exp.expenseDate,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = form.title.trim().slice(0, 120);
    const amt = Math.min(100000000, Number(form.amount) || 0);
    if (!cleanTitle || amt <= 0) return;

    await onSaveExpense(
      {
        title: cleanTitle,
        category: form.category,
        amount: amt,
        paymentMethod: form.paymentMethod,
        referenceNo: form.referenceNo.trim().slice(0, 60),
        notes: form.notes.trim().slice(0, 300),
        expenseDate: form.expenseDate,
      },
      editingExpense?.id
    );
    setShowModal(false);
  };

  const formatMoney = (val: number) =>
    `${currency} ${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t.expensesTitle}</h1>
          <p className="text-sm text-slate-600 mt-1">{t.expensesSubtitle}</p>
        </div>
        <button
          onClick={openAdd}
          className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t.recordExpense}</span>
        </button>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">{t.monthlyExpenses}</div>
          <div className="mt-1.5 text-2xl font-bold text-slate-900 tabular-nums">
            {formatMoney(summary.total)}
          </div>
          <div className="mt-1 text-xs text-slate-500">{expenses.length} recorded vouchers</div>
        </div>

        {summary.topCategories.map(([catKey, amt]) => (
          <div key={catKey} className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs font-medium text-slate-500 truncate">
              {catLabels[catKey] || catKey}
            </div>
            <div className="mt-1.5 text-xl font-bold text-slate-900 tabular-nums">
              {formatMoney(amt)}
            </div>
            <div className="mt-1 text-xs text-slate-500 tabular-nums">
              {summary.total > 0 ? `${Math.round((amt / summary.total) * 100)}% of total` : '0%'}
            </div>
          </div>
        ))}
      </div>

      {/* Expenses Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search expense title, voucher #, or notes..."
              className="w-full min-h-[40px] pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 focus:bg-white"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="min-h-[38px] px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-white text-slate-700"
          >
            <option value="all">{t.allCategories}</option>
            {ALL_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {catLabels[c]}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                <th className="py-3 px-4">{t.date}</th>
                <th className="py-3 px-4">{t.expenseTitleLabel}</th>
                <th className="py-3 px-4">{t.category}</th>
                <th className="py-3 px-4">{t.paymentMethod}</th>
                <th className="py-3 px-4 text-right">{t.amount}</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    No expenses match your filter.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-medium text-slate-900 tabular-nums">
                        {exp.expenseDate}
                      </div>
                      {exp.referenceNo && (
                        <div className="text-[11px] text-slate-500 tabular-nums">
                          {exp.referenceNo}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{exp.title}</div>
                      {exp.notes && <div className="text-[11px] text-slate-500">{exp.notes}</div>}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {catLabels[exp.category] || exp.category}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {pmLabels[exp.paymentMethod] || exp.paymentMethod}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900 tabular-nums whitespace-nowrap">
                      {formatMoney(exp.amount)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => openEdit(exp)}
                          className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteExpense(exp.id)}
                          className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Expense Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl bg-white border border-slate-200 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">
                {editingExpense ? 'Edit Expense' : t.recordExpense}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.expenseTitleLabel} *
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  placeholder="e.g., Shop Electricity Bill or Loader Rent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.category}
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value as ExpenseCategory })
                    }
                    className="w-full min-h-[42px] px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    {ALL_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {catLabels[c]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.amount} ({currency}) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={100000000}
                    step="any"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="w-full min-h-[42px] px-3 py-2 text-sm font-bold border border-slate-300 rounded-lg tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.paymentMethod}
                  </label>
                  <select
                    value={form.paymentMethod}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        paymentMethod: e.target.value as Expense['paymentMethod'],
                      })
                    }
                    className="w-full min-h-[42px] px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    {(['cash', 'bank', 'jazzcash', 'easypaisa', 'cheque'] as const).map((m) => (
                      <option key={m} value={m}>
                        {pmLabels[m]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.date}
                  </label>
                  <input
                    type="date"
                    required
                    value={form.expenseDate}
                    onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
                    className="w-full min-h-[42px] px-3 py-2 text-xs border border-slate-300 rounded-lg tabular-nums"
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
                  value={form.referenceNo}
                  onChange={(e) => setForm({ ...form, referenceNo: e.target.value })}
                  className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.notes}
                </label>
                <input
                  type="text"
                  maxLength={300}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="min-h-[42px] px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="min-h-[42px] px-5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer"
                >
                  {t.saveExpense}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
