// Exceptions are detected automatically from the connected data — a missed
// task, a missed medication, an overdue reassessment, an expiring
// credential, an understaffed shift — rather than reported by hand the way
// an IncidentReport is. Nothing here is stored: every call recomputes the
// current list fresh from live state, then merges in whatever review
// decisions a Manager/Owner has already recorded (dbState.exceptionReviews)
// so acknowledging or resolving one sticks across reads.
import type { DbState } from './apiApp';
import type { ExceptionRecord, ExceptionType, ExceptionSeverity } from './types';

interface RawException {
  id: string;
  type: ExceptionType;
  severity: ExceptionSeverity;
  resident_id: string | null;
  staff_id: string | null;
  description: string;
  detected_at: string;
}

// A shift ending at, say, 19:00 the same day it started is straightforward;
// an overnight shift (19:00 -> 07:00) ends the NEXT calendar day. This
// resolves the actual end Date for a shift that started on `date`.
function shiftEndDateTime(date: string, startsAt: string, endsAt: string): Date {
  const start = new Date(`${date}T${startsAt}:00`);
  const end = new Date(`${date}T${endsAt}:00`);
  if (end <= start) {
    end.setDate(end.getDate() + 1);
  }
  return end;
}

export function computeExceptions(dbState: DbState): ExceptionRecord[] {
  const raw: RawException[] = [];
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  // 1. Missed shared shift tasks — the shift they belonged to has ended and
  // they were never claimed/completed or were explicitly skipped-without-cause.
  for (const task of dbState.shiftTaskAssignments) {
    if (task.status === 'completed' || task.status === 'skipped') continue;
    const shift = dbState.shifts.find((s) => s.id === task.shift_id);
    if (!shift) continue;
    const end = shiftEndDateTime(task.date, shift.starts_at, shift.ends_at);
    if (now > end) {
      raw.push({
        id: `exc-missed_task-${task.id}`,
        type: 'missed_task',
        severity: task.category === 'medication' ? 'high' : 'medium',
        resident_id: task.resident_id,
        staff_id: null,
        description: `"${task.task_name}" was not completed during ${shift.shift_type} on ${task.date}.`,
        detected_at: end.toISOString(),
      });
    }
  }

  // 2. Missed medications — more than an hour past a non-PRN scheduled time
  // with no matching administration recorded today.
  const GRACE_MS = 60 * 60 * 1000;
  for (const order of dbState.medOrders) {
    const resident = dbState.residents.find((r) => r.id === order.resident_id);
    if (!resident || resident.status !== 'active') continue;
    for (const time of order.schedule_times) {
      if (time === 'PRN') continue;
      const scheduled = new Date(`${today}T${time}:00`);
      if (now.getTime() - scheduled.getTime() <= GRACE_MS) continue;
      const given = dbState.medAdmins.some(
        (a) => a.order_id === order.id && a.scheduled_time === time && a.timestamp.startsWith(today)
      );
      if (!given) {
        raw.push({
          id: `exc-missed_medication-${order.id}-${time}-${today}`,
          type: 'missed_medication',
          severity: 'high',
          resident_id: resident.id,
          staff_id: null,
          description: `${order.drug_name} ${order.dose} scheduled ${time} for ${resident.full_name} has not been recorded as administered.`,
          detected_at: scheduled.toISOString(),
        });
      }
    }
  }

  // 3. Overdue reassessments
  for (const r of dbState.reassessments) {
    const isOverdue = r.status === 'overdue' || (r.status === 'scheduled' && r.due_date < today);
    if (!isOverdue) continue;
    const resident = dbState.residents.find((rr) => rr.id === r.resident_id);
    raw.push({
      id: `exc-overdue_reassessment-${r.id}`,
      type: 'overdue_reassessment',
      severity: 'high',
      resident_id: r.resident_id,
      staff_id: null,
      description: `Reassessment for ${resident?.full_name || r.resident_id} was due ${r.due_date}.`,
      detected_at: `${r.due_date}T00:00:00.000Z`,
    });
  }

  // 4. Expiring / expired staff credentials
  for (const staff of dbState.staff) {
    for (const cred of staff.credentials) {
      if (cred.status !== 'expiring_soon' && cred.status !== 'expired') continue;
      raw.push({
        id: `exc-expiring_credential-${cred.id}`,
        type: 'expiring_credential',
        severity: cred.status === 'expired' ? 'high' : 'medium',
        resident_id: null,
        staff_id: staff.id,
        description:
          cred.status === 'expired'
            ? `${staff.name}'s ${cred.title} expired ${cred.expires_at}.`
            : `${staff.name}'s ${cred.title} expires ${cred.expires_at}.`,
        detected_at: now.toISOString(),
      });
    }
  }

  // 5. Understaffed shifts today
  for (const shift of dbState.shifts) {
    const count = dbState.shiftAssignments.filter((a) => a.shift_id === shift.id && a.date === today).length;
    if (count < shift.required_staff_count) {
      raw.push({
        id: `exc-understaffed_shift-${shift.id}-${today}`,
        type: 'understaffed_shift',
        severity: 'high',
        resident_id: null,
        staff_id: null,
        description: `${shift.shift_type} on ${today} has ${count} of ${shift.required_staff_count} required staff scheduled.`,
        detected_at: now.toISOString(),
      });
    }
  }

  const severityRank: Record<ExceptionSeverity, number> = { high: 0, medium: 1, low: 2 };

  return raw
    .map((e): ExceptionRecord => {
      const review = dbState.exceptionReviews[e.id];
      return {
        id: e.id,
        home_id: dbState.home.id,
        type: e.type,
        severity: e.severity,
        resident_id: e.resident_id,
        resident_name: e.resident_id ? dbState.residents.find((r) => r.id === e.resident_id)?.full_name || null : null,
        staff_id: e.staff_id,
        staff_name: e.staff_id ? dbState.staff.find((s) => s.id === e.staff_id)?.name || null : null,
        description: e.description,
        detected_at: e.detected_at,
        status: review?.status || 'open',
        reviewed_by: review?.reviewed_by || null,
        reviewed_by_name: review?.reviewed_by_name || null,
        reviewed_at: review?.reviewed_at || null,
        corrective_action: review?.corrective_action || null,
      };
    })
    .sort((a, b) => {
      const sevDiff = severityRank[a.severity] - severityRank[b.severity];
      if (sevDiff !== 0) return sevDiff;
      return new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime();
    });
}
