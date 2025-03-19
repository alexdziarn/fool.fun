import { Pool } from 'pg';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configure PostgreSQL connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'tokens_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

// Track if the pool is being drained
let isDraining = false;

/**
 * Safely close the database pool
 * This ensures all clients are properly released before ending the pool
 */
async function closePool(): Promise<void> {
  // Prevent multiple drain attempts
  if (isDraining) {
    console.log('Pool is already being drained');
    return;
  }
  
  isDraining = true;
  console.log('Safely closing database pool...');
  
  try {
    // End the pool - this waits for all clients to be released
    await pool.end();
    console.log('Database pool closed successfully');
  } catch (error) {
    console.error('Error closing database pool:', error);
    throw error;
  } finally {
    isDraining = false;
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

// Export the pool and the closePool function
export default pool;
export { closePool };