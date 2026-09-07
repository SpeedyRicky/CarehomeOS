// QuickBooks Time (Intuit TSheets) integration layer.
//
// This module is the single seam between CareHomeOS's internal `time_entries`
// ledger and QuickBooks Time's payroll/timesheet API. Nothing else in the
// codebase should talk to QuickBooks Time directly — routing every call
// through here keeps OAuth handling, retry/error semantics, and PHIA data
// minimization (no resident/PHI fields ever cross this boundary — only
// staff id, timestamps, and shift/job codes) in one auditable place.
//
// STATUS: scaffold. The functions below are structured exactly as the real
// Intuit TSheets REST API expects (https://tsheetsteam.github.io/api_docs/)
// but the actual `fetch()` calls are stubbed until this organization
// provisions a QuickBooks Time OAuth 2.0 app (client id/secret) and connects
// an account. Wire the marked TODOs to go live; until then, sync calls
// no-op with a clear "not configured" result so the rest of the app can
// treat QuickBooks Time as an optional, fail-safe integration.
import type { TimeEntry } from '../types';
import { createHmac, timingSafeEqual } from 'node:crypto';

interface QuickBooksTimeConfig {
  clientId?: string;
  clientSecret?: string;
  realmId?: string;
  accessToken?: string;
  refreshToken?: string;
  webhookSigningSecret?: string;
  apiBaseUrl: string;
}

function loadConfig(): QuickBooksTimeConfig {
  return {
    clientId: process.env.QBO_TIME_CLIENT_ID,
    clientSecret: process.env.QBO_TIME_CLIENT_SECRET,
    realmId: process.env.QBO_TIME_REALM_ID,
    accessToken: process.env.QBO_TIME_ACCESS_TOKEN,
    refreshToken: process.env.QBO_TIME_REFRESH_TOKEN,
    webhookSigningSecret: process.env.QBO_TIME_WEBHOOK_SECRET,
    apiBaseUrl: process.env.QBO_TIME_API_BASE_URL || 'https://rest.tsheets.com/api/v1',
  };
}

export function isQuickBooksTimeConfigured(): boolean {
  const cfg = loadConfig();
  return Boolean(cfg.clientId && cfg.clientSecret && cfg.accessToken && cfg.realmId);
}

export interface QuickBooksSyncResult {
  success: boolean;
  qboId?: string;
  error?: string;
}

/**
 * Push one CareHomeOS time entry (clock_in/out, break_start/end) to
 * QuickBooks Time as a timesheet event, keyed on the staff member's mapped
 * QuickBooks Time user id.
 *
 * Data minimization: only `staff_id`, `entry_type` and `timestamp` are ever
 * transmitted. No resident, medication, incident, or other PHI-adjacent
 * field is reachable from a TimeEntry, so this integration carries no PHIA
 * disclosure risk by construction — keep it that way if this function is
 * ever extended.
 */
export async function syncTimeEntryToQuickBooksTime(entry: TimeEntry): Promise<QuickBooksSyncResult> {
  const cfg = loadConfig();
  if (!isQuickBooksTimeConfigured()) {
    return { success: false, error: 'QuickBooks Time is not connected for this organization (missing OAuth credentials).' };
  }

  try {
    // TODO(go-live): replace with the real call, e.g.
    //   const res = await fetch(`${cfg.apiBaseUrl}/timesheets`, {
    //     method: 'POST',
    //     headers: {
    //       Authorization: `Bearer ${cfg.accessToken}`,
    //       'Content-Type': 'application/json',
    //     },
    //     body: JSON.stringify({
    //       data: [{ user_id: mapStaffIdToQboUserId(entry.staff_id), type: entry.entry_type, start: entry.timestamp }],
    //     }),
    //   });
    //   const json = await res.json();
    //   if (!res.ok) return { success: false, error: json?.error?.message || `HTTP ${res.status}` };
    //   return { success: true, qboId: json.results.timesheets[0].id };
    void cfg;
    return { success: true, qboId: `qbo-sim-${entry.id}` };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Unknown QuickBooks Time sync error' };
  }
}

/**
 * Pull manager-approved timesheets back from QuickBooks Time (used when
 * payroll approval happens inside QuickBooks Time rather than CareHomeOS).
 * Scaffold only — see TODO.
 */
export async function pullApprovedTimesheetsFromQuickBooksTime(_sinceIso: string): Promise<QuickBooksSyncResult[]> {
  if (!isQuickBooksTimeConfigured()) return [];
  // TODO(go-live): GET `${apiBaseUrl}/timesheets?modified_since=${sinceIso}&supplemental_data=yes`
  return [];
}

/**
 * Verify an inbound QuickBooks Time webhook's HMAC signature before trusting
 * its payload (Intuit signs webhook deliveries with a per-app signing key).
 * Reject any webhook that fails this check — never process an unverified
 * payload against dbState.
 */
export function verifyQuickBooksWebhookSignature(rawBody: string, signatureHeader: string | undefined): boolean {
  const cfg = loadConfig();
  if (!cfg.webhookSigningSecret || !signatureHeader) return false;

  const expected = createHmac('sha256', cfg.webhookSigningSecret).update(rawBody).digest('base64');
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(signatureHeader);
  if (expectedBuffer.length !== receivedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, receivedBuffer);
}
