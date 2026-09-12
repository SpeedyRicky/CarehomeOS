import React, { useState } from 'react';
import { Settings2, Plus, Pencil } from 'lucide-react';
import { TaskDefinition, ShiftTaskTemplate, Shift } from '../types';
import { TaskDefinitionModal } from './TaskDefinitionModal';

interface ShiftTaskSetupPanelProps {
  taskDefinitions: TaskDefinition[];
  shiftTaskTemplates: ShiftTaskTemplate[];
  shiftTypes: Shift['shift_type'][];
  onToggleShiftTaskTemplate: (template: ShiftTaskTemplate) => void;
  onSaveTaskDefinition: (taskDefinition: TaskDefinition, selectedShiftTypes: Shift['shift_type'][]) => void;
}

// Manager+Owner control surface for the shared duties every shift draws
// from — housecleaning, meal prep, safety walkthroughs, etc. Toggling a
// checkbox flips an existing ShiftTaskTemplate; "Add Task" (or clicking an
// existing task's name) opens TaskDefinitionModal to create or edit the
// underlying TaskDefinition and which shifts it applies to.
export const ShiftTaskSetupPanel: React.FC<ShiftTaskSetupPanelProps> = ({
  taskDefinitions,
  shiftTaskTemplates,
  shiftTypes,
  onToggleShiftTaskTemplate,
  onSaveTaskDefinition,
}) => {
  const [modalTaskDef, setModalTaskDef] = useState<TaskDefinition | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const activeShiftTypesFor = (taskDefinitionId: string): Shift['shift_type'][] =>
    shiftTaskTemplates
      .filter((t) => t.task_definition_id === taskDefinitionId && t.is_active)
      .map((t) => t.shift_type);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <Settings2 className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-bold text-slate-900">Shared Shift Duties</h2>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Add or edit the shared tasks staff claim on shift — housecleaning, meal prep, safety walkthroughs — and which shifts each one occurs on.
          </p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Task
        </button>
      </div>
      <div className="divide-y divide-slate-100">
        {shiftTypes.map((shiftType) => {
          const templatesForShift = shiftTaskTemplates.filter((t) => t.shift_type === shiftType);
          return (
            <div key={shiftType} className="p-4">
              <div className="text-xs font-bold text-slate-700 mb-2">{shiftType}</div>
              {templatesForShift.length === 0 ? (
                <p className="text-xs text-slate-400">No tasks configured for this shift yet.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {templatesForShift.map((template) => {
                    const taskDef = taskDefinitions.find((td) => td.id === template.task_definition_id);
                    if (!taskDef) return null;
                    return (
                      <div
                        key={template.id}
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-100 hover:border-slate-200 transition"
                      >
                        <button
                          type="button"
                          onClick={() => setModalTaskDef(taskDef)}
                          className="flex items-center gap-1.5 text-xs text-slate-700 hover:text-emerald-700 text-left"
                        >
                          <Pencil className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>
                            {taskDef.name}
                            <span className="text-slate-400"> · {taskDef.applies_to === 'resident' ? 'per resident' : 'shared'}</span>
                          </span>
                        </button>
                        <input
                          type="checkbox"
                          checked={template.is_active}
                          onChange={() => onToggleShiftTaskTemplate(template)}
                          className="w-4 h-4 accent-emerald-600 shrink-0"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <TaskDefinitionModal
        isOpen={isAdding}
        onClose={() => setIsAdding(false)}
        allShiftTypes={shiftTypes}
        onSave={onSaveTaskDefinition}
      />
      <TaskDefinitionModal
        isOpen={!!modalTaskDef}
        onClose={() => setModalTaskDef(null)}
        allShiftTypes={shiftTypes}
        existingTaskDefinition={modalTaskDef || undefined}
        existingActiveShiftTypes={modalTaskDef ? activeShiftTypesFor(modalTaskDef.id) : undefined}
        onSave={onSaveTaskDefinition}
      />
    </div>
  );
};
