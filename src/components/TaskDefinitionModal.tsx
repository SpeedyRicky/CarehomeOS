import React, { useState } from 'react';
import { ClipboardList, X } from 'lucide-react';
import { TaskDefinition, TaskCategory, Shift } from '../types';

const CATEGORY_LABELS: Record<TaskCategory, string> = {
  resident_care: 'Resident Care',
  medication: 'Medication',
  meal: 'Meal',
  cleaning: 'Cleaning',
  safety_check: 'Safety Check',
  admin: 'Admin',
};

interface TaskDefinitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  allShiftTypes: Shift['shift_type'][];
  // Undefined means "create a new task"; passing an existing definition
  // (plus which shift types it's currently active on) pre-fills the form
  // for editing in place.
  existingTaskDefinition?: TaskDefinition;
  existingActiveShiftTypes?: Shift['shift_type'][];
  onSave: (taskDefinition: TaskDefinition, selectedShiftTypes: Shift['shift_type'][]) => void;
}

export const TaskDefinitionModal: React.FC<TaskDefinitionModalProps> = ({
  isOpen,
  onClose,
  allShiftTypes,
  existingTaskDefinition,
  existingActiveShiftTypes,
  onSave,
}) => {
  if (!isOpen) return null;

  const isEditing = !!existingTaskDefinition;

  const [name, setName] = useState(existingTaskDefinition?.name || '');
  const [category, setCategory] = useState<TaskCategory>(existingTaskDefinition?.category || 'cleaning');
  const [appliesTo, setAppliesTo] = useState<'resident' | 'home'>(existingTaskDefinition?.applies_to || 'home');
  const [frequency, setFrequency] = useState<'once' | 'hourly'>(existingTaskDefinition?.frequency || 'once');
  const [isActive, setIsActive] = useState(existingTaskDefinition?.is_active ?? true);
  const [selectedShiftTypes, setSelectedShiftTypes] = useState<Shift['shift_type'][]>(
    existingActiveShiftTypes || []
  );
  const [error, setError] = useState('');

  const toggleShiftType = (shiftType: Shift['shift_type']) => {
    setSelectedShiftTypes((prev) =>
      prev.includes(shiftType) ? prev.filter((s) => s !== shiftType) : [...prev, shiftType]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Give the task a name.');
      return;
    }
    if (selectedShiftTypes.length === 0) {
      setError('Pick at least one shift this task should occur on.');
      return;
    }
    const taskDefinition: TaskDefinition = {
      id: existingTaskDefinition?.id || '',
      home_id: existingTaskDefinition?.home_id || '',
      name: name.trim(),
      category,
      applies_to: appliesTo,
      frequency,
      is_active: isActive,
    };
    onSave(taskDefinition, selectedShiftTypes);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <ClipboardList className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">{isEditing ? 'Edit Shared Duty' : 'Add Shared Duty'}</h3>
              <p className="text-[11px] text-slate-500">
                {appliesTo === 'home'
                  ? 'One shared instance any staff on shift can claim (e.g. housecleaning, breakfast prep).'
                  : 'One instance is generated per active resident.'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Task Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Housecleaning – Common Areas"
              required
              className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TaskCategory)}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
              >
                {(Object.keys(CATEGORY_LABELS) as TaskCategory[]).map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Applies To</label>
              <select
                value={appliesTo}
                onChange={(e) => setAppliesTo(e.target.value as 'resident' | 'home')}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
              >
                <option value="home">Shared (whole home)</option>
                <option value="resident">Per resident</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Frequency</label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as 'once' | 'hourly')}
              className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
            >
              <option value="once">Once per shift</option>
              <option value="hourly">Every hour of the shift</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Occurs On</label>
            <div className="space-y-1.5">
              {allShiftTypes.map((shiftType) => (
                <label
                  key={shiftType}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 hover:border-slate-300 transition cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedShiftTypes.includes(shiftType)}
                    onChange={() => toggleShiftType(shiftType)}
                    className="w-4 h-4 accent-emerald-600"
                  />
                  <span className="text-xs text-slate-700">{shiftType}</span>
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 accent-emerald-600"
            />
            <span className="text-xs text-slate-700">Task is active</span>
          </label>

          {error && (
            <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition"
            >
              {isEditing ? 'Save Changes' : 'Add Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
