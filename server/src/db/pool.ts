import { Pool } from 'pg';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Default configuration
const defaultConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'tokens_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
};

// Create a singleton pool instance
let pool: Pool | null = null;

/**
 * Get a database pool instance. If one doesn't exist, it will be created.
 * This ensures we're using a single pool across the application.
 */
export function getPool(): Pool {
  if (!pool) {
    pool = new Pool(defaultConfig);
  }
  return pool;
}

/**
 * Safely close the database pool
 * This ensures all clients are properly released before ending the pool
 */
export async function closePool(): Promise<void> {
  if (!pool) {
    return;
  }
  
  try {
    await pool.end();
    pool = null;
    console.log('Database pool closed successfully');
  } catch (error) {
    console.error('Error closing database pool:', error);
    throw error;
  }
}

// Add a safer shutdown handler
process.on('SIGINT', async () => {
  console.log('Received SIGINT signal, shutting down gracefully');
  try {
    await closePool();
    process.exit(0);
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
});