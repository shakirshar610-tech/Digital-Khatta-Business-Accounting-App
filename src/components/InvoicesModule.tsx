import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Printer,
  FileText,
  Trash2,
  X,
  CheckCircle2,
  Ban,
} from 'lucide-react';
import {
  InventoryItem,
  Invoice,
  InvoiceLineItem,
  InvoiceType,
  Language,
  Party,
  PaymentMethod,
} from '../types';
import { translations, paymentMethodLabels } from '../i18n/translations';

interface InvoicesModuleProps {
  lang: Language;
  currency: string;
  businessName: string;
  invoices: Invoice[];
  parties: Party[];
  inventoryItems: InventoryItem[];
  triggerNewModal?: number;
  onCreateInvoice: (
    invoice: Omit<Invoice, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>,
    lineItems: InvoiceLineItem[]
  ) => Promise<void>;
  onRecordInvoicePayment: (invoice: Invoice, additionalPayment: number) => Promise<void>;
  onCancelInvoice: (invoice: Invoice) => Promise<void>;
  onDeleteInvoice: (invoiceId: string) => Promise<void>;
}

export const InvoicesModule: React.FC<InvoicesModuleProps> = ({
  lang,
  currency,
  businessName,
  invoices,
  parties,
  inventoryItems,
  triggerNewModal,
  onCreateInvoice,
  onRecordInvoicePayment,
  onCancelInvoice,
  onDeleteInvoice,
}) => {
  const t = translations[lang];
  const pmLabels = paymentMethodLabels[lang];

  const [activeTab, setActiveTab] = useState<InvoiceType>('sale');
  const [showBuilderModal, setShowBuilderModal] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [printFormat, setPrintFormat] = useState<'a4' | 'thermal'>('a4');

  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [paymentInput, setPaymentInput] = useState('');

  // Builder state
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('sale');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [partyId, setPartyId] = useState('walkin_customer');
  const [customPartyName, setCustomPartyName] = useState('Walk-in Customer');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [taxAmount, setTaxAmount] = useState('0');
  const [paidAmount, setPaidAmount] = useState('0');
  const [rows, setRows] = useState<InvoiceLineItem[]>([]);

  const openBuilder = (type: InvoiceType) => {
    const prefix = type === 'sale' ? 'INV' : 'PUR';
    const nextNum = `${prefix}-${1001 + invoices.length}`;
    setInvoiceType(type);
    setInvoiceNumber(nextNum);

    const eligibleParties = parties.filter((p) =>
      type === 'sale' ? p.partyType === 'customer' : p.partyType === 'supplier'
    );
    if (eligibleParties.length > 0) {
      setPartyId(eligibleParties[0].id);
      setCustomPartyName(eligibleParties[0].name);
    } else {
      setPartyId('walkin_customer');
      setCustomPartyName(t.walkInCustomer);
    }

    const firstItem = inventoryItems[0];
    setRows(
      firstItem
        ? [
            {
              itemId: firstItem.id,
              name: firstItem.name,
              unit: firstItem.unit,
              quantity: 1,
              unitPrice: type === 'sale' ? firstItem.salePrice : firstItem.purchasePrice,
              lineTotal: type === 'sale' ? firstItem.salePrice : firstItem.purchasePrice,
            },
          ]
        : [
            {
              itemId: 'custom_1',
              name: 'General Merchandise',
              unit: 'pcs',
              quantity: 1,
              unitPrice: 1000,
              lineTotal: 1000,
            },
          ]
    );
    setDiscountAmount('0');
    setTaxAmount('0');
    setPaidAmount(firstItem ? String(type === 'sale' ? firstItem.salePrice : firstItem.purchasePrice) : '1000');
    setPaymentMethod('cash');
    setInvoiceDate(new Date().toISOString().slice(0, 10));
    setShowBuilderModal(true);
  };

  useEffect(() => {
    if (triggerNewModal && triggerNewModal > 0) {
      openBuilder('sale');
    }
  }, [triggerNewModal]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => inv.invoiceType === activeTab);
  }, [invoices, activeTab]);

  const builderTotals = useMemo(() => {
    const subtotal = rows.reduce((sum, r) => sum + r.quantity * r.unitPrice, 0);
    const disc = Math.max(0, Number(discountAmount) || 0);
    const tax = Math.max(0, Number(taxAmount) || 0);
    const total = Math.max(0, subtotal - disc + tax);
    const paid = Math.max(0, Math.min(total, Number(paidAmount) || 0));
    const due = Math.max(0, total - paid);
    return { subtotal, disc, tax, total, paid, due };
  }, [rows, discountAmount, taxAmount, paidAmount]);

  const handleRowItemChange = (index: number, selectedItemId: string) => {
    const found = inventoryItems.find((i) => i.id === selectedItemId);
    const updated = [...rows];
    if (found) {
      const price = invoiceType === 'sale' ? found.salePrice : found.purchasePrice;
      updated[index] = {
        itemId: found.id,
        name: found.name,
        unit: found.unit,
        quantity: updated[index].quantity,
        unitPrice: price,
        lineTotal: updated[index].quantity * price,
      };
    }
    setRows(updated);
  };

  const handleRowQtyPriceChange = (index: number, qty: number, price: number) => {
    const updated = [...rows];
    const safeQty = Math.max(1, qty);
    const safePrice = Math.max(0, price);
    updated[index] = {
      ...updated[index],
      quantity: safeQty,
      unitPrice: safePrice,
      lineTotal: safeQty * safePrice,
    };
    setRows(updated);
  };

  const addLineItemRow = () => {
    const first = inventoryItems[0];
    setRows([
      ...rows,
      {
        itemId: first ? first.id : `custom_${Date.now()}`,
        name: first ? first.name : 'Item',
        unit: first ? first.unit : 'pcs',
        quantity: 1,
        unitPrice: first ? (invoiceType === 'sale' ? first.salePrice : first.purchasePrice) : 500,
        lineTotal: first ? (invoiceType === 'sale' ? first.salePrice : first.purchasePrice) : 500,
      },
    ]);
  };

  const removeLineItemRow = (index: number) => {
    if (rows.length <= 1) return;
    setRows(rows.filter((_, idx) => idx !== index));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rows.length === 0) return;

    const selectedParty = parties.find((p) => p.id === partyId);
    const finalPartyId = selectedParty ? selectedParty.id : 'walkin_customer';
    const finalPartyName = (selectedParty ? selectedParty.name : customPartyName || t.walkInCustomer)
      .trim()
      .slice(0, 120);

    const serializedItems = JSON.stringify(rows).slice(0, 1500);
    const status = builderTotals.due === 0 ? 'paid' : 'issued';

    await onCreateInvoice(
      {
        invoiceNumber: invoiceNumber.trim().slice(0, 60) || `INV-${Date.now()}`,
        invoiceType,
        partyId: finalPartyId,
        partyName: finalPartyName,
        itemsSummary: serializedItems,
        subtotal: builderTotals.subtotal,
        discountAmount: builderTotals.disc,
        taxAmount: builderTotals.tax,
        totalAmount: builderTotals.total,
        paidAmount: builderTotals.paid,
        balanceDue: builderTotals.due,
        paymentMethod,
        invoiceStatus: status,
        invoiceDate,
      },
      rows
    );
    setShowBuilderModal(false);
  };

  const parseItemsSummary = (summary: string): InvoiceLineItem[] => {
    try {
      const parsed = JSON.parse(summary);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Fallback if plain string
    }
    return [
      {
        itemId: 'item_1',
        name: summary,
        unit: 'pcs',
        quantity: 1,
        unitPrice: 0,
        lineTotal: 0,
      },
    ];
  };

  const formatMoney = (val: number) =>
    `${currency} ${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t.invoicesTitle}</h1>
          <p className="text-sm text-slate-600 mt-1">{t.invoicesSubtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => openBuilder('sale')}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t.createSaleInvoice}</span>
          </button>
          <button
            onClick={() => openBuilder('purchase')}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t.createPurchaseBill}</span>
          </button>
        </div>
      </div>

      {/* Tabs & Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden no-print">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              onClick={() => setActiveTab('sale')}
              className={`min-h-[36px] px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'sale'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.salesInvoices}
            </button>
            <button
              onClick={() => setActiveTab('purchase')}
              className={`min-h-[36px] px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'purchase'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.purchaseBills}
            </button>
          </div>

          <div className="text-xs text-slate-500 tabular-nums">
            {filteredInvoices.length} records
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                <th className="py-3 px-4">{t.invoiceNumber}</th>
                <th className="py-3 px-4">{t.selectParty}</th>
                <th className="py-3 px-4 text-right">{t.grandTotal}</th>
                <th className="py-3 px-4 text-right">{t.paidAmount}</th>
                <th className="py-3 px-4 text-right">{t.balanceDue}</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500">
                    No invoices or bills recorded in this category yet.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const isCancelled = inv.invoiceStatus === 'cancelled';
                  const isPaid = inv.invoiceStatus === 'paid' || inv.balanceDue === 0;
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-bold text-slate-900 tabular-nums">
                          {inv.invoiceNumber}
                        </div>
                        <div className="text-[11px] text-slate-500 tabular-nums">
                          {inv.invoiceDate}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{inv.partyName}</div>
                        <div className="text-[11px] text-slate-500">
                          {pmLabels[inv.paymentMethod] || inv.paymentMethod}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 tabular-nums whitespace-nowrap">
                        {formatMoney(inv.totalAmount)}
                      </td>
                      <td className="py-3 px-4 text-right text-emerald-700 font-semibold tabular-nums whitespace-nowrap">
                        {formatMoney(inv.paidAmount)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-red-700 tabular-nums whitespace-nowrap">
                        {inv.balanceDue > 0 ? formatMoney(inv.balanceDue) : '—'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {/* Unboxed status text + icon per anti-slop & color-blind rules */}
                        <span
                          className={`inline-flex items-center gap-1 font-semibold ${
                            isCancelled
                              ? 'text-slate-400 line-through'
                              : isPaid
                              ? 'text-emerald-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {isCancelled ? (
                            <>
                              <Ban className="w-3.5 h-3.5" />
                              <span>Cancelled</span>
                            </>
                          ) : isPaid ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Paid</span>
                            </>
                          ) : (
                            <>
                              <FileText className="w-3.5 h-3.5" />
                              <span>Credit / Partial</span>
                            </>
                          )}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => setPreviewInvoice(inv)}
                            className="min-h-[36px] px-2.5 py-1 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-medium inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>{t.printReceipt}</span>
                          </button>

                          {!isCancelled && inv.balanceDue > 0 && (
                            <button
                              onClick={() => {
                                setPayingInvoice(inv);
                                setPaymentInput(String(inv.balanceDue));
                              }}
                              className="min-h-[36px] px-2.5 py-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 font-medium cursor-pointer"
                            >
                              {t.recordPayment}
                            </button>
                          )}

                          {!isCancelled && (
                            <button
                              onClick={() => onCancelInvoice(inv)}
                              className="min-h-[36px] px-2 py-1 rounded-md border border-slate-200 text-amber-700 hover:bg-amber-50 cursor-pointer"
                              title={t.cancelInvoice}
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => onDeleteInvoice(inv.id)}
                            className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                            title="Delete"
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

      {/* Create Invoice / Bill Modal */}
      {showBuilderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto no-print">
          <div className="w-full max-w-3xl rounded-xl bg-white border border-slate-200 shadow-xl overflow-hidden my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">
                {invoiceType === 'sale' ? t.createSaleInvoice : t.createPurchaseBill}
              </h3>
              <button
                onClick={() => setShowBuilderModal(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.invoiceNumber}
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={60}
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.selectParty}
                  </label>
                  <select
                    value={partyId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPartyId(val);
                      const found = parties.find((p) => p.id === val);
                      if (found) setCustomPartyName(found.name);
                      else setCustomPartyName(t.walkInCustomer);
                    }}
                    className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="walkin_customer">{t.walkInCustomer}</option>
                    {parties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.partyType})
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
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums"
                  />
                </div>
              </div>

              {/* Line Items Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-700">{t.lineItems}</label>
                  <button
                    type="button"
                    onClick={addLineItemRow}
                    className="min-h-[34px] inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t.addItemRow}</span>
                  </button>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                        <th className="py-2.5 px-3">{t.itemName}</th>
                        <th className="py-2.5 px-3 w-24 text-right">{t.quantity}</th>
                        <th className="py-2.5 px-3 w-32 text-right">{t.unitPrice}</th>
                        <th className="py-2.5 px-3 w-32 text-right">{t.lineTotal}</th>
                        <th className="py-2.5 px-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map((row, idx) => (
                        <tr key={idx}>
                          <td className="p-2">
                            <select
                              value={row.itemId}
                              onChange={(e) => handleRowItemChange(idx, e.target.value)}
                              className="w-full min-h-[38px] px-2.5 py-1.5 border border-slate-200 rounded-md bg-white text-xs"
                            >
                              {inventoryItems.map((invItem) => (
                                <option key={invItem.id} value={invItem.id}>
                                  {invItem.name} ({invItem.stockQuantity} {invItem.unit})
                                </option>
                              ))}
                              {!inventoryItems.some((i) => i.id === row.itemId) && (
                                <option value={row.itemId}>{row.name}</option>
                              )}
                            </select>
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min={1}
                              step="any"
                              value={row.quantity}
                              onChange={(e) =>
                                handleRowQtyPriceChange(idx, Number(e.target.value), row.unitPrice)
                              }
                              className="w-full min-h-[38px] px-2 py-1.5 text-right border border-slate-200 rounded-md tabular-nums"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={row.unitPrice}
                              onChange={(e) =>
                                handleRowQtyPriceChange(idx, row.quantity, Number(e.target.value))
                              }
                              className="w-full min-h-[38px] px-2 py-1.5 text-right border border-slate-200 rounded-md tabular-nums"
                            />
                          </td>
                          <td className="p-2 text-right font-bold text-slate-900 tabular-nums">
                            {formatMoney(row.lineTotal)}
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeLineItemRow(idx)}
                              className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center text-slate-400 hover:text-red-600 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals & Settlement Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {t.paymentMethod}
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                      className="w-full min-h-[42px] px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
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

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.discount} ({currency})
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={discountAmount}
                        onChange={(e) => setDiscountAmount(e.target.value)}
                        className="w-full min-h-[40px] px-3 py-1.5 text-sm border border-slate-300 rounded-lg tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.taxAmount} ({currency})
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={taxAmount}
                        onChange={(e) => setTaxAmount(e.target.value)}
                        className="w-full min-h-[40px] px-3 py-1.5 text-sm border border-slate-300 rounded-lg tabular-nums"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>{t.subtotal}</span>
                    <span className="font-semibold tabular-nums">
                      {formatMoney(builderTotals.subtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>{t.discount}</span>
                    <span className="tabular-nums">-{formatMoney(builderTotals.disc)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>{t.taxAmount}</span>
                    <span className="tabular-nums">+{formatMoney(builderTotals.tax)}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-bold text-slate-900">
                    <span>{t.grandTotal}</span>
                    <span className="tabular-nums">{formatMoney(builderTotals.total)}</span>
                  </div>

                  <div className="pt-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {t.paidAmount} ({currency})
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={builderTotals.total}
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value)}
                      className="w-full min-h-[40px] px-3 py-1.5 text-sm font-bold bg-white border border-slate-300 rounded-lg tabular-nums"
                    />
                  </div>

                  <div className="flex justify-between text-xs font-semibold text-red-700 pt-1">
                    <span>{t.balanceDue}</span>
                    <span className="tabular-nums">{formatMoney(builderTotals.due)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowBuilderModal(false)}
                  className="min-h-[42px] px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="min-h-[42px] px-5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer"
                >
                  {invoiceType === 'sale' ? t.createSaleInvoice : t.createPurchaseBill}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Balance Payment Modal */}
      {payingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 no-print">
          <div className="w-full max-w-sm rounded-xl bg-white border border-slate-200 shadow-xl p-6">
            <h3 className="text-base font-bold text-slate-900">{t.recordPayment}</h3>
            <p className="text-xs text-slate-500 mt-1">
              {payingInvoice.invoiceNumber} · {payingInvoice.partyName}
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const addAmt = Math.max(
                  1,
                  Math.min(payingInvoice.balanceDue, Number(paymentInput) || 0)
                );
                await onRecordInvoicePayment(payingInvoice, addAmt);
                setPayingInvoice(null);
              }}
              className="mt-4 space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Amount Received ({currency}) — Due: {formatMoney(payingInvoice.balanceDue)}
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={payingInvoice.balanceDue}
                  value={paymentInput}
                  onChange={(e) => setPaymentInput(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 text-base font-bold border border-slate-300 rounded-lg tabular-nums"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPayingInvoice(null)}
                  className="min-h-[40px] px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer"
                >
                  Save Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Invoice / Thermal Receipt Modal */}
      {previewInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-xl bg-white border border-slate-200 shadow-2xl overflow-hidden my-8">
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-slate-50 border-b border-slate-200 no-print">
              <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
                <button
                  onClick={() => setPrintFormat('a4')}
                  className={`min-h-[34px] px-3 py-1 text-xs font-semibold rounded-md cursor-pointer ${
                    printFormat === 'a4' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  {t.standardA4}
                </button>
                <button
                  onClick={() => setPrintFormat('thermal')}
                  className={`min-h-[34px] px-3 py-1 text-xs font-semibold rounded-md cursor-pointer ${
                    printFormat === 'thermal'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  {t.thermalReceipt}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="min-h-[38px] inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>{t.printNow}</span>
                </button>
                <button
                  onClick={() => setPreviewInvoice(null)}
                  className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Area */}
            <div
              className={`p-8 mx-auto ${
                printFormat === 'thermal' ? 'max-w-xs text-xs font-mono' : 'w-full text-sm'
              }`}
            >
              <div className="border-b border-slate-300 pb-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{businessName}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {previewInvoice.invoiceType === 'sale'
                      ? 'Tax / Commercial Sales Invoice'
                      : 'Supplier Purchase Bill'}
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <div className="font-bold text-slate-900 tabular-nums">
                    {previewInvoice.invoiceNumber}
                  </div>
                  <div className="text-xs text-slate-500 tabular-nums">
                    {t.date}: {previewInvoice.invoiceDate}
                  </div>
                </div>
              </div>

              <div className="py-4 border-b border-slate-200 flex justify-between items-center text-xs">
                <div>
                  <span className="text-slate-500">{t.selectParty}: </span>
                  <strong className="text-slate-900">{previewInvoice.partyName}</strong>
                </div>
                <div>
                  <span className="text-slate-500">{t.paymentMethod}: </span>
                  <strong className="text-slate-900">
                    {pmLabels[previewInvoice.paymentMethod] || previewInvoice.paymentMethod}
                  </strong>
                </div>
              </div>

              <table className="w-full text-left border-collapse my-4 text-xs">
                <thead>
                  <tr className="border-b border-slate-300 text-slate-600 font-semibold">
                    <th className="py-2">{t.itemName}</th>
                    <th className="py-2 text-right">{t.quantity}</th>
                    <th className="py-2 text-right">{t.unitPrice}</th>
                    <th className="py-2 text-right">{t.lineTotal}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {parseItemsSummary(previewInvoice.itemsSummary).map((line, i) => (
                    <tr key={i}>
                      <td className="py-2.5 font-medium text-slate-900">{line.name}</td>
                      <td className="py-2.5 text-right tabular-nums">
                        {line.quantity} {line.unit}
                      </td>
                      <td className="py-2.5 text-right tabular-nums">
                        {formatMoney(line.unitPrice)}
                      </td>
                      <td className="py-2.5 text-right font-semibold tabular-nums">
                        {formatMoney(line.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="border-t border-slate-300 pt-4 space-y-1.5 text-xs max-w-xs ml-auto">
                <div className="flex justify-between">
                  <span className="text-slate-600">{t.subtotal}:</span>
                  <span className="font-semibold tabular-nums">
                    {formatMoney(previewInvoice.subtotal)}
                  </span>
                </div>
                {previewInvoice.discountAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">{t.discount}:</span>
                    <span className="tabular-nums">
                      -{formatMoney(previewInvoice.discountAmount)}
                    </span>
                  </div>
                )}
                {previewInvoice.taxAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">{t.taxAmount}:</span>
                    <span className="tabular-nums">+{formatMoney(previewInvoice.taxAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-200 pt-2">
                  <span>{t.grandTotal}:</span>
                  <span className="tabular-nums">{formatMoney(previewInvoice.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>{t.paidAmount}:</span>
                  <span className="tabular-nums">{formatMoney(previewInvoice.paidAmount)}</span>
                </div>
                <div className="flex justify-between text-red-700 font-bold">
                  <span>{t.balanceDue}:</span>
                  <span className="tabular-nums">{formatMoney(previewInvoice.balanceDue)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
