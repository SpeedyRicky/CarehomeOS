import express from 'express';
import path from 'path';
import { createApiApp } from './src/apiApp';

/**
 * Standalone entry point for local development and any traditional Node
 * host (Cloud Run, a VM, etc.) — wraps createApiApp() with the Vite dev
 * middleware (or the built static frontend in production) and starts
 * listening.
 *
 * Not used on Vercel, and not merely skipped there — api/index.ts imports
 * createApiApp() from src/apiApp.ts directly, never through this file, so
 * this file (and the dynamic `import('vite')` below) is entirely outside
 * the Vercel serverless function's dependency graph. See src/apiApp.ts's
 * file header for why that separation matters.
 */
async function startServer() {
  const app = createApiApp();
  const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CareHomeOS server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
