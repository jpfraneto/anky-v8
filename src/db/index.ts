import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('DATABASE_URL not set - database features will be disabled');
}

// Create postgres connection (only if DATABASE_URL is set)
const client = connectionString ? postgres(connectionString) : null;

// Create drizzle instance
export const db = client ? drizzle(client, { schema }) : null;

// Export schema for use elsewhere
export * from './schema';

// Helper to check if database is available
export const isDatabaseAvailable = () => db !== null;
