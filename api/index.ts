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
// ../server.ts for the actual route definitions.
//
// IMPORTANT — read this before assuming login/data issues are fixed by
// deploying this file alone: this app's data store (`dbState` in
// server.ts) is a plain in-memory object. Vercel serverless functions are
// not a persistent process — each cold start gets a fresh, empty-of-writes
// copy of that seed data, and concurrent invocations may not share state
// at all. Login itself works fine (credentials are static seed data), but
// any write (clock in/out, incidents, shift-change requests, etc.) is not
// guaranteed to persist or be visible across requests on Vercel. Treat a
// Vercel deployment of this app as a login/UI demo only until the data
// layer moves to a real database (see ARCHITECTURE.md "Prototype →
// Production").
import type { Request, Response } from 'express';
import { createApiApp } from '../server';

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
  handler = createApiApp();
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
