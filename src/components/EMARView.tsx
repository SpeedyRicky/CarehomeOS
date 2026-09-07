import React, { useState } from 'react';
import {
  Pill,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Plus,
  Search,
  Filter,
  ShieldCheck,
  History,
  X,
} from 'lucide-react';
import {
  MedicationOrder,
  MedicationAdministration,
  Resident,
  Staff,
  ShiftAssignment,
} from '../types';

interface EMARViewProps {
  medOrders: MedicationOrder[];
  medAdmins: MedicationAdministration[];
  residents: Resident[];
  currentStaff: Staff;
  activeAssignment: ShiftAssignment | undefined;
  onAdministerMed: (data: {
    orderId: string;
    residentId: string;
    shiftId: string;
    administeredBy: string;
    administeredByName: string;
    doseGiven: string;
    status: 'given' | 'missed' | 'refused' | 'held';
    notes: string;
    scheduledTime: string;
  }) => void;
}

export const EMARView: React.FC<EMARViewProps> = ({
  medOrders,
  medAdmins,
  residents,
  currentStaff,
  activeAssignment,
  onAdministerMed,
}) => {
  const [selectedResidentId, setSelectedResidentId] = useState<string>('all');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('all');
  const [activeModalOrder, setActiveModalOrder] = useState<MedicationOrder | null>(null);

  // Form states for active administration modal
  const [doseGiven, setDoseGiven] = useState('');
  const [adminStatus, setAdminStatus] = useState<'given' | 'missed' | 'refused' | 'held'>('given');
  const [adminNotes, setAdminNotes] = useState('');
  const [adminTimeSlot, setAdminTimeSlot] = useState('08:00');

  const todayDate = new Date().toISOString().split('T')[0];

  const filteredOrders = medOrders.filter((order) => {
    if (selectedResidentId !== 'all' && order.resident_id !== selectedResidentId) return false;
    if (selectedTimeSlot !== 'all') {
      if (selectedTimeSlot === 'PRN') return order.is_prn;
      return order.schedule_times.includes(selectedTimeSlot);
    }
    return true;
  });

  const handleOpenAdminister = (order: MedicationOrder, defaultTime: string = '08:00') => {
    setActiveModalOrder(order);
    setDoseGiven(order.dose);
    setAdminStatus('given');
    setAdminNotes('');
    setAdminTimeSlot(order.is_prn ? 'PRN' : defaultTime);
  };

  const handleConfirmAdministration = () => {
    if (!activeModalOrder) return;
    onAdministerMed({
      orderId: activeModalOrder.id,
      residentId: activeModalOrder.resident_id,
      shiftId: activeAssignment?.shift_id || 'shift-day-today',
      administeredBy: currentStaff.id,
      administeredByName: currentStaff.name,
      doseGiven: doseGiven || activeModalOrder.dose,
      status: adminStatus,
      notes: adminNotes,
      scheduledTime: adminTimeSlot,
    });
    setActiveModalOrder(null);
  };

  return (
    <div className="space-y-6">
      {/* Module Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                eMAR — Electronic Medication Administration Record
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                Audit Verified
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Every medication pass generates an immutable, timestamped event row underneath. Corrections append new entries referencing original records.
            </p>
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={selectedResidentId}
              onChange={(e) => setSelectedResidentId(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg px-3 py-1.5 bg-white text-slate-800"
            >
              <option value="all">All Residents (18 Beds)</option>
              {residents.map((r) => (
                <option key={r.id} value={r.id}>
                  Room {r.room_number}: {r.full_name}
                </option>
              ))}
            </select>

            <select
              value={selectedTimeSlot}
              onChange={(e) => setSelectedTimeSlot(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg px-3 py-1.5 bg-white text-slate-800"
            >
              <option value="all">All Scheduled Passes</option>
              <option value="08:00">08:00 Morning Pass</option>
              <option value="12:00">12:00 Lunch Pass</option>
              <option value="18:00">18:00 Dinner Pass</option>
              <option value="20:00">20:00 Night Pass</option>
              <option value="PRN">PRN (As-Needed)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders & Administration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Medication Orders List */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Active Physician Medication Orders ({filteredOrders.length})
            </h2>
            <span className="text-[11px] text-slate-400">
              Double-check 5 Rights before administration
            </span>
          </div>

          <div className="space-y-3">
            {filteredOrders.map((order) => {
              const resident = residents.find((r) => r.id === order.resident_id);

              return (
                <div
                  key={order.id}
                  className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-slate-300 transition"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{order.drug_name}</span>
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold text-xs border border-blue-100">
                          {order.dose}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-mono">
                          {order.route}
                        </span>
                        {order.is_prn && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                            PRN
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-600 mt-1">
                        Resident: <strong className="text-slate-900">{resident?.full_name}</strong> (Room {resident?.room_number}) · Indication: {order.indication}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Prescriber: {order.prescriber} · Scheduled Times: {order.schedule_times.join(', ')}
                      </div>
                    </div>

                    {/* Action buttons per scheduled pass */}
                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      {order.schedule_times.map((time) => {
                        const existingAdmin = medAdmins.find(
                          (a) =>
                            a.order_id === order.id &&
                            a.scheduled_time === time &&
                            a.timestamp.startsWith(todayDate)
                        );

                        if (existingAdmin) {
                          return (
                            <span
                              key={time}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{time}: {existingAdmin.status.toUpperCase()}</span>
                            </span>
                          );
                        }

                        return (
                          <button
                            key={time}
                            onClick={() => handleOpenAdminister(order, time)}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-xs font-semibold shadow-xs flex items-center gap-1 transition"
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span>Pass {time}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Col: Today's Immutable Administration Audit Trail */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <History className="w-3.5 h-3.5" />
              <span>Today’s Administration Log ({medAdmins.length})</span>
            </h2>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono">
              Immutable
            </span>
          </div>

          <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 max-h-[560px] overflow-y-auto space-y-2.5">
            {medAdmins.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No medication passes logged today.</p>
            ) : (
              medAdmins.map((adm) => {
                const order = medOrders.find((o) => o.id === adm.order_id);
                const resident = residents.find((r) => r.id === adm.resident_id);

                return (
                  <div
                    key={adm.id}
                    className="bg-white rounded-lg border border-slate-200 p-3 text-xs shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">
                        {order?.drug_name || 'Medication'} ({adm.dose_given})
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                          adm.status === 'given'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {adm.status}
                      </span>
                    </div>
                    <div className="text-slate-600 mt-0.5">
                      {resident?.full_name} · Room {resident?.room_number}
                    </div>
                    {adm.notes && (
                      <div className="mt-1 text-[11px] text-slate-500 italic bg-slate-50 p-1.5 rounded">
                        "{adm.notes}"
                      </div>
                    )}
                    <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                      <span>By: {adm.administered_by_name}</span>
                      <span>{new Date(adm.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Administer Medication Dialog Modal */}
      {activeModalOrder && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Pill className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Administer Medication</h3>
                  <p className="text-[11px] text-slate-500">eMAR Record Attestation</p>
                </div>
              </div>
              <button
                onClick={() => setActiveModalOrder(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                <div className="font-bold text-slate-900 text-sm">{activeModalOrder.drug_name}</div>
                <div className="text-slate-600 mt-0.5">
                  Order Dose: <strong>{activeModalOrder.dose}</strong> · Route: <strong>{activeModalOrder.route}</strong>
                </div>
                <div className="text-slate-500 mt-0.5">
                  Indication: {activeModalOrder.indication}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Scheduled Pass Time
                </label>
                <input
                  type="text"
                  value={adminTimeSlot}
                  onChange={(e) => setAdminTimeSlot(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Dose Given
                </label>
                <input
                  type="text"
                  value={doseGiven}
                  onChange={(e) => setDoseGiven(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Status
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['given', 'refused', 'missed', 'held'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setAdminStatus(st)}
                      className={`py-1.5 rounded-lg text-xs font-bold uppercase transition ${
                        adminStatus === st
                          ? st === 'given'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-rose-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Clinical Notes / Observations (Optional)
                </label>
                <textarea
                  rows={2}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="e.g. Taken with morning applesauce. BP checked 130/80."
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5"
                />
              </div>

              <div className="text-[11px] text-slate-500 bg-blue-50 p-2.5 rounded-lg border border-blue-200 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  Administered by <strong>{currentStaff.name}</strong> ({currentStaff.role}). Record is immutable upon confirmation.
                </span>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveModalOrder(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAdministration}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs"
              >
                Sign & Log Administration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
