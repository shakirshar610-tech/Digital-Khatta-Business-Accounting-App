import React, { useMemo, useState } from 'react';
import {
  Plus,
  Search,
  AlertTriangle,
  PackagePlus,
  PackageMinus,
  Edit3,
  Trash2,
  X,
} from 'lucide-react';
import { InventoryItem, InventoryUnit, Language } from '../types';
import { translations, unitLabels } from '../i18n/translations';

interface InventoryModuleProps {
  lang: Language;
  currency: string;
  items: InventoryItem[];
  onSaveItem: (
    item: Omit<InventoryItem, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) => Promise<void>;
  onAdjustStock: (itemId: string, newQuantity: number) => Promise<void>;
  onDeleteItem: (itemId: string) => Promise<void>;
}

export const InventoryModule: React.FC<InventoryModuleProps> = ({
  lang,
  currency,
  items,
  onSaveItem,
  onAdjustStock,
  onDeleteItem,
}) => {
  const t = translations[lang];
  const uLabels = unitLabels[lang];

  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [itemForm, setItemForm] = useState({
    name: '',
    sku: '',
    category: 'Grains & Staples',
    unit: 'bag' as InventoryUnit,
    purchasePrice: '',
    salePrice: '',
    stockQuantity: '',
    lowStockThreshold: '10',
  });

  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null);
  const [adjustDirection, setAdjustDirection] = useState<'in' | 'out'>('in');
  const [adjustDelta, setAdjustDelta] = useState('1');

  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => set.add(i.category));
    return Array.from(set);
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (stockFilter === 'low' && (item.stockQuantity > item.lowStockThreshold || item.stockQuantity === 0)) {
        return false;
      }
      if (stockFilter === 'out' && item.stockQuantity > 0) {
        return false;
      }
      if (categoryFilter !== 'all' && item.category !== categoryFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.sku.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [items, stockFilter, categoryFilter, searchQuery]);

  const stats = useMemo(() => {
    let costValue = 0;
    let retailValue = 0;
    let lowStockCount = 0;
    for (const item of items) {
      costValue += item.purchasePrice * item.stockQuantity;
      retailValue += item.salePrice * item.stockQuantity;
      if (item.stockQuantity <= item.lowStockThreshold) {
        lowStockCount += 1;
      }
    }
    return {
      costValue,
      retailValue,
      margin: retailValue - costValue,
      lowStockCount,
    };
  }, [items]);

  const openAddModal = () => {
    setEditingItem(null);
    setItemForm({
      name: '',
      sku: `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
      category: 'Grains & Staples',
      unit: 'pcs',
      purchasePrice: '',
      salePrice: '',
      stockQuantity: '',
      lowStockThreshold: '10',
    });
    setShowItemModal(true);
  };

  const openEditModal = (item: InventoryItem) => {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      sku: item.sku,
      category: item.category,
      unit: item.unit,
      purchasePrice: String(item.purchasePrice),
      salePrice: String(item.salePrice),
      stockQuantity: String(item.stockQuantity),
      lowStockThreshold: String(item.lowStockThreshold),
    });
    setShowItemModal(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = itemForm.name.trim().slice(0, 120);
    const cleanSku = itemForm.sku.trim().slice(0, 60);
    const cleanCategory = itemForm.category.trim().slice(0, 80) || 'General';
    if (!cleanName || !cleanSku) return;

    await onSaveItem(
      {
        name: cleanName,
        sku: cleanSku,
        category: cleanCategory,
        unit: itemForm.unit,
        purchasePrice: Math.max(0, Math.min(100000000, Number(itemForm.purchasePrice) || 0)),
        salePrice: Math.max(0, Math.min(100000000, Number(itemForm.salePrice) || 0)),
        stockQuantity: Math.max(0, Math.min(10000000, Number(itemForm.stockQuantity) || 0)),
        lowStockThreshold: Math.max(0, Math.min(1000000, Number(itemForm.lowStockThreshold) || 0)),
      },
      editingItem?.id
    );
    setShowItemModal(false);
  };

  const openQuickAdjust = (item: InventoryItem, dir: 'in' | 'out') => {
    setAdjustingItem(item);
    setAdjustDirection(dir);
    setAdjustDelta('1');
  };

  const handleConfirmAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingItem) return;
    const delta = Math.max(0, Number(adjustDelta) || 0);
    if (delta <= 0) return;

    const nextQty =
      adjustDirection === 'in'
        ? Math.min(10000000, adjustingItem.stockQuantity + delta)
        : Math.max(0, adjustingItem.stockQuantity - delta);

    await onAdjustStock(adjustingItem.id, nextQty);
    setAdjustingItem(null);
  };

  const formatMoney = (val: number) =>
    `${currency} ${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t.inventoryTitle}</h1>
          <p className="text-sm text-slate-600 mt-1">{t.inventorySubtitle}</p>
        </div>
        <button
          onClick={openAddModal}
          className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t.addStockItem}</span>
        </button>
      </div>

      {/* Valuation & Alerts Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">{t.stockValuation}</div>
          <div className="mt-1.5 text-2xl font-bold text-slate-900 tabular-nums">
            {formatMoney(stats.costValue)}
          </div>
          <div className="mt-1 text-xs text-slate-500">{items.length} active products</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">{t.retailValuation}</div>
          <div className="mt-1.5 text-2xl font-bold text-slate-900 tabular-nums">
            {formatMoney(stats.retailValue)}
          </div>
          <div className="mt-1 text-xs text-emerald-700 font-medium tabular-nums">
            +{formatMoney(stats.margin)} {t.expectedMargin}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">{t.lowStockItems}</div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span
              className={`text-2xl font-bold tabular-nums ${
                stats.lowStockCount > 0 ? 'text-amber-600' : 'text-slate-900'
              }`}
            >
              {stats.lowStockCount}
            </span>
            {stats.lowStockCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                <AlertTriangle className="w-3.5 h-3.5" />
                Needs restock
              </span>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">{t.allCategories}</div>
          <div className="mt-1.5 text-2xl font-bold text-slate-900 tabular-nums">
            {categories.length}
          </div>
          <div className="mt-1 text-xs text-slate-500 truncate">
            {categories.join(' · ') || '—'}
          </div>
        </div>
      </div>

      {/* Filters & Inventory Data Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchInventoryPlaceholder}
              className="w-full min-h-[40px] pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 focus:bg-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(['all', 'low', 'out'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStockFilter(tab)}
                  className={`min-h-[34px] px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    stockFilter === tab
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab === 'all'
                    ? t.allStock
                    : tab === 'low'
                    ? t.lowStockOnly
                    : t.outOfStockOnly}
                </button>
              ))}
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="min-h-[38px] px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:border-slate-900"
            >
              <option value="all">{t.allCategories}</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                <th className="py-3 px-4">{t.itemName}</th>
                <th className="py-3 px-4">{t.skuCode}</th>
                <th className="py-3 px-4 text-right">{t.purchasePrice}</th>
                <th className="py-3 px-4 text-right">{t.salePrice}</th>
                <th className="py-3 px-4 text-right">{t.currentStock}</th>
                <th className="py-3 px-4 text-right">Stock Value</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500">
                    No inventory items found matching your filter.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isLow = item.stockQuantity <= item.lowStockThreshold && item.stockQuantity > 0;
                  const isOut = item.stockQuantity === 0;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{item.name}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          <span>{item.category}</span>
                          <span aria-hidden="true"> · </span>
                          <span>{uLabels[item.unit] || item.unit}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-600 tabular-nums whitespace-nowrap">
                        {item.sku}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-700 tabular-nums whitespace-nowrap">
                        {formatMoney(item.purchasePrice)}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                        {formatMoney(item.salePrice)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div
                          className={`font-bold tabular-nums ${
                            isOut
                              ? 'text-red-700'
                              : isLow
                              ? 'text-amber-700'
                              : 'text-emerald-700'
                          }`}
                        >
                          {item.stockQuantity} {item.unit}
                        </div>
                        <div className="text-[11px] text-slate-500 tabular-nums">
                          {isOut
                            ? 'Out of stock'
                            : isLow
                            ? `Low (Min ${item.lowStockThreshold})`
                            : `Min ${item.lowStockThreshold}`}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                        {formatMoney(item.purchasePrice * item.stockQuantity)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => openQuickAdjust(item, 'in')}
                            className="min-h-[36px] px-2.5 py-1 rounded-md border border-slate-200 bg-white text-emerald-700 hover:bg-emerald-50 font-semibold inline-flex items-center gap-1 cursor-pointer"
                            title={t.stockIn}
                          >
                            <PackagePlus className="w-3.5 h-3.5" />
                            <span>+</span>
                          </button>
                          <button
                            onClick={() => openQuickAdjust(item, 'out')}
                            className="min-h-[36px] px-2.5 py-1 rounded-md border border-slate-200 bg-white text-amber-700 hover:bg-amber-50 font-semibold inline-flex items-center gap-1 cursor-pointer"
                            title={t.stockOut}
                          >
                            <PackageMinus className="w-3.5 h-3.5" />
                            <span>-</span>
                          </button>
                          <button
                            onClick={() => openEditModal(item)}
                            className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                            title="Edit Item"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteItem(item.id)}
                            className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                            title="Delete Item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Item Modal */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-xl bg-white border border-slate-200 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">
                {editingItem ? 'Edit Stock Item' : t.addStockItem}
              </h3>
              <button
                onClick={() => setShowItemModal(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveItem} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.itemName} *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={120}
                    value={itemForm.name}
                    onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                    className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                    placeholder="e.g., Super Kernel Basmati Rice 25kg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.skuCode} *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={60}
                    value={itemForm.sku}
                    onChange={(e) => setItemForm({ ...itemForm, sku: e.target.value })}
                    className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.category} *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={80}
                    value={itemForm.category}
                    onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                    className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.unit}
                  </label>
                  <select
                    value={itemForm.unit}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, unit: e.target.value as InventoryUnit })
                    }
                    className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-slate-900"
                  >
                    {(['pcs', 'kg', 'bag', 'carton', 'liter', 'meter', 'box', 'dozen'] as const).map(
                      (u) => (
                        <option key={u} value={u}>
                          {uLabels[u]}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.currentStock} *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    max={10000000}
                    step="any"
                    value={itemForm.stockQuantity}
                    onChange={(e) => setItemForm({ ...itemForm, stockQuantity: e.target.value })}
                    className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.purchasePrice} ({currency}) *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    max={100000000}
                    step="any"
                    value={itemForm.purchasePrice}
                    onChange={(e) => setItemForm({ ...itemForm, purchasePrice: e.target.value })}
                    className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.salePrice} ({currency}) *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    max={100000000}
                    step="any"
                    value={itemForm.salePrice}
                    onChange={(e) => setItemForm({ ...itemForm, salePrice: e.target.value })}
                    className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 tabular-nums"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.lowStockThreshold}
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    max={1000000}
                    value={itemForm.lowStockThreshold}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, lowStockThreshold: e.target.value })
                    }
                    className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 tabular-nums"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="min-h-[42px] px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="min-h-[42px] px-5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer"
                >
                  {t.saveItem}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Stock Adjustment Modal */}
      {adjustingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-xl bg-white border border-slate-200 shadow-xl p-6">
            <h3 className="text-base font-bold text-slate-900">
              {adjustDirection === 'in' ? t.stockIn : t.stockOut}
            </h3>
            <p className="text-xs text-slate-600 mt-1">{adjustingItem.name}</p>
            <form onSubmit={handleConfirmAdjust} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Quantity ({adjustingItem.unit}) — Current: {adjustingItem.stockQuantity}
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={1000000}
                  step="any"
                  value={adjustDelta}
                  onChange={(e) => setAdjustDelta(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 text-base font-bold border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 tabular-nums"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustingItem(null)}
                  className="min-h-[40px] px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className={`min-h-[40px] px-4 py-2 text-xs font-semibold text-white rounded-lg cursor-pointer ${
                    adjustDirection === 'in'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
