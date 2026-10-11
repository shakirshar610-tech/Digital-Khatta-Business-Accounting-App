import React, { useMemo, useState } from 'react';
import {
  Plus,
  Calendar,
  Wallet,
  Trash2,
  Edit3,
  Printer,
  X,
} from 'lucide-react';
import {
  AttendanceRecord,
  AttendanceState,
  EmploymentStatus,
  Language,
  PayrollRecord,
  StaffMember,
} from '../types';
import { translations, paymentMethodLabels } from '../i18n/translations';

interface StaffPayrollModuleProps {
  lang: Language;
  currency: string;
  businessName: string;
  staffMembers: StaffMember[];
  attendanceRecords: AttendanceRecord[];
  payrollRecords: PayrollRecord[];
  onSaveStaff: (
    staff: Omit<StaffMember, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) => Promise<void>;
  onDeleteStaff: (staffId: string) => Promise<void>;
  onMarkAttendance: (
    staff: StaffMember,
    date: string,
    state: AttendanceState,
    overtimeHours: number,
    notes: string
  ) => Promise<void>;
  onDisbursePayroll: (
    payroll: Omit<PayrollRecord, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>,
    deductFromAdvance: number
  ) => Promise<void>;
}

export const StaffPayrollModule: React.FC<StaffPayrollModuleProps> = ({
  lang,
  currency,
  businessName,
  staffMembers,
  attendanceRecords,
  payrollRecords,
  onSaveStaff,
  onDeleteStaff,
  onMarkAttendance,
  onDisbursePayroll,
}) => {
  const t = translations[lang];
  const pmLabels = paymentMethodLabels[lang];

  const [subTab, setSubTab] = useState<'attendance' | 'directory' | 'payroll'>('attendance');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  // Staff Modal
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [staffForm, setStaffForm] = useState({
    name: '',
    roleTitle: '',
    phone: '',
    monthlySalary: '',
    advanceBalance: '0',
    joiningDate: new Date().toISOString().slice(0, 10),
    employmentStatus: 'active' as EmploymentStatus,
  });

  // Disburse Salary Modal
  const [payingStaff, setPayingStaff] = useState<StaffMember | null>(null);
  const [payrollForm, setPayrollForm] = useState({
    baseSalary: 0,
    overtimePay: 0,
    deductions: 0,
    paymentMethod: 'cash' as PayrollRecord['paymentMethod'],
  });

  const [slipPreview, setSlipPreview] = useState<PayrollRecord | null>(null);

  const activeStaff = useMemo(
    () => staffMembers.filter((s) => s.employmentStatus !== 'terminated'),
    [staffMembers]
  );

  // Map attendance for selectedDate
  const dateAttendanceMap = useMemo(() => {
    const map: Record<string, AttendanceRecord> = {};
    for (const rec of attendanceRecords) {
      if (rec.attendanceDate === selectedDate) {
        map[rec.staffId] = rec;
      }
    }
    return map;
  }, [attendanceRecords, selectedDate]);

  // Monthly attendance summary per staff member for selectedMonth
  const monthlyCalculations = useMemo(() => {
    return staffMembers.map((staff) => {
      const records = attendanceRecords.filter(
        (r) => r.staffId === staff.id && r.attendanceDate.startsWith(selectedMonth)
      );
      let presentDays = 0;
      let absentDays = 0;
      let halfDays = 0;
      let leaveDays = 0;
      let totalOvertimeHours = 0;

      for (const r of records) {
        if (r.attendanceState === 'present') presentDays += 1;
        else if (r.attendanceState === 'absent') absentDays += 1;
        else if (r.attendanceState === 'half_day') halfDays += 1;
        else if (r.attendanceState === 'paid_leave') leaveDays += 1;
        totalOvertimeHours += r.overtimeHours || 0;
      }

      const dailyRate = Math.round(staff.monthlySalary / 30);
      const hourlyRate = Math.round(dailyRate / 8);
      const overtimePay = totalOvertimeHours * hourlyRate;
      const absenceDeduction = absentDays * dailyRate + Math.round(halfDays * (dailyRate / 2));

      return {
        staff,
        presentDays,
        absentDays,
        halfDays,
        leaveDays,
        totalOvertimeHours,
        overtimePay,
        absenceDeduction,
      };
    });
  }, [staffMembers, attendanceRecords, selectedMonth]);

  const openAddStaff = () => {
    setEditingStaff(null);
    setStaffForm({
      name: '',
      roleTitle: '',
      phone: '',
      monthlySalary: '',
      advanceBalance: '0',
      joiningDate: new Date().toISOString().slice(0, 10),
      employmentStatus: 'active',
    });
    setShowStaffModal(true);
  };

  const openEditStaff = (staff: StaffMember) => {
    setEditingStaff(staff);
    setStaffForm({
      name: staff.name,
      roleTitle: staff.roleTitle,
      phone: staff.phone,
      monthlySalary: String(staff.monthlySalary),
      advanceBalance: String(staff.advanceBalance),
      joiningDate: staff.joiningDate,
      employmentStatus: staff.employmentStatus,
    });
    setShowStaffModal(true);
  };

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = staffForm.name.trim().slice(0, 120);
    const cleanRole = staffForm.roleTitle.trim().slice(0, 80);
    const sal = Math.min(10000000, Number(staffForm.monthlySalary) || 0);
    if (!cleanName || !cleanRole || sal <= 0) return;

    await onSaveStaff(
      {
        name: cleanName,
        roleTitle: cleanRole,
        phone: staffForm.phone.trim().slice(0, 30),
        monthlySalary: sal,
        advanceBalance: Math.max(0, Math.min(10000000, Number(staffForm.advanceBalance) || 0)),
        joiningDate: staffForm.joiningDate,
        employmentStatus: staffForm.employmentStatus,
      },
      editingStaff?.id
    );
    setShowStaffModal(false);
  };

  const openDisburseModal = (calc: (typeof monthlyCalculations)[number]) => {
    setPayingStaff(calc.staff);
    const suggestedDeduction = calc.absenceDeduction + calc.staff.advanceBalance;
    setPayrollForm({
      baseSalary: calc.staff.monthlySalary,
      overtimePay: calc.overtimePay,
      deductions: suggestedDeduction,
      paymentMethod: 'cash',
    });
  };

  const handleDisburseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingStaff) return;
    const net = Math.max(
      0,
      payrollForm.baseSalary + payrollForm.overtimePay - payrollForm.deductions
    );
    const advanceRecovered = Math.min(payingStaff.advanceBalance, payrollForm.deductions);

    await onDisbursePayroll(
      {
        staffId: payingStaff.id,
        staffName: payingStaff.name,
        monthYear: selectedMonth,
        baseSalary: payrollForm.baseSalary,
        overtimePay: payrollForm.overtimePay,
        deductions: payrollForm.deductions,
        netPaid: net,
        paymentMethod: payrollForm.paymentMethod,
        paymentDate: new Date().toISOString().slice(0, 10),
      },
      advanceRecovered
    );
    setPayingStaff(null);
  };

  const formatMoney = (val: number) =>
    `${currency} ${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t.staffTitle}</h1>
          <p className="text-sm text-slate-600 mt-1">{t.staffSubtitle}</p>
        </div>
        <button
          onClick={openAddStaff}
          className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t.addStaffMember}</span>
        </button>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
          {(['attendance', 'directory', 'payroll'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setSubTab(tab)}
              className={`min-h-[38px] px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                subTab === tab
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab === 'attendance'
                ? t.tabAttendance
                : tab === 'directory'
                ? t.tabDirectory
                : t.tabPayroll}
            </button>
          ))}
        </div>

        {subTab === 'attendance' && (
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="min-h-[38px] px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white tabular-nums"
            />
          </div>
        )}

        {subTab === 'payroll' && (
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="min-h-[38px] px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white tabular-nums"
            />
          </div>
        )}
      </div>

      {/* Sub-Tab 1: Daily Attendance Sheet */}
      {subTab === 'attendance' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden no-print">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">{t.roleDesignation}</th>
                  <th className="py-3 px-4">Attendance Status ({selectedDate})</th>
                  <th className="py-3 px-4 text-right">{t.overtimeHours}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {activeStaff.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-slate-500">
                      No active staff members. Add a staff member to mark attendance.
                    </td>
                  </tr>
                ) : (
                  activeStaff.map((staff) => {
                    const currentRec = dateAttendanceMap[staff.id];
                    const currentState = currentRec?.attendanceState || null;
                    const currentOt = currentRec?.overtimeHours || 0;

                    return (
                      <tr key={staff.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-slate-900">{staff.name}</td>
                        <td className="py-3.5 px-4 text-slate-600">{staff.roleTitle}</td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {(
                              [
                                { key: 'present', label: t.present, activeCls: 'bg-emerald-600 text-white' },
                                { key: 'absent', label: t.absent, activeCls: 'bg-red-600 text-white' },
                                { key: 'half_day', label: t.halfDay, activeCls: 'bg-amber-600 text-white' },
                                { key: 'paid_leave', label: t.paidLeave, activeCls: 'bg-slate-800 text-white' },
                              ] as const
                            ).map((st) => (
                              <button
                                key={st.key}
                                onClick={() =>
                                  onMarkAttendance(
                                    staff,
                                    selectedDate,
                                    st.key,
                                    currentOt,
                                    currentRec?.notes || ''
                                  )
                                }
                                className={`min-h-[36px] px-3 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                                  currentState === st.key
                                    ? st.activeCls
                                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                {st.label}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <input
                            type="number"
                            min={0}
                            max={24}
                            value={currentOt}
                            onChange={(e) => {
                              const ot = Math.max(0, Math.min(24, Number(e.target.value) || 0));
                              onMarkAttendance(
                                staff,
                                selectedDate,
                                currentState || 'present',
                                ot,
                                currentRec?.notes || ''
                              );
                            }}
                            className="w-20 min-h-[36px] px-2.5 py-1 text-right border border-slate-300 rounded-md tabular-nums font-semibold"
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub-Tab 2: Staff Directory & Advances */}
      {subTab === 'directory' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden no-print">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 px-4">Staff Name</th>
                  <th className="py-3 px-4">{t.roleDesignation}</th>
                  <th className="py-3 px-4">{t.phone}</th>
                  <th className="py-3 px-4 text-right">{t.monthlySalary}</th>
                  <th className="py-3 px-4 text-right">{t.advanceBalance}</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {staffMembers.map((staff) => (
                  <tr key={staff.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{staff.name}</div>
                      <div className="text-[11px] text-slate-500 tabular-nums">
                        Joined {staff.joiningDate}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-700">{staff.roleTitle}</td>
                    <td className="py-3 px-4 text-slate-600 tabular-nums">{staff.phone || '—'}</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900 tabular-nums">
                      {formatMoney(staff.monthlySalary)}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-amber-700 tabular-nums">
                      {staff.advanceBalance > 0 ? formatMoney(staff.advanceBalance) : '—'}
                    </td>
                    <td className="py-3 px-4 capitalize font-medium text-slate-700">
                      {staff.employmentStatus}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        {staff.employmentStatus !== 'terminated' && (
                          <button
                            onClick={() => openEditStaff(staff)}
                            className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                            title="Edit Staff / Advance"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => onDeleteStaff(staff.id)}
                          className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub-Tab 3: Monthly Payroll & Salary Slips */}
      {subTab === 'payroll' && (
        <div className="space-y-6 no-print">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70">
              <h3 className="text-xs font-bold text-slate-800">
                Payroll Calculator ({selectedMonth})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-4">Attendance Summary</th>
                    <th className="py-3 px-4 text-right">{t.baseSalary}</th>
                    <th className="py-3 px-4 text-right">{t.overtimePay}</th>
                    <th className="py-3 px-4 text-right">{t.advanceBalance}</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {monthlyCalculations.map((calc) => (
                    <tr key={calc.staff.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-semibold text-slate-900">{calc.staff.name}</td>
                      <td className="py-3 px-4 text-slate-600 tabular-nums">
                        {calc.presentDays}P · {calc.absentDays}A · {calc.halfDays}HD ·{' '}
                        {calc.totalOvertimeHours}h OT
                      </td>
                      <td className="py-3 px-4 text-right font-semibold tabular-nums">
                        {formatMoney(calc.staff.monthlySalary)}
                      </td>
                      <td className="py-3 px-4 text-right text-emerald-700 font-semibold tabular-nums">
                        +{formatMoney(calc.overtimePay)}
                      </td>
                      <td className="py-3 px-4 text-right text-amber-700 font-semibold tabular-nums">
                        {formatMoney(calc.staff.advanceBalance)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => openDisburseModal(calc)}
                          className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 cursor-pointer"
                        >
                          <Wallet className="w-3.5 h-3.5" />
                          <span>{t.disburseSalary}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Disbursed Salary Slips History */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70">
              <h3 className="text-xs font-bold text-slate-800">Disbursed Salary Slips</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                    <th className="py-3 px-4">Period</th>
                    <th className="py-3 px-4">Staff Name</th>
                    <th className="py-3 px-4 text-right">{t.baseSalary}</th>
                    <th className="py-3 px-4 text-right">{t.overtimePay}</th>
                    <th className="py-3 px-4 text-right">{t.deductions}</th>
                    <th className="py-3 px-4 text-right">{t.netPaid}</th>
                    <th className="py-3 px-4 text-right">Slip</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {payrollRecords.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        No salary disbursements recorded yet.
                      </td>
                    </tr>
                  ) : (
                    payrollRecords.map((pr) => (
                      <tr key={pr.id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-4 font-semibold tabular-nums">{pr.monthYear}</td>
                        <td className="py-3 px-4 font-medium text-slate-900">{pr.staffName}</td>
                        <td className="py-3 px-4 text-right tabular-nums">
                          {formatMoney(pr.baseSalary)}
                        </td>
                        <td className="py-3 px-4 text-right text-emerald-700 tabular-nums">
                          +{formatMoney(pr.overtimePay)}
                        </td>
                        <td className="py-3 px-4 text-right text-red-700 tabular-nums">
                          -{formatMoney(pr.deductions)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900 tabular-nums">
                          {formatMoney(pr.netPaid)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setSlipPreview(pr)}
                            className="min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Print Slip</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Staff Modal */}
      {showStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 no-print">
          <div className="w-full max-w-md rounded-xl bg-white border border-slate-200 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">
                {editingStaff ? 'Edit Staff Member' : t.addStaffMember}
              </h3>
              <button
                onClick={() => setShowStaffModal(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleStaffSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={staffForm.name}
                  onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                  className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.roleDesignation} *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={80}
                    value={staffForm.roleTitle}
                    onChange={(e) => setStaffForm({ ...staffForm, roleTitle: e.target.value })}
                    className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.phone}
                  </label>
                  <input
                    type="text"
                    maxLength={30}
                    value={staffForm.phone}
                    onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
                    className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.monthlySalary} ({currency}) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={10000000}
                    value={staffForm.monthlySalary}
                    onChange={(e) => setStaffForm({ ...staffForm, monthlySalary: e.target.value })}
                    className="w-full min-h-[42px] px-3 py-2 text-sm font-bold border border-slate-300 rounded-lg tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.advanceBalance} ({currency})
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={10000000}
                    value={staffForm.advanceBalance}
                    onChange={(e) =>
                      setStaffForm({ ...staffForm, advanceBalance: e.target.value })
                    }
                    className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.joiningDate}
                  </label>
                  <input
                    type="date"
                    required
                    value={staffForm.joiningDate}
                    onChange={(e) => setStaffForm({ ...staffForm, joiningDate: e.target.value })}
                    className="w-full min-h-[42px] px-3 py-2 text-xs border border-slate-300 rounded-lg tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={staffForm.employmentStatus}
                    onChange={(e) =>
                      setStaffForm({
                        ...staffForm,
                        employmentStatus: e.target.value as EmploymentStatus,
                      })
                    }
                    className="w-full min-h-[42px] px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="terminated">Terminated</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowStaffModal(false)}
                  className="min-h-[42px] px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="min-h-[42px] px-5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer"
                >
                  Save Staff
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Disburse Salary Modal */}
      {payingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 no-print">
          <div className="w-full max-w-md rounded-xl bg-white border border-slate-200 shadow-xl p-6">
            <h3 className="text-base font-bold text-slate-900">
              {t.disburseSalary} — {payingStaff.name}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Payroll Period: {selectedMonth}</p>

            <form onSubmit={handleDisburseSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.baseSalary}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={payrollForm.baseSalary}
                    onChange={(e) =>
                      setPayrollForm({ ...payrollForm, baseSalary: Number(e.target.value) || 0 })
                    }
                    className="w-full min-h-[40px] px-3 py-1.5 text-sm border border-slate-300 rounded-lg tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.overtimePay}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={payrollForm.overtimePay}
                    onChange={(e) =>
                      setPayrollForm({ ...payrollForm, overtimePay: Number(e.target.value) || 0 })
                    }
                    className="w-full min-h-[40px] px-3 py-1.5 text-sm border border-slate-300 rounded-lg tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.deductions}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={payrollForm.deductions}
                    onChange={(e) =>
                      setPayrollForm({ ...payrollForm, deductions: Number(e.target.value) || 0 })
                    }
                    className="w-full min-h-[40px] px-3 py-1.5 text-sm border border-slate-300 rounded-lg tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.paymentMethod}
                  </label>
                  <select
                    value={payrollForm.paymentMethod}
                    onChange={(e) =>
                      setPayrollForm({
                        ...payrollForm,
                        paymentMethod: e.target.value as PayrollRecord['paymentMethod'],
                      })
                    }
                    className="w-full min-h-[40px] px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    {(['cash', 'bank', 'jazzcash', 'easypaisa'] as const).map((m) => (
                      <option key={m} value={m}>
                        {pmLabels[m]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">{t.netPaid}:</span>
                <span className="text-lg font-bold text-emerald-700 tabular-nums">
                  {formatMoney(
                    Math.max(
                      0,
                      payrollForm.baseSalary + payrollForm.overtimePay - payrollForm.deductions
                    )
                  )}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPayingStaff(null)}
                  className="min-h-[40px] px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="min-h-[40px] px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer"
                >
                  Confirm & Pay
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Salary Slip Modal */}
      {slipPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200 no-print">
              <h3 className="text-sm font-bold text-slate-900">Employee Salary Slip</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{t.printNow}</span>
                </button>
                <button
                  onClick={() => setSlipPreview(null)}
                  className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-500 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="border-b border-slate-200 pb-3">
                <h2 className="text-base font-bold text-slate-900">{businessName}</h2>
                <p className="text-slate-500">Salary Disbursement Voucher · {slipPreview.monthYear}</p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Employee Name:</span>
                  <strong className="text-slate-900">{slipPreview.staffName}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Date:</span>
                  <span className="tabular-nums">{slipPreview.paymentDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t.baseSalary}:</span>
                  <span className="font-semibold tabular-nums">
                    {formatMoney(slipPreview.baseSalary)}
                  </span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span>{t.overtimePay}:</span>
                  <span className="font-semibold tabular-nums">
                    +{formatMoney(slipPreview.overtimePay)}
                  </span>
                </div>
                <div className="flex justify-between text-red-700">
                  <span>{t.deductions}:</span>
                  <span className="font-semibold tabular-nums">
                    -{formatMoney(slipPreview.deductions)}
                  </span>
                </div>
                <div className="border-t border-slate-200 pt-2 flex justify-between text-sm font-bold text-slate-900">
                  <span>{t.netPaid}:</span>
                  <span className="tabular-nums">{formatMoney(slipPreview.netPaid)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
