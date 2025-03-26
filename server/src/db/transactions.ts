import { getPool, closePool } from './pool';
import { DBTransaction, DBTransactionType } from '../types';

// Define the table name
const TRANSACTION_TABLE = "transactions";

export function getTransactionType(logs: string[]): DBTransactionType {
  const isSteal = logs.some(log => log.includes('Instruction: Steal'));
  const isTransfer = logs.some(log => log.includes('Instruction: Transfer'));
  const isCreate = logs.some(log => log.includes('Instruction: Initialize'));

  if (isSteal) return DBTransactionType.STEAL;
  if (isTransfer) return DBTransactionType.TRANSFER;
  if (isCreate) return DBTransactionType.CREATE;

  return DBTransactionType.UNKNOWN;
}

// only works with fetchTransactionHistoryByTokenId function
export function getTransactionAmountToFrom(type: DBTransactionType, tx: any): {amount: number | null, from: string, to: string} {
  let amount: number | null = null;
  let from = '';
  let to = '';

  console.log("Transaction type", type);

  if (type === DBTransactionType.STEAL) {
    console.log("Transaction steal");
    if (tx?.meta?.innerInstructions) {
      tx.meta.innerInstructions.forEach((inner: any) => {
        inner.instructions.slice(0, 3).forEach((ix: any) => {
          // Use type assertion to bypass type checking
          const parsedIx = ix as any;
          if (parsedIx.parsed?.type === 'transfer') {
            const info = parsedIx.parsed.info;
            amount = (amount || 0) + info.lamports / 1e9;
          }
        });
        
        // Use type assertion to bypass type checking
        const firstIx = inner.instructions[0] as any;
        if (firstIx?.parsed?.info) {
          to = firstIx.parsed.info.source || '';
          from = firstIx.parsed.info.destination || '';
        }
      });
    }
  } else if (type === DBTransactionType.CREATE) {
    console.log("Transaction create");
    from = 'System';
          
    // Try to extract the recipient from inner instructions
    if (tx.meta.innerInstructions?.[0]) {
      // Use type assertion to bypass type checking
      const firstIx = tx.meta.innerInstructions[0].instructions[0] as any;
      if (firstIx?.parsed?.info) {
        to = firstIx.parsed.info.source || '';
      }
    }
  } else if (type === DBTransactionType.TRANSFER) {
    console.log("Transaction transfer");
    // Try to extract from and to addresses from the transaction
    try {
      // Use type assertion to bypass type checking
      const instruction = tx.transaction.message.instructions[2] as any;
      if (instruction.accounts) {
        from = instruction.accounts[1]?.toString() || '';
        to = instruction.accounts[2]?.toString() || '';
      }
    } catch (error) {
      console.error("Error parsing transfer transaction:", error);
    }
  }
  console.log("Transaction transfer amount to from", {amount, from, to});
  return {amount, from, to};
}

export function getTransactionToFromNew(type: DBTransactionType, tx: any): {from: string, to: string, token_id: string} {
  let from = '';
  let to = '';
  let token_id = '';

  // console.log("tx.transaction.message.instructions", tx.transaction.message.instructions);
  // console.log("tx.meta.innerInstructions", tx.meta.innerInstructions);
  // console.log("tx.transaction.message.accountKeys", tx.transaction.message.accountKeys);
  // console.log("tx.meta", tx.meta)
  // console.log("tx.transaction", tx.transaction);
  if (type === DBTransactionType.STEAL) {
    console.log("Transaction steal");
    try {
      from = tx.transaction.message.accountKeys[tx.transaction.message.instructions[2].accounts[2]].toString();
      to = tx.transaction.message.accountKeys[tx.transaction.message.instructions[2].accounts[1]].toString();
      token_id = tx.transaction.message.accountKeys[tx.transaction.message.instructions[2].accounts[0]].toString();
    } catch (error) {
      console.error("Error parsing steal transaction:", error);
    }
  } else if (type === DBTransactionType.CREATE) {
    try {
      from = 'System';
      to = tx.transaction.message.accountKeys[tx.transaction.message.instructions[2].accounts[1]].toString();
      token_id = tx.transaction.message.accountKeys[tx.transaction.message.instructions[2].accounts[0]].toString();
    } catch (error) {
      console.error("Error parsing create transaction:", error);
    }
  } else if (type === DBTransactionType.TRANSFER) {
    try {
      from = tx.transaction.message.accountKeys[tx.transaction.message.instructions[2].accounts[1]].toString();
      to = tx.transaction.message.accountKeys[tx.transaction.message.instructions[2].accounts[2]].toString();
      token_id = tx.transaction.message.accountKeys[tx.transaction.message.instructions[2].accounts[0]].toString();
    } catch (error) {
      console.error("Error parsing transfer transaction:", error);
    }
  }
  
  return {from, to, token_id};
}

/**
 * Creates the transactions table if it doesn't exist
 */
export async function createTransactionTableIfNotExists() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${TRANSACTION_TABLE} (
        id TEXT PRIMARY KEY,
        token_id TEXT NOT NULL,
        type TEXT NOT NULL,
        from_address TEXT NOT NULL,
        to_address TEXT NOT NULL,
        amount DECIMAL(20, 9),
        timestamp TIMESTAMP NOT NULL,
        block_number BIGINT,
        success BOOLEAN NOT NULL DEFAULT TRUE,
        CONSTRAINT fk_token
          FOREIGN KEY(token_id)
          REFERENCES tokens(id)
          ON DELETE CASCADE
      )
    `);
    
    // Create indexes for efficient querying
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_transactions_token_id ON ${TRANSACTION_TABLE} (token_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON ${TRANSACTION_TABLE} (timestamp DESC)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_transactions_from_address ON ${TRANSACTION_TABLE} (from_address)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_transactions_to_address ON ${TRANSACTION_TABLE} (to_address)
    `);
    
    console.log(`Table ${TRANSACTION_TABLE} created successfully`);
  } catch (error) {
    console.error("Error creating transaction table:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Inserts a transaction into the database
 * @param transaction Transaction data to insert
 */
export async function insertTransaction(transaction: DBTransaction) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const query = `
      INSERT INTO ${TRANSACTION_TABLE}
      (id, token_id, type, from_address, to_address, amount, timestamp, block_number, success)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO NOTHING
      RETURNING *
    `;
    
    const values = [
      transaction.id,
      transaction.token_id,
      transaction.type,
      transaction.from_address,
      transaction.to_address,
      transaction.amount,
      transaction.timestamp,
      transaction.block_number,
      transaction.success
    ];
    
    const result = await client.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error("Error inserting transaction:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Gets transactions for a specific token
 * @param tokenId Token ID to get transactions for
 * @param limit Maximum number of transactions to return
 * @param offset Offset for pagination
 */
export async function getTransactionsByTokenId(tokenId: string, limit = 20, offset = 0) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const query = `
      SELECT * FROM ${TRANSACTION_TABLE}
      WHERE token_id = $1
      ORDER BY timestamp DESC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await client.query(query, [tokenId, limit, offset]);
    return result.rows;
  } catch (error) {
    console.error("Error getting transactions:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Gets transaction count for a specific token
 * @param tokenId Token ID to get transaction count for
 */
export async function getTransactionCountByTokenId(tokenId: string) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const query = `
      SELECT COUNT(*) as count FROM ${TRANSACTION_TABLE}
      WHERE token_id = $1
    `;
    
    const result = await client.query(query, [tokenId]);
    return parseInt(result.rows[0].count);
  } catch (error) {
    console.error("Error getting transaction count:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Gets transactions for a specific address (either as sender or recipient)
 * @param address Address to get transactions for
 * @param limit Maximum number of transactions to return
 * @param offset Offset for pagination
 */
export async function getTransactionsByAddress(address: string, limit = 20, offset = 0) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const query = `
      SELECT * FROM ${TRANSACTION_TABLE}
      WHERE from_address = $1 OR to_address = $1
      ORDER BY timestamp DESC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await client.query(query, [address, limit, offset]);
    return result.rows;
  } catch (error) {
    console.error("Error getting transactions by address:", error);
    throw error;
  } finally {
    client.release();
  }
}

// Export the main function to create the table
export async function setupTransactionTable() {
  try {
    await createTransactionTableIfNotExists();
    console.log("Transaction table setup complete");
    
    // Return success
    return true;
  } catch (error) {
    console.error("Error setting up transaction table:", error);
    
    // Return failure
    return false;
  }
}

// If this file is run directly, create the table
if (require.main === module) {
  setupTransactionTable()
    .then(async (success) => {
      console.log("Transaction table setup " + (success ? "successful" : "failed"));
      
      // Safely close the pool
      try {
        await closePool();
      } catch (error) {
        console.error("Error closing database connection:", error);
      }
      
      // Use setTimeout to allow any pending operations to complete
      setTimeout(() => {
        process.exit(success ? 0 : 1);
      }, 100);
    })
    .catch(error => {
      console.error("Error setting up transaction table:", error);
      
      // Try to safely close the pool
      closePool().catch(poolError => {
        console.error("Error closing database connection:", poolError);
      });
      
      // Use setTimeout to allow any pending operations to complete
      setTimeout(() => {
        process.exit(1);
      }, 100);
    });
} 