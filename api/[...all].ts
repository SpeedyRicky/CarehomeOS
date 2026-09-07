// Vercel serverless entry point. Vercel's file-based routing maps any
// request under /api/* to this function (the `[...all]` catch-all keeps
// the full path, e.g. `/api/auth/login`, intact in req.url so Express can
// route it normally). Vercel's Node.js runtime accepts an Express app as
// the default export and calls it directly as the request handler — see
// createApiApp() in ../server.ts for the actual route definitions.
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
import { createApiApp } from '../server';

export default createApiApp();
