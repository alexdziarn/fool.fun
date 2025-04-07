import { getPool, closePool } from './pool';
import { PublicKey } from '@solana/web3.js';
import { Token } from '../types';

// Define the table name
const TOKEN_TABLE = "tokens";

/**
 * Creates the tokens table if it doesn't exist
 */
export async function createTokenTableIfNotExists() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${TOKEN_TABLE} (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        symbol TEXT NOT NULL,
        description TEXT,
        image TEXT,
        current_holder TEXT NOT NULL,
        minter TEXT NOT NULL,
        current_price DECIMAL(20, 9) NOT NULL,
        next_price DECIMAL(20, 9) NOT NULL,
        pubkey TEXT,
        last_steal TIMESTAMP,
        last_create TIMESTAMP
      )
    `);
    
    // Create indexes for efficient querying
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tokens_current_price ON ${TOKEN_TABLE} (current_price DESC)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tokens_current_holder ON ${TOKEN_TABLE} (current_holder)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tokens_minter ON ${TOKEN_TABLE} (minter)
    `);
    
    console.log(`Table ${TOKEN_TABLE} created successfully`);
  } catch (error) {
    console.error("Error creating token table:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Inserts a token into the database
 * @param token Token data to insert
 */
export async function insertToken(token: Token) {
  const client = await getPool().connect();
  try {
    const query = `
      INSERT INTO ${TOKEN_TABLE}
      (id, name, symbol, description, image, current_holder, minter, current_price, next_price, pubkey, last_steal, last_create)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        symbol = EXCLUDED.symbol,
        description = EXCLUDED.description,
        image = EXCLUDED.image,
        current_holder = EXCLUDED.current_holder,
        current_price = EXCLUDED.current_price,
        next_price = EXCLUDED.next_price,
        last_steal = EXCLUDED.last_steal,
        last_create = EXCLUDED.last_create
      RETURNING *
    `;
    
    const values = [
      token.id,
      token.name,
      token.symbol,
      token.description,
      token.image,
      token.current_holder,
      token.minter,
      token.current_price,
      token.next_price,
      token.pubkey,
      token.last_steal,
      token.last_create,
    ];
    
    const result = await client.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error("Error inserting token:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Gets a token by its ID
 * @param tokenId Token ID to get
 */
export async function getTokenById(tokenId: string) {
  const client = await getPool().connect();
  try {
    const query = `
      SELECT * FROM ${TOKEN_TABLE}
      WHERE id = $1
    `;
    
    const result = await client.query(query, [tokenId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error("Error getting token:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Gets all tokens with pagination
 * @param limit Maximum number of tokens to return
 * @param offset Offset for pagination
 */
export async function getTokens(limit = 20, offset = 0) {
  const client = await getPool().connect();
  try {
    const query = `
      SELECT * FROM ${TOKEN_TABLE}
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;
    
    const result = await client.query(query, [limit, offset]);
    return result.rows;
  } catch (error) {
    console.error("Error getting tokens:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Gets the total count of tokens
 */
export async function getTokenCount() {
  const client = await getPool().connect();
  try {
    const query = `
      SELECT COUNT(*) as count FROM ${TOKEN_TABLE}
    `;
    
    const result = await client.query(query);
    return parseInt(result.rows[0].count);
  } catch (error) {
    console.error("Error getting token count:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Gets tokens by holder address
 * @param holderAddress Holder address to get tokens for
 * @param limit Maximum number of tokens to return
 * @param offset Offset for pagination
 */
export async function getTokensByHolder(holderAddress: string, limit = 20, offset = 0) {
  const client = await getPool().connect();
  try {
    const query = `
      SELECT * FROM ${TOKEN_TABLE}
      WHERE current_holder = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await client.query(query, [holderAddress, limit, offset]);
    return result.rows;
  } catch (error) {
    console.error("Error getting tokens by holder:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Gets tokens by minter address
 * @param minterAddress Minter address to get tokens for
 * @param limit Maximum number of tokens to return
 * @param offset Offset for pagination
 */
export async function getTokensByMinter(minterAddress: string, limit = 20, offset = 0) {
  const client = await getPool().connect();
  try {
    const query = `
      SELECT * FROM ${TOKEN_TABLE}
      WHERE minter = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await client.query(query, [minterAddress, limit, offset]);
    return result.rows;
  } catch (error) {
    console.error("Error getting tokens by minter:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Gets top tokens by price
 * @param limit Maximum number of tokens to return
 */
export async function getTopTokensByPrice(limit = 5) {
  const client = await getPool().connect();
  try {
    const query = `
      SELECT * FROM ${TOKEN_TABLE}
      ORDER BY current_price DESC
      LIMIT $1
    `;
    
    const result = await client.query(query, [limit]);
    return result.rows;
  } catch (error) {
    console.error("Error getting top tokens by price:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Updates a tokens current_holder, current_price, next_price in the database
 * @param tokenId Token ID to update
 * @param token Token data to update
 */
export async function updateToken(token: Token) {
  const client = await getPool().connect();
  try {
    const query = `
      UPDATE ${TOKEN_TABLE}
      SET current_holder = $2, current_price = $3, next_price = $4
      WHERE id = $1
      RETURNING *
    `;
    const values = [
      token.id,
      token.current_holder,
      token.current_price,
      token.next_price,
    ];
    const result = await client.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error("Error updating token:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Updates a token's holder and price
 * @param tokenId Token ID to update
 * @param newHolder New holder address
 * @param newPrice New token price
 * @param nextPrice Next token price
 */
export async function updateTokenHolder(tokenId: string, newHolder: string) {
  const client = await getPool().connect();
  try {
    const query = `
      UPDATE ${TOKEN_TABLE}
      SET current_holder = $2
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await client.query(query, [tokenId, newHolder]);
    return result.rows[0];
  } catch (error) {
    console.error("Error updating token holder:", error);
    throw error;
  } finally {
    client.release();
  }
}

// Export the main function to create the table
export async function setupTokenTable() {
  try {
    await createTokenTableIfNotExists();
    console.log("Token table setup complete");
    
    // Return success
    return true;
  } catch (error) {
    console.error("Error setting up token table:", error);
    
    // Return failure
    return false;
  }
}

// If this file is run directly, create the table
if (require.main === module) {
  setupTokenTable()
    .then(async (success) => {
      console.log("Token table setup " + (success ? "successful" : "failed"));
      
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
      console.error("Error setting up token table:", error);
      
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