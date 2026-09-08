import { Role } from './types';

// Role tiers, low to high: Care Worker -> Supervisor -> Manager -> Owner.
// Mirrors the server-side tiers in src/apiApp.ts (REVIEW_TIER_ROLES /
// BUSINESS_ADMIN_ROLES) — keep both in sync. Supervisor is a shift-lead
// tier with full review/approval authority (incidents, reassessments,
// shift-change approvals) but not the business-admin screens reserved for
// Manager/Owner.
const CARE_WORKER_BLOCKED_TABS = ['reassessments', 'crm', 'compliance'];
const SUPERVISOR_BLOCKED_TABS = ['crm', 'compliance'];

export function getBlockedTabsForRole(role: Role | undefined): string[] {
  if (role === 'Care Worker') return CARE_WORKER_BLOCKED_TABS;
  if (role === 'Supervisor') return SUPERVISOR_BLOCKED_TABS;
  return [];
}

export function isReviewTier(role: Role | undefined): boolean {
  return role === 'Supervisor' || role === 'Manager' || role === 'Owner';
}

export function isBusinessAdminTier(role: Role | undefined): boolean {
  return role === 'Manager' || role === 'Owner';
}
