import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    console.error(`[config] FATAL: ${name} is not set. Check your .env file.`);
    process.exit(1);
  }
  return value.trim();
}

export const config = {
  opBaseUrl: stripTrailingSlash(requireEnv('OP_BASE_URL')),
  opApiKey: requireEnv('OP_API_KEY'),
  port: Number(process.env.PORT) || 4000,
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  authEnabled: process.env.AUTH_ENABLED === 'true',
  writeEnabled: process.env.WRITE_ENABLED === 'true',
  sessionSecret: process.env.SESSION_SECRET || 'change_me_later',
} as const;

console.log('[config] OpenProject base URL:', config.opBaseUrl);
