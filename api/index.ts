// Vercel serverless entry point for every /api/* request. This is a single
// fixed-name function (not a `[...all]` catch-all) because Vercel's
// rewrite in vercel.json (`"/api/(.*)" -> "/api"`) is what actually routes
// every API path here — a rewrite preserves the original request path, so
// req.url still reads e.g. `/api/auth/login` and Express routes it
// normally. This "one Express app behind a rewrite" shape is the
// standard, unambiguous way to run an existing Express app on Vercel; a
// bracket catch-all filename is a Next.js-flavored convention that isn't
// guaranteed to behave identically for a bare (non-Next.js) Vercel
// project, which is exactly what caused this to 404 in production before.
// Vercel's Node.js runtime accepts an Express app as the default export
// and calls it directly as the request handler — see createApiApp() in
// ../src/apiApp.ts for the actual route definitions.
//
// This imports createApiApp() from src/apiApp.ts, NOT from ../server —
// server.ts additionally wraps it with Vite's dev middleware and static
// file serving for local dev / Cloud Run, none of which belongs anywhere
// near this function. Importing ../server here would have pulled all of
// that (including a dynamic `import('vite')`) into what Vercel's function
// bundler has to reason about, purely because it lived in the same file —
// exactly the kind of extra surface area worth eliminating structurally
// rather than trusting a runtime env-var check to route around it. See
// src/apiApp.ts's file header for the full reasoning.
//
// IMPORTANT — read this before assuming login/data issues are fixed by
// deploying this file alone: this app's data store (`dbState` in
// src/apiApp.ts) is a plain in-memory object. Vercel serverless functions
// are not a persistent process — each cold start gets a fresh,
// empty-of-writes copy of that seed data, and concurrent invocations may
// not share state at all. Login itself works fine (credentials are static
// seed data), but any write (clock in/out, incidents, shift-change
// requests, etc.) is not guaranteed to persist or be visible across
// requests on Vercel. Treat a Vercel deployment of this app as a UI demo
// only until the data layer moves to a real database.
// IMPORTANT: this file must never import anything that itself references
// `@google/genai` (directly or transitively) — see src/aiRoutes.ts's file
// header. AI features are their own separate function: api/ai.ts.
import type { Request, Response } from 'express';
import { createApiApp, attachSafetyNetErrorHandler } from '../src/apiApp';

// createApiApp() runs at module-load time (before any request lands), so a
// throw here is exactly the class of bug that produced the login 500 this
// file previously shipped with (a stray `import.meta.url` reference that
// only broke under Vercel's CJS compilation): a crash Vercel surfaces as a
// generic, non-JSON error page rather than a diagnosable response. Loading
// it inside a try/catch turns "module fails to load" into a normal JSON
// 500 (with the real error logged to Vercel's function logs) instead of a
// blank crash — cheap insurance against the exact failure mode already
// hit twice in production.
let handler: (req: Request, res: Response) => void;

try {
  const app = createApiApp();
  attachSafetyNetErrorHandler(app);
  handler = app;
} catch (err: any) {
  console.error('[api] createApiApp() failed to initialize:', err);
  handler = (_req, res) => {
    res.status(500).json({
      error: 'CareHomeOS API failed to start. Check the Vercel function logs for the underlying error.',
      detail: err?.message || String(err),
    });
  };
}

export default handler;
