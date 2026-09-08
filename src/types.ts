export type Role = 'Care Worker' | 'Manager' | 'Owner';

export interface Organization {
  id: string;
  name: string;
}

export interface Home {
  id: string;
  organization_id: string;
  name: string;
  address: string;
  capacity: number;
  jurisdiction_code: string; // e.g. 'CA-NL'
}

export interface StaffCredential {
  id: string;
  type: 'Immunization Record' | 'Certificate of Conduct (Police / RNC)' | 'Vulnerable Sector Check' | 'Standard First Aid & CPR Level C';
  title: string;
  certificate_number: string;
  status: 'valid' | 'expiring_soon' | 'expired';
  expires_at: string;
  document_ref: string;
}

export interface Staff {
  id: string;
  home_id: string;
  name: string;
  role: Role;
  email: string;
  phone: string;
  mfa_enabled: boolean;
  schedule_type: 'rotating_shifts' | 'fixed_office';
  credentials: StaffCredential[];
}

export interface Shift {
  id: string;
  home_id: string;
  shift_type: 'Day Shift (07:00 - 19:00)' | 'Night Shift (19:00 - 07:00)' | 'Manager Schedule (Mon-Fri 09:00 - 15:00)';
  starts_at: string;
  ends_at: string;
  // How many staff should be on this shift at once. Drives the
  // "understaffed_shift" exception — owner-adjustable via seed data for now.
  required_staff_count: number;
}

export interface ShiftAssignment {
  id: string;
  staff_id: string;
  shift_id: string;
  date: string;
  clocked_in_at: string | null;
  clocked_out_at: string | null;
  is_active: boolean;
}

export interface JurisdictionRuleset {
  id: string;
  code: string;
  jurisdiction_code: string;
  name: string;
  version: number;
  effective_from: string;
  effective_to: string | null;
  required_staff_credential_types: string[];
  incident_record_immutability_required: boolean;
  compliance_review_frequency_days: number;
  reassessment_frequency_days: number;
  med_cart_lock_attestation_required: boolean;
  notes: string;
  rules: {
    reassessment_cycle_months: number;
    fire_drill_frequency_days: number;
    staff_ratio_day: string;
    staff_ratio_night: string;
    first_aid_recert_years: number;
    police_check_renewal_years: number;
    incident_report_retention_years: number;
  };
}

export type PipelineStage = 'Referral' | 'Assessment' | 'Tour' | 'Application' | 'Accepted' | 'Move-in';

export interface Prospect {
  id: string;
  home_id: string;
  full_name: string;
  age: number;
  referral_source: string;
  care_needs: string;
  funding_status: 'Subsidized - Eastern Health' | 'Private Pay' | 'Pending Assessment';
  pipeline_stage: PipelineStage;
  contact_phone: string;
  notes: string;
  created_at: string;
}

export type ResidentStatus = 'active' | 'on-leave' | 'discharged';

export interface Resident {
  id: string;
  home_id: string;
  prospect_id?: string;
  full_name: string;
  room_number: string;
  dob: string;
  age: number;
  status: ResidentStatus;
  admission_date: string;
  level_of_care: 'Level 1' | 'Level 2' | 'Level 3';
  funding_status: string;
  emergency_contact: {
    name: string;
    relationship: string;
    phone: string;
  };
  on_cigarette_program: boolean;
  primary_physician: string;
  allergies: string[];
}

export interface CarePlan {
  id: string;
  resident_id: string;
  version: number;
  status: 'active' | 'draft' | 'superseded';
  is_active?: boolean;
  created_at: string;
  signed_by_manager: string;
  signed_at: string;
  last_evaluated_date?: string;
  evaluated_by?: string;
  dietary_needs: string;
  dietary_notes?: string;
  mobility_needs: string;
  mobility_transfer_notes?: string;
  behavioral_triggers: string;
  adl_goals: string[] | string;
  supervision_level: string;
}

export interface Reassessment {
  id: string;
  resident_id: string;
  due_date: string;
  completed_date: string | null;
  completed_by: string | null;
  status: 'scheduled' | 'overdue' | 'completed';
  outcome_notes: string;
  resulting_care_plan_id: string | null;
}

export interface MedicationOrder {
  id: string;
  resident_id: string;
  drug_name: string;
  dose: string;
  route: 'Oral' | 'Sublingual' | 'Topical' | 'Inhalation' | 'Subcutaneous';
  schedule_times: string[]; // e.g. ["08:00", "12:00", "20:00"]
  prescriber: string;
  is_prn: boolean;
  indication: string;
}

export interface MedicationAdministration {
  id: string;
  order_id: string;
  resident_id: string;
  shift_id: string;
  administered_by: string;
  administered_by_name: string;
  timestamp: string;
  scheduled_time: string;
  dose_given: string;
  status: 'given' | 'missed' | 'refused' | 'held';
  notes: string;
  is_correction: boolean;
  ref_original_id?: string;
}

export interface DailyReportMeal {
  offered: boolean;
  eaten: 'all' | 'most' | 'half' | 'bites' | 'refused' | 'All' | 'Most' | 'Half' | 'Little' | 'Refused';
  notes?: string;
}

export interface DailyReport {
  id: string;
  resident_id: string;
  shift_id: string;
  date: string;
  authored_by: string;
  authored_by_name: string;
  meals: {
    breakfast: DailyReportMeal;
    lunch: DailyReportMeal;
    dinner: DailyReportMeal;
  };
  shower_taken: boolean;
  shower_notes?: string;
  skin_observations?: string;
  cigarette_program_given?: boolean | null;
  cigarette_count: number;
  cigarette_times: string[];
  general_observations: string;
  status: 'draft' | 'submitted';
  created_at?: string;
  submitted_at?: string | null;
}

export interface ShiftChecklist {
  id: string;
  shift_id: string;
  date: string;
  completed_by: string;
  completed_by_name: string;
  medication_storage_secured: boolean; // Explicit attestation for NL AG audit
  medication_count_verified: boolean;
  fridge_temp_celsius: number;
  safety_rounds_completed: boolean;
  emergency_exits_clear?: boolean;
  notes: string;
  completed_at?: string;
  timestamp?: string;
}

export type IncidentType =
  | 'behavioral'
  | 'self_harm'
  | 'substance_use'
  | 'medication_error'
  | 'fall_injury'
  | 'elopement'
  | 'property_damage'
  | 'medical_emergency'
  | 'other';

export type IncidentSeverity = 'Low' | 'Medium' | 'High' | 'Critical';

export type IncidentStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export interface IncidentReport {
  id: string;
  resident_id: string;
  home_id: string;
  reported_by: string;
  reported_by_name: string;
  occurred_at: string;
  reported_at: string;
  incident_type: IncidentType;
  severity: IncidentSeverity;
  description: string;
  type_details: Record<string, any>;
  status: IncidentStatus;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
}

export interface AuditEvent {
  id: string;
  actor_id: string;
  actor_name: string;
  action: string;
  resource_type: string;
  resource_id: string;
  payload: Record<string, any>;
  prior_event_id: string | null;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  recipient_role: string;
  recipient_name: string;
  channel: 'push' | 'sms' | 'in_app';
  title: string;
  body: string;
  created_at: string;
  read: boolean;
  urgency: 'routine' | 'high' | 'critical';
}

// ==========================================
// SCHEDULING & SHARED SHIFT TASKS
//
// A community care home shift isn't one person doing everything for one
// resident — it's 2-3 staff on days (one does showers, another does meds
// or breakfast) and usually one on nights (meds + cleaning + hourly
// walkthroughs). Tasks aren't rigidly pre-assigned to a specific staff
// member; they're generated for the shift/date and whoever is on duty
// claims and completes them. The owner controls which tasks apply to
// which shift type via ShiftTaskTemplate.
// ==========================================

export type TaskCategory = 'resident_care' | 'medication' | 'meal' | 'cleaning' | 'safety_check' | 'admin';

export interface TaskDefinition {
  id: string;
  home_id: string;
  name: string; // e.g. "Assist with Shower", "Prepare Breakfast", "Hourly Safety Walkthrough"
  category: TaskCategory;
  // Resident-specific tasks (e.g. a shower) generate one instance per active
  // resident; home-level tasks (e.g. cleaning, breakfast prep) generate one
  // shared instance any staff on shift can claim.
  applies_to: 'resident' | 'home';
  // 'once' generates a single instance for the shift; 'hourly' generates
  // one instance per hour of the shift's duration (e.g. safety walkthroughs).
  frequency: 'once' | 'hourly';
  is_active: boolean;
}

// Which tasks the owner has configured to occur on which shift type. This
// is the "owner should be able to adjust tasks" control surface — toggling
// a row on/off changes what gets generated for future shifts.
export interface ShiftTaskTemplate {
  id: string;
  home_id: string;
  shift_type: Shift['shift_type'];
  task_definition_id: string;
  is_active: boolean;
}

export type ShiftTaskStatus = 'pending' | 'claimed' | 'completed' | 'skipped' | 'missed';

// One generated instance of a task for a specific shift + date, optionally
// scoped to a resident. Generated automatically from ShiftTaskTemplate x
// active ShiftAssignments for that date; not manually created.
export interface ShiftTaskAssignment {
  id: string;
  home_id: string;
  shift_id: string;
  date: string;
  task_definition_id: string;
  task_name: string;
  category: TaskCategory;
  resident_id: string | null;
  status: ShiftTaskStatus;
  claimed_by: string | null;
  claimed_by_name: string | null;
  completed_by: string | null;
  completed_by_name: string | null;
  completed_at: string | null;
  notes: string | null;
}

// ==========================================
// EXCEPTIONS
//
// Detected automatically from the connected data (missed tasks, missed
// medications, overdue reassessments, expiring credentials, understaffed
// shifts) rather than manually reported — that's what distinguishes an
// "exception" from an IncidentReport, which a staff member files by hand.
// ==========================================

export type ExceptionType =
  | 'missed_task'
  | 'missed_medication'
  | 'overdue_reassessment'
  | 'expiring_credential'
  | 'understaffed_shift';

export type ExceptionSeverity = 'low' | 'medium' | 'high';
export type ExceptionStatus = 'open' | 'acknowledged' | 'resolved';

export interface ExceptionRecord {
  id: string;
  home_id: string;
  type: ExceptionType;
  severity: ExceptionSeverity;
  resident_id: string | null;
  resident_name: string | null;
  staff_id: string | null;
  staff_name: string | null;
  description: string;
  detected_at: string;
  status: ExceptionStatus;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  corrective_action: string | null;
}
