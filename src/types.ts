export type Language = 'en' | 'ur';
export type CurrencyCode = 'PKR' | 'USD' | 'AED' | 'SAR' | 'GBP';

export type NavSection =
  | 'dashboard'
  | 'khata'
  | 'inventory'
  | 'invoices'
  | 'expenses'
  | 'staff';

export interface UserProfile {
  ownerId: string;
  businessName: string;
  businessCategory: string;
  currency: CurrencyCode;
  language: Language;
  createdAt: string;
  updatedAt: string;
}

export type PartyType = 'customer' | 'supplier';

export interface Party {
  id: string;
  ownerId: string;
  name: string;
  phone: string;
  address: string;
  partyType: PartyType;
  balance: number; // positive = You Will Get (Receivable), negative = You Will Give (Payable)
  totalDebit: number;
  totalCredit: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type EntryType = 'debit' | 'credit';
export type PaymentMethod = 'cash' | 'bank' | 'jazzcash' | 'easypaisa' | 'cheque' | 'credit';

export interface KhataEntry {
  id: string;
  ownerId: string;
  partyId: string;
  partyName: string;
  entryType: EntryType; // debit = You Gave (Udhaar/Payment Given), credit = You Got (Wusooli/Payment Received)
  amount: number;
  paymentMethod: PaymentMethod;
  referenceNo: string;
  description: string;
  entryDate: string;
  createdAt: string;
  updatedAt: string;
}

export type InventoryUnit = 'pcs' | 'kg' | 'bag' | 'carton' | 'liter' | 'meter' | 'box' | 'dozen';

export interface InventoryItem {
  id: string;
  ownerId: string;
  name: string;
  sku: string;
  category: string;
  unit: InventoryUnit;
  purchasePrice: number;
  salePrice: number;
  stockQuantity: number;
  lowStockThreshold: number;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceLineItem {
  itemId: string;
  name: string;
  unit: InventoryUnit;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export type InvoiceType = 'sale' | 'purchase';
export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'cancelled';

export interface Invoice {
  id: string;
  ownerId: string;
  invoiceNumber: string;
  invoiceType: InvoiceType;
  partyId: string;
  partyName: string;
  itemsSummary: string; // serialized JSON or formatted summary <= 1500 chars
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  paymentMethod: PaymentMethod;
  invoiceStatus: InvoiceStatus;
  invoiceDate: string;
  createdAt: string;
  updatedAt: string;
}

export type ExpenseCategory =
  | 'rent'
  | 'utilities'
  | 'refreshments'
  | 'transport'
  | 'packaging'
  | 'maintenance'
  | 'payroll'
  | 'marketing'
  | 'other';

export interface Expense {
  id: string;
  ownerId: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  paymentMethod: 'cash' | 'bank' | 'jazzcash' | 'easypaisa' | 'cheque';
  referenceNo: string;
  notes: string;
  expenseDate: string;
  createdAt: string;
  updatedAt: string;
}

export type EmploymentStatus = 'active' | 'inactive' | 'terminated';

export interface StaffMember {
  id: string;
  ownerId: string;
  name: string;
  roleTitle: string;
  phone: string;
  monthlySalary: number;
  advanceBalance: number;
  joiningDate: string;
  employmentStatus: EmploymentStatus;
  createdAt: string;
  updatedAt: string;
}

export type AttendanceState = 'present' | 'absent' | 'half_day' | 'paid_leave';

export interface AttendanceRecord {
  id: string;
  ownerId: string;
  staffId: string;
  staffName: string;
  attendanceDate: string;
  attendanceState: AttendanceState;
  overtimeHours: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollRecord {
  id: string;
  ownerId: string;
  staffId: string;
  staffName: string;
  monthYear: string; // YYYY-MM
  baseSalary: number;
  overtimePay: number;
  deductions: number;
  netPaid: number;
  paymentMethod: 'cash' | 'bank' | 'jazzcash' | 'easypaisa';
  paymentDate: string;
  createdAt: string;
  updatedAt: string;
}

export type SyncCollectionName =
  | 'parties'
  | 'khata_entries'
  | 'inventory_items'
  | 'invoices'
  | 'expenses'
  | 'staff_members'
  | 'attendance_records'
  | 'payroll_records';

export interface SyncQueueItem {
  id: string;
  collection: SyncCollectionName;
  docId: string;
  action: 'create' | 'update' | 'delete';
  payload?: Record<string, unknown>;
  timestamp: string;
}

export interface BackupPayload {
  appVersion: string;
  exportedAt: string;
  checksum: string;
  businessProfile: UserProfile;
  parties: Party[];
  khataEntries: KhataEntry[];
  inventoryItems: InventoryItem[];
  invoices: Invoice[];
  expenses: Expense[];
  staffMembers: StaffMember[];
  attendanceRecords: AttendanceRecord[];
  payrollRecords: PayrollRecord[];
}
