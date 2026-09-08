// Vercel serverless entry point for /api/ai/* only — deliberately its own
// function, separate from api/index.ts. See src/aiRoutes.ts's file header
// for the full reasoning: `@google/genai` pulls in a large dependency tree
// that Vercel's function bundler cannot be kept from tracing into any
// function that references it, even via an obfuscated dynamic import
// (confirmed directly with Vercel's own @vercel/nft tracer). Login and
// every other core endpoint must never share a function with this
// dependency, so the AI endpoints get their own.
//
// vercel.json routes `/api/ai/*` here (before the general `/api/*` rule)
// via a rewrite, which preserves the original request path — Express
// still sees e.g. `/api/ai/shift-handover` in req.url and routes it
// normally.
//
// This function's dbState is independently seeded from the same seed
// data as api/index.ts's — Vercel serverless functions don't share memory
// across separate functions (or even across separate invocations of the
// same function) regardless, so AI summaries here reflect seed data, not
// live writes made through api/index.ts. See ARCHITECTURE.md "Prototype →
// Production".
import express from 'express';
import type { Request, Response } from 'express';
import { dbState, requireAuth, attachSafetyNetErrorHandler } from '../src/apiApp';
import { registerAiRoutes } from '../src/aiRoutes';

function createAiApiApp(): express.Express {
  const app = express();
  app.use(express.json());
  registerAiRoutes(app, { dbState, requireAuth });
  attachSafetyNetErrorHandler(app);
  return app;
}

let handler: (req: Request, res: Response) => void;

try {
  handler = createAiApiApp();
} catch (err: any) {
  console.error('[api/ai] createAiApiApp() failed to initialize:', err);
  handler = (_req, res) => {
    res.status(500).json({
      error: 'CareHomeOS AI API failed to start. Check the Vercel function logs for the underlying error.',
      detail: err?.message || String(err),
    });
  };
}

export default handler;
