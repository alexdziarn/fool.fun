import { clusterApiUrl, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Connection } from "@solana/web3.js";
import { PROGRAM_ID } from "./config/constants";
import { PublicKey } from '@solana/web3.js';
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

interface Token {
  name: string;
  symbol: string;
  description: string;
  image: string;
  currentHolder: string;
  minter: string;
  currentPrice: number;
  nextPrice: number;
  pubkey?: string;
  createdAt?: number;
  id: string;
}

// Add this interface to match database column names
interface DbToken {
  id: string;
  name: string;
  symbol: string;
  description: string;
  image: string;
  current_holder: string;
  minter: string;
  current_price: number;
  next_price: number;
  pubkey: string;
  created_at?: Date;
}

// Define the table name
const TOKEN_TABLE = "tokens";

async function getTokenData() {
  try {
    // TODO: Change connection based on environment
    const connection = new Connection(clusterApiUrl('devnet'));
    const accounts = await connection.getProgramAccounts(PROGRAM_ID);
    console.log(`Found ${accounts.length} tokens`);

    // Sample token data
    const tokenData: Token[] = accounts.map(({ pubkey, account }) => {
      try {
        const data = account.data;
        let offset = 8; // Skip discriminator
        
        // Helper to read string
        const readString = () => {
          const len = data.readUInt32LE(offset);
          offset += 4;
          const str = data.slice(offset, offset + len).toString();
          offset += len;
          return str;
        };
        
        const name = readString();
        const symbol = readString();
        const description = readString();
        const image = readString();
        const currentHolder = new PublicKey(data.slice(offset, offset + 32)).toString();
        offset += 32;
        const minter = new PublicKey(data.slice(offset, offset + 32)).toString();
        offset += 64; // skip minter and dev
        
        const currentPrice = Number(data.readBigUInt64LE(offset)) / LAMPORTS_PER_SOL;
        offset += 8;
        const nextPrice = Number(data.readBigUInt64LE(offset)) / LAMPORTS_PER_SOL;
        
        return {
          id: pubkey.toString(),
          name,
          symbol,
          description,
          image,
          currentHolder,
          minter,
          currentPrice,
          nextPrice,
          pubkey: pubkey.toString()
        };
      } catch (err) {
        console.error(`Error parsing token ${pubkey.toString()}:`, err);
        return null;
      }
    }).filter(token => token !== null) as Token[];

    return tokenData;
  } catch (error) {
    console.error("Error getting token data:", error);
    return [];
  }
}

// Function to create the table if it doesn't exist
async function createTableIfNotExists() {
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create an index on current_price for efficient sorting
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tokens_current_price ON ${TOKEN_TABLE} (current_price DESC)
    `);
    
    console.log(`Table ${TOKEN_TABLE} created successfully`);
  } catch (error) {
    console.error("Error creating table:", error);
    throw error;
  } finally {
    client.release();
  }
}

// Function to populate the table with token data
async function populateTokensTable() {
  const tokenData = await getTokenData();

  if (!tokenData || tokenData.length === 0) {
    console.error("No token data found");
    return;
  }

  console.log("Starting to populate tokens table...");
  
  const client = await pool.connect();
  try {
    // First ensure the table exists
    await createTableIfNotExists();
    
    // Begin transaction
    await client.query('BEGIN');
    
    // Clear existing data (optional)
    await client.query(`TRUNCATE TABLE ${TOKEN_TABLE}`);
    
    // Add each token to the database
    for (const token of tokenData) {
      const query = {
        text: `
          INSERT INTO ${TOKEN_TABLE}
          (id, name, symbol, description, image, current_holder, minter, current_price, next_price, pubkey)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `,
        values: [
          token.id,
          token.name,
          token.symbol,
          token.description,
          token.image,
          token.currentHolder,
          token.minter,
          token.currentPrice,
          token.nextPrice,
          token.pubkey
        ]
      };
      
      await client.query(query);
      console.log(`Added token: ${token.name} (${token.symbol})`);
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log("Finished populating tokens table successfully!");
  } catch (error) {
    // Rollback in case of error
    await client.query('ROLLBACK');
    console.error("Error populating tokens table:", error);
  } finally {
    client.release();
  }
}

// Function to get top tokens by price
async function getTopTokensByPrice(limit = 5) {
  const client = await pool.connect();
  try {
    console.log(`Retrieving top ${limit} tokens sorted by price...`);
    
    const query = {
      text: `
        SELECT * FROM ${TOKEN_TABLE}
        ORDER BY current_price DESC
        LIMIT $1
      `,
      values: [limit]
    };
    
    const result = await client.query(query);
    
    if (result.rows.length === 0) {
      console.log("No tokens found in the database.");
      return [];
    }
    
    console.log(`Top ${result.rows.length} tokens by price:`);
    result.rows.forEach((token: DbToken, index: number) => {
      console.log(`${index + 1}. ${token.name} (${token.symbol}) - Current price: ${token.current_price} SOL`);
    });
    
    return result.rows;
  } catch (error) {
    console.error("Error getting top tokens by price:", error);
    return [];
  } finally {
    client.release();
  }
}

// Main function to run everything
async function main() {
  try {
    await populateTokensTable();
    await getTopTokensByPrice(5);
  } catch (error) {
    console.error("Error in main function:", error);
  } finally {
    // Close the pool when done
    await pool.end();
  }
}

// Run the main function
main();
