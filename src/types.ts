export type Role = 'Care Worker' | 'Supervisor' | 'Manager' | 'Owner';

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
  // NOTE: password_hash / MFA secrets are never stored on this shared type.
  // They live only in the server-side credential store (src/seedData.auth.ts
  // in this prototype; a dedicated `staff_credentials_auth` table in
  // production) and are never sent to the client. See SECURITY.md.
}

export interface Shift {
  id: string;
  home_id: string;
  shift_type: 'Day Shift (07:00 - 19:00)' | 'Night Shift (19:00 - 07:00)' | 'Manager Schedule (Mon-Fri 09:00 - 15:00)';
  starts_at: string;
  ends_at: string;
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
// SCHEDULING: shift templates, time entries, shift change requests
// ==========================================

export interface ShiftTemplate {
  id: string;
  home_id: string;
  name: string;
  starts_at: string; // HH:MM, home-local time
  ends_at: string; // HH:MM, home-local time
  days_of_week: number[]; // 0=Sunday .. 6=Saturday
  required_staff_count: number;
  required_credential_types: string[];
  is_active: boolean;
}

export type TimeEntryType = 'clock_in' | 'clock_out' | 'break_start' | 'break_end';
export type TimeEntrySource = 'app' | 'quickbooks_time' | 'manual_correction';

export interface TimeEntry {
  id: string;
  home_id: string;
  staff_id: string;
  shift_assignment_id: string | null;
  entry_type: TimeEntryType;
  timestamp: string;
  source: TimeEntrySource;
  is_corrected: boolean;
  corrected_by: string | null;
  correction_reason: string | null;
  // QuickBooks Time (Intuit TSheets) sync bookkeeping — see
  // src/services/quickbooksTimeService.ts and SECURITY.md.
  qbo_synced: boolean;
  qbo_sync_id: string | null;
  qbo_sync_error: string | null;
}

export type ShiftChangeRequestType = 'swap' | 'cover' | 'time_off';
export type ShiftChangeRequestStatus = 'pending' | 'approved' | 'denied' | 'cancelled';

export interface ShiftChangeRequest {
  id: string;
  home_id: string;
  shift_assignment_id: string;
  requested_by: string;
  requested_by_name: string;
  request_type: ShiftChangeRequestType;
  target_staff_id: string | null;
  target_staff_name: string | null;
  reason: string;
  status: ShiftChangeRequestStatus;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
}
