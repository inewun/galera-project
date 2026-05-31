import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { authMiddleware } from './auth/index.js';
import { registerRoutes } from './routes/index.js';
import { errorHandler } from './middleware/error.js';

const app = express();

app.use(cors({ origin: config.clientOrigin, credentials: true }));
app.use(express.json());
app.use(authMiddleware);

registerRoutes(app);

/* ─────────────────────────────────────────────────────────────
 * Production static serving & SPA fallback
 * ───────────────────────────────────────────────────────────── */
if (process.env.NODE_ENV === 'production') {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const clientDist = path.resolve(__dirname, '../../client/dist');

  app.use(express.static(clientDist));

  // SPA fallback – any GET request that is not an API call returns the index.html
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

/* ─────────────────────────────────────────────────────────────
 * Global error handler (must be registered last)
 * ───────────────────────────────────────────────────────────── */
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`Server is running on port ${config.port}`);
});
