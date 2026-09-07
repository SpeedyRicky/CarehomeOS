import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  X,
  ShieldAlert,
  Clock,
  User,
  CheckCircle,
} from 'lucide-react';
import {
  IncidentReport,
  IncidentType,
  IncidentSeverity,
  Resident,
  MedicationOrder,
  Staff,
} from '../types';

interface NewIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  residents: Resident[];
  medOrders: MedicationOrder[];
  currentStaff: Staff;
  initialResidentId?: string;
  onSubmitIncident: (incident: IncidentReport) => void;
}

export const NewIncidentModal: React.FC<NewIncidentModalProps> = ({
  isOpen,
  onClose,
  residents,
  medOrders,
  currentStaff,
  initialResidentId,
  onSubmitIncident,
}) => {
  if (!isOpen) return null;

  const [residentId, setResidentId] = useState(initialResidentId || residents[0]?.id || '');
  const [incidentType, setIncidentType] = useState<IncidentType>('fall_injury');
  const [severity, setSeverity] = useState<IncidentSeverity>('Medium');
  const [description, setDescription] = useState('');
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString().slice(0, 16));

  // Type-specific details state matching §4a taxonomy
  const [target, setTarget] = useState<'Staff' | 'Resident' | 'Property'>('Staff');
  const [behaviorSubtype, setBehaviorSubtype] = useState<'Verbal' | 'Physical'>('Verbal');
  const [deEscalationUsed, setDeEscalationUsed] = useState('');

  const [selfHarmRiskObserved, setSelfHarmRiskObserved] = useState('');
  const [crisisContacted, setCrisisContacted] = useState(false);

  const [substanceName, setSubstanceName] = useState('');
  const [substanceFoundVsDisclosed, setSubstanceFoundVsDisclosed] = useState<'found' | 'disclosed'>('found');
  const [substanceLocation, setSubstanceLocation] = useState<'on-site' | 'off-site'>('on-site');

  const [linkedOrderId, setLinkedOrderId] = useState('');
  const [medErrorType, setMedErrorType] = useState<'wrong_dose' | 'wrong_time' | 'wrong_resident' | 'omission'>('wrong_dose');
  const [correctiveAction, setCorrectiveAction] = useState('');

  const [fallLocation, setFallLocation] = useState('Dining Room');
  const [fallWitnessed, setFallWitnessed] = useState(true);
  const [firstAidGiven, setFirstAidGiven] = useState(true);
  const [injuryDescription, setInjuryDescription] = useState('');

  const [elopementLastSeen, setElopementLastSeen] = useState('');
  const [searchInitiated, setSearchInitiated] = useState(true);
  const [elopementResolution, setElopementResolution] = useState('');

  const [propertyItem, setPropertyItem] = useState('');
  const [propertyCost, setPropertyCost] = useState('');

  const [emsCalled, setEmsCalled] = useState(false);
  const [emergencySymptoms, setEmergencySymptoms] = useState('');

  // Auto-suggest default severity per §4a
  const handleTypeChange = (newType: IncidentType) => {
    setIncidentType(newType);
    if (newType === 'self_harm' || newType === 'elopement' || newType === 'medical_emergency') {
      setSeverity('Critical');
    } else if (newType === 'substance_use' || newType === 'medication_error') {
      setSeverity('High');
    } else if (newType === 'behavioral' || newType === 'fall_injury') {
      setSeverity('Medium');
    } else if (newType === 'property_damage') {
      setSeverity('Low');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let typeDetails: Record<string, any> = {};

    switch (incidentType) {
      case 'behavioral':
        typeDetails = { target, subtype: behaviorSubtype, de_escalation_used: deEscalationUsed };
        break;
      case 'self_harm':
        typeDetails = { risk_observed: selfHarmRiskObserved, crisis_line_contacted: crisisContacted };
        break;
      case 'substance_use':
        typeDetails = {
          substance: substanceName,
          found_vs_disclosed: substanceFoundVsDisclosed,
          location: substanceLocation,
        };
        break;
      case 'medication_error':
        typeDetails = {
          linked_medication_order_id: linkedOrderId || medOrders[0]?.id,
          error_type: medErrorType,
          corrective_action: correctiveAction,
        };
        break;
      case 'fall_injury':
        typeDetails = {
          location: fallLocation,
          witnessed: fallWitnessed,
          first_aid_given: firstAidGiven,
          injury_description: injuryDescription,
        };
        break;
      case 'elopement':
        typeDetails = {
          last_seen_time: elopementLastSeen,
          search_initiated: searchInitiated,
          resolution: elopementResolution,
        };
        break;
      case 'property_damage':
        typeDetails = { item: propertyItem, estimated_cost: propertyCost };
        break;
      case 'medical_emergency':
        typeDetails = { ems_called: emsCalled, symptoms: emergencySymptoms };
        break;
      default:
        typeDetails = { general: 'Standard notes' };
    }

    const newIncident: IncidentReport = {
      id: `inc-${Date.now()}`,
      resident_id: residentId,
      home_id: 'home-nl-01',
      reported_by: currentStaff.id,
      reported_by_name: currentStaff.name,
      occurred_at: new Date(occurredAt).toISOString(),
      reported_at: new Date().toISOString(),
      incident_type: incidentType,
      severity,
      description,
      type_details: typeDetails,
      status: 'submitted',
      reviewed_by: null,
      reviewed_by_name: null,
      reviewed_at: null,
      rejection_reason: null,
    };

    onSubmitIncident(newIncident);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">New Structured Incident Report</h3>
              <p className="text-[11px] text-slate-500">
                §4a Typed Taxonomy Form · Auto-notifies Owner & Manager on submission
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Resident Involved *
              </label>
              <select
                value={residentId}
                onChange={(e) => setResidentId(e.target.value)}
                required
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
              >
                {residents.map((r) => (
                  <option key={r.id} value={r.id}>
                    Room {r.room_number}: {r.full_name} ({r.level_of_care})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Date & Time Occurred *
              </label>
              <input
                type="datetime-local"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                required
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>
          </div>

          {/* Incident Type Selector (§4a Taxonomy) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Incident Type (Drives Structured Fields) *
              </label>
              <select
                value={incidentType}
                onChange={(e) => handleTypeChange(e.target.value as IncidentType)}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white font-medium"
              >
                <option value="behavioral">Behavioral / Aggression</option>
                <option value="fall_injury">Fall / Injury</option>
                <option value="medication_error">Medication Error</option>
                <option value="self_harm">Self-Harm / Suicidal Ideation</option>
                <option value="substance_use">Substance Use / Relapse</option>
                <option value="elopement">Elopement / Missing Resident</option>
                <option value="property_damage">Property Damage</option>
                <option value="medical_emergency">Medical Emergency</option>
                <option value="other">Other / General</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Severity Rating (Drives Push Notification Urgency) *
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white font-bold"
              >
                <option value="Low">Low (Routine)</option>
                <option value="Medium">Medium (Prompt Notification)</option>
                <option value="High">High (Urgent Push Notification)</option>
                <option value="Critical">Critical (Immediate Push + SMS Alert)</option>
              </select>
            </div>
          </div>

          {/* DYNAMIC STRUCTURED FIELDS BASED ON INCIDENT TYPE (§4a) */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">
              Specific Taxonomy Fields: {incidentType.replace('_', ' ').toUpperCase()}
            </div>

            {incidentType === 'behavioral' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Target</label>
                  <select
                    value={target}
                    onChange={(e: any) => setTarget(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
                  >
                    <option value="Staff">Staff</option>
                    <option value="Resident">Resident</option>
                    <option value="Property">Property</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Subtype</label>
                  <select
                    value={behaviorSubtype}
                    onChange={(e: any) => setBehaviorSubtype(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
                  >
                    <option value="Verbal">Verbal</option>
                    <option value="Physical">Physical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">De-escalation Used</label>
                  <input
                    type="text"
                    value={deEscalationUsed}
                    onChange={(e) => setDeEscalationUsed(e.target.value)}
                    placeholder="e.g. Redirection, tea in quiet area"
                    className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5"
                  />
                </div>
              </div>
            )}

            {incidentType === 'fall_injury' && (
              <div className="space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Location</label>
                    <input
                      type="text"
                      value={fallLocation}
                      onChange={(e) => setFallLocation(e.target.value)}
                      placeholder="e.g. Bedroom, hallway, bathroom"
                      className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Witnessed?</label>
                    <select
                      value={fallWitnessed ? 'yes' : 'no'}
                      onChange={(e) => setFallWitnessed(e.target.value === 'yes')}
                      className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
                    >
                      <option value="yes">Yes (Witnessed)</option>
                      <option value="no">No (Found on floor)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">First Aid Given?</label>
                    <select
                      value={firstAidGiven ? 'yes' : 'no'}
                      onChange={(e) => setFirstAidGiven(e.target.value === 'yes')}
                      className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
                    >
                      <option value="yes">Yes (First aid administered)</option>
                      <option value="no">No (Not required)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Injury Description & Range of Motion</label>
                  <input
                    type="text"
                    value={injuryDescription}
                    onChange={(e) => setInjuryDescription(e.target.value)}
                    placeholder="e.g. Minor abrasion on left elbow, ROM intact, no hip tenderness"
                    className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5"
                  />
                </div>
              </div>
            )}

            {incidentType === 'medication_error' && (
              <div className="space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Linked Medication Order</label>
                    <select
                      value={linkedOrderId}
                      onChange={(e) => setLinkedOrderId(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
                    >
                      {medOrders.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.drug_name} ({o.dose})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Error Type</label>
                    <select
                      value={medErrorType}
                      onChange={(e: any) => setMedErrorType(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
                    >
                      <option value="wrong_dose">Wrong Dose</option>
                      <option value="wrong_time">Wrong Time</option>
                      <option value="wrong_resident">Wrong Resident</option>
                      <option value="omission">Omission / Missed</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Immediate Corrective Action & Physician Contact</label>
                  <input
                    type="text"
                    value={correctiveAction}
                    onChange={(e) => setCorrectiveAction(e.target.value)}
                    placeholder="e.g. Dr. Mercer notified, vitals taken q1h, resident stable"
                    className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5"
                  />
                </div>
              </div>
            )}

            {incidentType === 'self_harm' && (
              <div className="space-y-2.5">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Risk Indicators Observed</label>
                  <input
                    type="text"
                    value={selfHarmRiskObserved}
                    onChange={(e) => setSelfHarmRiskObserved(e.target.value)}
                    placeholder="e.g. Verbalized hopelessness, tearful, agitation"
                    className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="crisisContacted"
                    checked={crisisContacted}
                    onChange={(e) => setCrisisContacted(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  <label htmlFor="crisisContacted" className="text-xs text-slate-700 font-medium">
                    Provincial Mental Health Crisis Line (811) or Mobile Crisis Team Contacted
                  </label>
                </div>
              </div>
            )}

            {incidentType === 'substance_use' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Substance</label>
                  <input
                    type="text"
                    value={substanceName}
                    onChange={(e) => setSubstanceName(e.target.value)}
                    placeholder="e.g. Alcohol, unprescribed pills"
                    className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Discovery</label>
                  <select
                    value={substanceFoundVsDisclosed}
                    onChange={(e: any) => setSubstanceFoundVsDisclosed(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
                  >
                    <option value="found">Found on person/room</option>
                    <option value="disclosed">Disclosed by resident</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Location</label>
                  <select
                    value={substanceLocation}
                    onChange={(e: any) => setSubstanceLocation(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
                  >
                    <option value="on-site">On-site in home</option>
                    <option value="off-site">Off-site in community</option>
                  </select>
                </div>
              </div>
            )}

            {incidentType === 'elopement' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Last Seen Time</label>
                  <input
                    type="time"
                    value={elopementLastSeen}
                    onChange={(e) => setElopementLastSeen(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Search Initiated?</label>
                  <select
                    value={searchInitiated ? 'yes' : 'no'}
                    onChange={(e) => setSearchInitiated(e.target.value === 'yes')}
                    className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
                  >
                    <option value="yes">Yes (Immediate property search)</option>
                    <option value="no">No</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Resolution</label>
                  <input
                    type="text"
                    value={elopementResolution}
                    onChange={(e) => setElopementResolution(e.target.value)}
                    placeholder="e.g. Located on garden bench"
                    className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5"
                  />
                </div>
              </div>
            )}

            {incidentType === 'medical_emergency' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="emsCalled"
                    checked={emsCalled}
                    onChange={(e) => setEmsCalled(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  <label htmlFor="emsCalled" className="text-xs text-slate-800 font-bold">
                    EMS (911 Ambulance) Dispatched
                  </label>
                </div>
                <input
                  type="text"
                  value={emergencySymptoms}
                  onChange={(e) => setEmergencySymptoms(e.target.value)}
                  placeholder="e.g. Chest pain, diaphoresis, dyspnea. Transported to St. Clare's Mercy Hospital"
                  className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Factual Incident Narrative Description *
            </label>
            <textarea
              rows={3}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe factually what happened, who was present, immediate care provided, and resident status."
              className="w-full text-xs border border-slate-300 rounded-lg p-3"
            />
          </div>

          <div className="text-[11px] text-slate-500 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
            <strong>State Machine Rule:</strong> Submitting locks the record from author edits and generates an immediate alert to Owner & Manager. Approval waits for Manager/Owner review with strict segregation of duties (author cannot approve).
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 shadow-xs flex items-center gap-1.5"
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Submit Incident Report</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
