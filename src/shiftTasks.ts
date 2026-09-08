// Generates shared shift-task instances (ShiftTaskAssignment rows) for a
// given date, from the owner-configured ShiftTaskTemplate catalog crossed
// with whichever staff are actually scheduled that day. Tasks are not
// pre-assigned to a specific staff member — 2-3 day staff split the work
// organically (one does showers, another does meds or breakfast), so a
// task instance sits unclaimed until whoever is on that shift claims it.
//
// Generation is idempotent per shift+date: calling this repeatedly (every
// time the task board is read) only creates tasks that don't exist yet.
import type { DbState } from './apiApp';
import type { ShiftTaskAssignment, TaskDefinition, Shift } from './types';

function hourBlocksBetween(startsAt: string, endsAt: string): string[] {
  const startHour = parseInt(startsAt.split(':')[0], 10);
  const endHour = parseInt(endsAt.split(':')[0], 10);
  const hours: number[] = [];
  let h = startHour;
  while (hours.length < 24) {
    hours.push(h);
    if (h === endHour) break;
    h = (h + 1) % 24;
  }
  return hours.map((hh) => `${String(hh).padStart(2, '0')}:00`);
}

function makeTask(
  shift: Shift,
  date: string,
  taskDef: TaskDefinition,
  residentId: string | null,
  hourLabel?: string
): ShiftTaskAssignment {
  const idSuffix = [shift.id, date, taskDef.id, residentId || 'home', hourLabel || ''].join('-');
  return {
    id: `stask-${idSuffix}`,
    home_id: shift.home_id,
    shift_id: shift.id,
    date,
    task_definition_id: taskDef.id,
    task_name: hourLabel ? `${taskDef.name} (${hourLabel})` : taskDef.name,
    category: taskDef.category,
    resident_id: residentId,
    status: 'pending',
    claimed_by: null,
    claimed_by_name: null,
    completed_by: null,
    completed_by_name: null,
    completed_at: null,
    notes: null,
  };
}

export function ensureShiftTasksGenerated(dbState: DbState, date: string): void {
  const shiftIdsToday = new Set(
    dbState.shiftAssignments.filter((a) => a.date === date).map((a) => a.shift_id)
  );

  for (const shiftId of shiftIdsToday) {
    const alreadyGenerated = dbState.shiftTaskAssignments.some(
      (t) => t.shift_id === shiftId && t.date === date
    );
    if (alreadyGenerated) continue;

    const shift = dbState.shifts.find((s) => s.id === shiftId);
    if (!shift) continue;

    const templates = dbState.shiftTaskTemplates.filter(
      (t) => t.shift_type === shift.shift_type && t.is_active
    );

    for (const template of templates) {
      const taskDef = dbState.taskDefinitions.find(
        (td) => td.id === template.task_definition_id && td.is_active
      );
      if (!taskDef) continue;

      if (taskDef.applies_to === 'resident') {
        const activeResidents = dbState.residents.filter((r) => r.status === 'active');
        for (const resident of activeResidents) {
          dbState.shiftTaskAssignments.push(makeTask(shift, date, taskDef, resident.id));
        }
      } else if (taskDef.frequency === 'hourly') {
        for (const hourLabel of hourBlocksBetween(shift.starts_at, shift.ends_at)) {
          dbState.shiftTaskAssignments.push(makeTask(shift, date, taskDef, null, hourLabel));
        }
      } else {
        dbState.shiftTaskAssignments.push(makeTask(shift, date, taskDef, null));
      }
    }
  }
}
