import { getPool } from './pool';

async function createScannerStateTable() {
  try {
    const client = await getPool().connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS scanner_state (
        scanner_name VARCHAR(50) PRIMARY KEY,
        last_processed_slot BIGINT NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Scanner state table created successfully');
  } catch (error) {
    console.error('Error creating scanner state table:', error);
    throw error;
  }
}

// Run if this file is executed directly
if (require.main === module) {
  createScannerStateTable()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
} 