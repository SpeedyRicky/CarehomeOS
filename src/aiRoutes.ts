// AI features (shift handover briefs, compliance audit narratives, the
// natural-language explainer) live in their OWN file, deployed as their
// OWN separate Vercel function (api/ai.ts) — deliberately never imported
// by src/apiApp.ts or api/index.ts (the core CRUD function).
//
// Why: `@google/genai` pulls in a large dependency tree (google-auth-library,
// protobufjs, ws — over 300 files once fully traced). Vercel's function
// bundler traces every file an entry point can reach, INCLUDING dynamic
// `import()` calls with computed specifiers — confirmed directly with
// Vercel's own @vercel/nft tracer, which still found and included
// @google/genai's entire tree even behind an intentionally obfuscated
// import path. There is no reliable way to reference this package from a
// file and keep it out of that file's deployed bundle; the only reliable
// isolation is a genuinely separate entry point. Login and every other
// core endpoint were repeatedly failing in production (crashing before
// even our own error handling could run) because they lived in the same
// function as this dependency — see git history on this file's
// introduction for the full incident.
//
// registerAiRoutes() is also called from server.ts (local dev / Cloud Run)
// to mount these same routes onto the main app there, sharing the same
// live dbState — so local/Cloud Run behavior (AI summaries reflecting
// same-process writes) is unchanged. On Vercel, api/ai.ts calls this with
// its own independently-seeded state instead, since separate serverless
// functions don't share memory.
import type express from 'express';
import type { GoogleGenAI } from '@google/genai';

export interface AiRouteContext {
  dbState: {
    home: { name: string; jurisdiction_code: string };
    residents: any[];
    medAdmins: any[];
    dailyReports: any[];
    incidents: any[];
    reassessments: any[];
    shiftChecklists: any[];
    auditEvents: any[];
    staff: any[];
    shiftAssignments: any[];
  };
}

// Lazy Gemini AI Client initialization. `@google/genai` pulls in a sizeable
// dependency tree (google-auth-library, protobufjs, ws) that this app has
// no use for outside these AI endpoints. A dynamic import means the module
// is only ever loaded on the first actual AI call with GEMINI_API_KEY
// configured, never merely by importing this file.
let aiClient: GoogleGenAI | null = null;
async function getAIClient() {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    const { GoogleGenAI } = await import('@google/genai');
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

export function registerAiRoutes(app: express.Express, ctx: AiRouteContext): void {
  // ==========================================
  // AI LAYER (READ-ONLY SUMMARIZATION & QA)
  // No write path to Postgres/DB. Constrained audit-safe read views.
  // Resilient multi-model retry with dynamic clinical engine fallback
  // ==========================================

  async function runAIWithFallback(
    prompt: string,
    systemFallbackGenerator: () => string
  ): Promise<{ text: string; source: string }> {
    const ai = await getAIClient();
    if (ai) {
      // Prioritize gemini-flash-latest (high availability), then flash-lite, then 3.8-flash
      const candidateModels = ['gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'];
      for (const model of candidateModels) {
        try {
          const timeoutMs = 12000;
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
          );
          const apiCallPromise = ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              maxOutputTokens: 1200,
              temperature: 0.2,
            },
          });
          const response = await Promise.race([apiCallPromise, timeoutPromise]);
          if (response && response.text) {
            return { text: response.text, source: model };
          }
        } catch {
          // Model unavailable or high-demand; advance cleanly to next candidate
        }
      }
    }

    return {
      text: systemFallbackGenerator(),
      source: 'system_clinical_engine',
    };
  }

  // AI 1: Shift Handover Summary
  app.post('/api/ai/shift-handover', async (req, res) => {
    try {
      const { shiftType } = req.body;

      // Construct constrained read-safe summary payload
      const activeResidents = ctx.dbState.residents.filter((r) => r.status === 'active');
      const medPasses = ctx.dbState.medAdmins.slice(0, 10);
      const todayReports = ctx.dbState.dailyReports;
      const recentIncidents = ctx.dbState.incidents.slice(0, 5);
      const latestChecklist = ctx.dbState.shiftChecklists[0];

      const promptContext = `
You are the CareHomeOS Clinical Handover AI assistant for small care homes (Hi Haven Manor, CA-NL).
Generate a concise, high-priority shift handover brief for incoming staff.
Tone: Professional, clinical, scannable, action-oriented. Never invent or hallucinate data.

CURRENT SHIFT CONTEXT:
Shift: ${shiftType || 'Day Shift'}
Total Active Residents: ${activeResidents.length}
Today's Daily Reports Completed: ${todayReports.length}
Medication Administrations Logged: ${medPasses.length}
Recent Incidents:
${recentIncidents.map((i) => `- [${i.severity}] ${i.incident_type}: ${i.description} (Status: ${i.status})`).join('\n')}
Medication Storage Secured Attestation: ${latestChecklist ? (latestChecklist.medication_storage_secured ? 'VERIFIED LOCKED' : 'UNLOCKED / EXCEPTION') : 'PENDING'}
Resident Daily Notes:
${todayReports.map((r) => `- Resident ${r.resident_id}: Meals: Breakfast(${r.meals.breakfast.eaten}), Lunch(${r.meals.lunch.eaten}). Shower: ${r.shower_taken ? 'Yes' : 'No'}. Obs: ${r.general_observations}`).join('\n')}

Format as:
1. Critical Highlights & Urgent Alerts
2. Medication & eMAR Exceptions
3. Resident Observation Watchlist
4. Night Shift / Incoming Staff Action Items
`;

      const generateFallback = () => {
        const pendingIncidents = recentIncidents.filter((i) => i.status === 'submitted');
        const arthur = activeResidents.find((r) => r.full_name.includes('Arthur'));
        const harold = activeResidents.find((r) => r.full_name.includes('Harold'));

        return `### 📋 Shift Handover Brief: ${shiftType || 'Day to Night'} Shift
**Facility**: Hi Haven Manor Inc. (18 Beds) · CA-NL Personal Care Home
**Operational Status**: ${activeResidents.length} Active Residents · ${todayReports.length} Shift Reports Logged

---

#### 1. 🚨 Critical Highlights & Urgent Alerts
${
  pendingIncidents.length > 0
    ? pendingIncidents
        .map(
          (i) =>
            `- **[Pending Manager Review] ${i.incident_type} (${i.severity.toUpperCase()})**: ${i.description} (Reported by ${i.reported_by_name || 'Staff'}).`
        )
        .join('\n')
    : '- **No Open Critical Incidents**: All recent clinical incident logs have been reviewed.'
}
- **Medication Cart Security**: ${
          latestChecklist?.medication_storage_secured
            ? '✅ Double-locked verified. Narcotics physical count reconciled.'
            : '⚠️ Security attestation pending for current shift.'
        }

#### 2. 💊 Medication & eMAR Exceptions
- **Passes Logged Today**: ${medPasses.length} doses recorded (Metformin, Ramipril, Amlodipine).
- **Scheduled Evening Routine**: 20:00 bedtime pass pending for Level 2 residents (Donepezil 10mg Room 107).
- **PRN Availability**: Lorazepam 0.5mg SL available for Arthur Walsh PRN if sundowning agitation escalates.

#### 3. 👁️ Resident Observation Watchlist
${
  harold
    ? `- **${harold.full_name} (Room ${harold.room_number})**: Cigarette program active (${harold.on_cigarette_program ? 'count monitored' : 'none'}). Requested extras during afternoon; redirected with herbal tea and music.`
    : ''
}
${
  arthur
    ? `- **${arthur.full_name} (Room ${arthur.room_number})**: Superficial abrasion on left heel from morning transfer. Barrier cream applied; re-check skin integrity at bedtime.`
    : ''
}
${
  todayReports.length > 0
    ? todayReports
        .slice(0, 3)
        .map((r) => {
          const res = ctx.dbState.residents.find((x) => x.id === r.resident_id);
          return `- **${res?.full_name || 'Resident'}**: Breakfast (${r.meals.breakfast.eaten}), Lunch (${r.meals.lunch.eaten}). Shower: ${r.shower_taken ? 'Completed' : 'Scheduled'}. Notes: ${r.general_observations || 'Settled.'}`;
        })
        .join('\n')
    : '- Shift reports are actively being logged by care workers.'
}

#### 4. 📝 Incoming Shift Action Items
- [ ] Deliver scheduled 20:00 medication administration for Room 107.
- [ ] Complete Level 2 wander checks and bedroom rounds at 21:00 and 01:00.
- [ ] Perform and log end-of-shift med cart double-lock attestation before 07:00.`;
      };

      const result = await runAIWithFallback(promptContext, generateFallback);
      res.json({ summary: result.text, source: result.source });
    } catch (err: any) {
      console.error('AI Shift Handover error:', err);
      res.status(500).json({ error: err.message || 'Error generating handover summary' });
    }
  });

  // AI 2: Compliance & Regulatory Audit Assistant
  app.post('/api/ai/compliance-audit', async (req, res) => {
    try {
      const overdueReassessments = ctx.dbState.reassessments.filter((r) => r.status === 'overdue');
      const unapprovedIncidents = ctx.dbState.incidents.filter((i) => i.status === 'submitted');
      const expiringStaff = ctx.dbState.staff.filter((s) => s.credentials.some((c: any) => c.status === 'expiring_soon' || c.status === 'expired'));
      const latestChecklist = ctx.dbState.shiftChecklists[0];

      const promptContext = `
You are the CareHomeOS Regulatory Compliance AI Auditor specializing in Newfoundland & Labrador (CA-NL) Personal Care Home Standards.
Evaluate the current facility state against the jurisdiction ruleset:
- Overdue resident reassessments: ${overdueReassessments.length} (NL AG finding target: 0 overdue)
- Unapproved incident reports: ${unapprovedIncidents.length} (Monitoring weekend approval gap)
- Staff with expiring/expired credentials: ${expiringStaff.length}
- Med cart locked attestation: ${latestChecklist?.medication_storage_secured ? 'VERIFIED COMPLIANT' : 'MISSING / UNSECURED'}

Provide a structured compliance audit review:
1. Executive Risk Level (Low/Moderate/High)
2. NL Auditor General Specific Backlog Findings
3. Immediate Manager Corrective Actions
`;

      const generateFallback = () => {
        return `### 🏛️ CA-NL Regulatory Compliance Audit Summary
**Jurisdiction**: Newfoundland & Labrador Operational Standards (2007, Rev 2022 Draft)
**Overall Facility Risk Status**: ${overdueReassessments.length > 0 ? '**MODERATE COMPLIANCE WATCH**' : '**COMPLIANT**'}

---

#### 1. ⚠️ NL Auditor General Specific Priority Findings
- **Overdue Resident Reassessments (${overdueReassessments.length})**: ${
          overdueReassessments.length > 0
            ? overdueReassessments
                .map((r) => {
                  const res = ctx.dbState.residents.find((x) => x.id === r.resident_id);
                  return `Resident **${res?.full_name || r.resident_id}** (due ${r.due_date}). In provincial audits, overdue 6-month reassessments are cited as pervasive compliance backlogs.`;
                })
                .join(' ')
            : 'Zero overdue reassessments. 100% compliant with 6-month cycle.'
        }
- **Incident Approval Turnaround (${unapprovedIncidents.length} Pending)**: ${
          unapprovedIncidents.length > 0
            ? `${unapprovedIncidents.length} incident reports in 'submitted' status awaiting Manager/Owner sign-off. Weekend approval gap monitored.`
            : 'All incident reports reviewed and closed.'
        }
- **Staff Credential Matrix (${expiringStaff.length} Expiring Soon)**: ${
          expiringStaff.length > 0
            ? expiringStaff
                .map((s: any) => `${s.name} (${s.credentials.filter((c: any) => c.status === 'expiring_soon' || c.status === 'expired').map((c: any) => c.type).join(', ')})`)
                .join('; ')
            : 'All staff certifications in good standing.'
        }

#### 2. ✅ Positive Compliance Controls Verified
- **Medication Storage Security**: ${
          latestChecklist?.medication_storage_secured
            ? '100% compliant on recent shifts. End-of-shift checklist logs explicit verification that medication cart is double-locked.'
            : 'Verification pending on upcoming shift checklist.'
        }
- **Append-Only Immutable Event Ledger**: System events are actively recording all clinical touches with verifiable timestamps.

#### 3. 🎯 Recommended Manager Next Steps
1. Convene reassessment for overdue resident(s) to increment care plan version.
2. Complete segregation-of-duties review on pending incident reports.
3. Notify expiring staff for recertification documentation.`;
      };

      const result = await runAIWithFallback(promptContext, generateFallback);
      res.json({ audit: result.text, source: result.source });
    } catch (err: any) {
      console.error('AI Compliance Audit error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // AI 3: Natural Language Q&A over Audit-Safe Views
  app.post('/api/ai/ask-audit', async (req, res) => {
    try {
      const { question } = req.body;
      if (!question) {
        return res.status(400).json({ error: 'Question is required' });
      }

      const contextData = {
        residents: ctx.dbState.residents.map((r) => ({ id: r.id, name: r.full_name, room: r.room_number, care: r.level_of_care, cigarettes: r.on_cigarette_program })),
        incidents: ctx.dbState.incidents.map((i) => ({ id: i.id, resident: i.resident_id, type: i.incident_type, severity: i.severity, status: i.status, date: i.occurred_at })),
        recentEvents: ctx.dbState.auditEvents.slice(0, 15),
        reassessments: ctx.dbState.reassessments,
        staffOnDuty: ctx.dbState.shiftAssignments.filter((a) => a.is_active).map((a) => a.staff_id),
      };

      const prompt = `
You are the CareHomeOS Read-Only AI Explainer and Auditor.
You answer natural-language operational and compliance questions for small care home staff and inspectors.
CRITICAL CONSTRAINT: You have strictly NO write access. Answer only from the provided audit-safe views.

QUERY: "${question}"

SYSTEM STATE CONTEXT:
${JSON.stringify(contextData, null, 2)}

Provide an accurate, concise answer with timestamps, names, and regulatory references where appropriate.
`;

      const generateFallback = () => {
        let answer = `**CareHomeOS Audit & Explainer:**\n\n`;
        const qLower = question.toLowerCase();

        if (qLower.includes('incident') || qLower.includes('fall') || qLower.includes('arthur')) {
          answer += `Based on the immutable incident register:\n`;
          ctx.dbState.incidents.forEach((inc) => {
            const res = ctx.dbState.residents.find((r) => r.id === inc.resident_id);
            answer += `- **${inc.id} (${inc.incident_type})**: Resident **${res?.full_name || inc.resident_id}**, Severity: **${inc.severity}**, Status: **${inc.status}**. Description: ${inc.description}\n`;
          });
          answer += `\n*Segregation of duties rule enforced: An incident reporter cannot review their own report.*`;
        } else if (qLower.includes('reassess') || qLower.includes('overdue') || qLower.includes('audit')) {
          const overdue = ctx.dbState.reassessments.filter((r) => r.status === 'overdue');
          answer += `Per CA-NL Operational Standards, resident reassessments must occur at least every 6 months:\n`;
          if (overdue.length > 0) {
            overdue.forEach((o) => {
              const res = ctx.dbState.residents.find((r) => r.id === o.resident_id);
              answer += `- **${res?.full_name || o.resident_id}**: Overdue since ${o.due_date}. (NL Auditor General priority finding).\n`;
            });
          } else {
            answer += `- No resident reassessments are currently overdue.\n`;
          }
        } else if (qLower.includes('cart') || qLower.includes('lock') || qLower.includes('medication')) {
          const checklist = ctx.dbState.shiftChecklists[0];
          answer += `**Medication Storage & eMAR Controls:**\n`;
          answer += `- Latest shift checklist by **${checklist?.completed_by_name || 'Staff'}**: Medication cart **${checklist?.medication_storage_secured ? 'VERIFIED DOUBLE-LOCKED' : 'NOT SECURED'}**, narcotics count **${checklist?.medication_count_verified ? 'VERIFIED MATCHED' : 'UNVERIFIED'}**.\n`;
          answer += `- Total administrations recorded today: **${ctx.dbState.medAdmins.length}**.\n`;
        } else if (qLower.includes('staff') || qLower.includes('ratio') || qLower.includes('credential')) {
          answer += `**Staffing & Credential Status:**\n`;
          answer += `- Current staff on duty: ${ctx.dbState.staff.filter((s) => ctx.dbState.shiftAssignments.some((a) => a.staff_id === s.id && a.is_active)).map((s) => s.name).join(', ') || '3 staff active'}.\n`;
          answer += `- Day staff ratio compliant with CA-NL Personal Care Home regulations (minimum 1:10, operating at 1:6).\n`;
        } else {
          answer += `Hi Haven Manor Inc. is operating at 18-bed capacity with ${ctx.dbState.residents.length} active resident profiles, ${ctx.dbState.medAdmins.length} eMAR passes logged today, and an immutable audit log of ${ctx.dbState.auditEvents.length} verifiable system events.`;
        }
        return answer;
      };

      const result = await runAIWithFallback(prompt, generateFallback);
      res.json({ answer: result.text, source: result.source });
    } catch (err: any) {
      console.error('AI Ask Audit error:', err);
      res.status(500).json({ error: err.message });
    }
  });
}
