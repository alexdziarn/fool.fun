import { clusterApiUrl, LAMPORTS_PER_SOL, Connection, PublicKey } from "@solana/web3.js";
import { PROGRAM_ID } from "../constants";
import { closePool } from './pool';
import { insertToken, createTokenTableIfNotExists, getTopTokensByPrice } from './tokens';
import { Token } from '../types';

/**
 * Interface for token data from the blockchain
 */
interface BlockchainToken {
  name: string;
  symbol: string;
  description: string;
  image: string;
  currentHolder: string;
  minter: string;
  currentPrice: number;
  nextPrice: number;
  pubkey: string;
  id: string;
  createdAt?: number;
}

/**
 * Helper function to dump account data for debugging
 * @param data Buffer containing account data
 * @param maxBytes Maximum number of bytes to dump (default: 100)
 */
function dumpAccountData(data: Buffer, maxBytes = 100): string {
  const bytes = Array.from(data.slice(0, Math.min(data.length, maxBytes)));
  
  let result = 'Bytes: ';
  // Hex representation
  result += bytes.map(b => b.toString(16).padStart(2, '0')).join(' ');
  
  result += '\nASCII: ';
  // ASCII representation (printable chars only)
  result += bytes.map(b => b >= 32 && b <= 126 ? String.fromCharCode(b) : '.').join('');
  
  if (data.length > maxBytes) {
    result += `\n... (${data.length - maxBytes} more bytes)`;
  }
  
  return result;
}

/**
 * Fetches token data from the blockchain
 * @param limit Optional limit on number of tokens to process
 * @param debug Whether to print debug information
 */
async function getTokenDataFromBlockchain(limit?: number, debug = false): Promise<BlockchainToken[]> {
  try {
    console.log("Fetching token data from blockchain...");
    const connection = new Connection(clusterApiUrl('devnet'));
    
    // Get all program accounts
    const accounts = await connection.getProgramAccounts(PROGRAM_ID);
    console.log(`Found ${accounts.length} token accounts${limit ? `, processing up to ${limit}` : ''}`);
    
    const tokens: BlockchainToken[] = [];
    
    // Apply limit if specified
    const accountsToProcess = limit ? accounts.slice(0, limit) : accounts;
    
    for (const account of accountsToProcess) {
      try {
        const data = account.account.data;
        
        // Log raw account data for debugging
        // console.log(`\nAccount ${account.pubkey.toString()} data:`);
        // console.log(dumpAccountData(data));
        
        // Skip if not a token account (should have at least 8 bytes for discriminator)
        if (data.length < 8) {
          console.log(`Skipping account ${account.pubkey.toString()}: data too short (${data.length} bytes)`);
          continue;
        }
        
        // Extract discriminator for logging and debugging
        const discriminator = data.slice(0, 8);
        
        // Log the discriminator value for debugging
        // console.log(`Token account ${account.pubkey.toString()} discriminator:`, 
        //   Array.from(discriminator).join(', '));
        
        // NOTE: Removing the discriminator check as it may be filtering out valid tokens
        // const isTokenAccount = Buffer.compare(
        //   discriminator, 
        //   Buffer.from([97, 122, 98, 121, 226, 200, 38, 235])
        // ) === 0;
        
        // if (!isTokenAccount) continue;
        
        let offset = 8; // Skip discriminator
        
        // Helper to read string
        const readString = () => {
          try {
            const len = data.readUInt32LE(offset);
            
            // Validate string length to avoid buffer overruns
            if (len > data.length - offset - 4) {
              throw new Error(`Invalid string length ${len} at offset ${offset}, data length ${data.length}`);
            }
            
            offset += 4;
            const str = data.slice(offset, offset + len).toString();
            offset += len;
            return str;
          } catch (err) {
            console.error(`Error reading string at offset ${offset}:`, err);
            throw err;
          }
        };
        
        // Parse token data with detailed error handling
        let name, symbol, description, image, currentHolder, minter, currentPrice, nextPrice;
        
        try { name = readString(); } 
        catch (err) { console.error(`Error reading name for token ${account.pubkey.toString()}:`, err); continue; }
        
        try { symbol = readString(); } 
        catch (err) { console.error(`Error reading symbol for token ${account.pubkey.toString()}:`, err); continue; }
        
        try { description = readString(); } 
        catch (err) { console.error(`Error reading description for token ${account.pubkey.toString()}:`, err); continue; }
        
        try { image = readString(); } 
        catch (err) { console.error(`Error reading image for token ${account.pubkey.toString()}:`, err); continue; }
        
        try {
          if (offset + 32 > data.length) {
            throw new Error(`Not enough data for currentHolder: offset ${offset}, data length ${data.length}`);
          }
          currentHolder = new PublicKey(data.slice(offset, offset + 32)).toString();
          offset += 32;
        } catch (err) {
          console.error(`Error reading currentHolder for token ${account.pubkey.toString()}:`, err);
          continue;
        }
        
        try {
          if (offset + 32 > data.length) {
            throw new Error(`Not enough data for minter: offset ${offset}, data length ${data.length}`);
          }
          minter = new PublicKey(data.slice(offset, offset + 32)).toString();
          offset += 64; // skip minter and dev
        } catch (err) {
          console.error(`Error reading minter for token ${account.pubkey.toString()}:`, err);
          continue;
        }
        
        try {
          if (offset + 8 > data.length) {
            throw new Error(`Not enough data for currentPrice: offset ${offset}, data length ${data.length}`);
          }
          currentPrice = Number(data.readBigUInt64LE(offset)) / LAMPORTS_PER_SOL;
          offset += 8;
        } catch (err) {
          console.error(`Error reading currentPrice for token ${account.pubkey.toString()}:`, err);
          continue;
        }
        
        try {
          if (offset + 8 > data.length) {
            throw new Error(`Not enough data for nextPrice: offset ${offset}, data length ${data.length}`);
          }
          nextPrice = Number(data.readBigUInt64LE(offset)) / LAMPORTS_PER_SOL;
        } catch (err) {
          console.error(`Error reading nextPrice for token ${account.pubkey.toString()}:`, err);
          continue;
        }
        
        // Log successful parsing
        console.log(`Successfully parsed token: ${name} (${symbol}), ID: ${account.pubkey.toString()}`);
        
        tokens.push({
          id: account.pubkey.toString(),
          name,
          symbol,
          description,
          image,
          currentHolder,
          minter,
          currentPrice,
          nextPrice,
          pubkey: account.pubkey.toString(),
          createdAt: Date.now()
        });
      } catch (err) {
        console.error(`Error parsing token account ${account.pubkey.toString()}:`, err);
      }
    }
    // console.log("accounts", accounts);
    // console.log("tokens", tokens);
    return tokens;
  } catch (error) {
    console.error("Error fetching token data from blockchain:", error);
    return [];
  }
}

/**
 * Populates the tokens table with data from the blockchain
 * @param limit Optional limit on number of tokens to process
 * @param debug Whether to print debug information
 */
async function populateTokensTable(limit?: number, debug = false) {
  try {
    // Ensure the token table exists
    await createTokenTableIfNotExists();
    
    // Fetch token data from blockchain
    const blockchainTokens = await getTokenDataFromBlockchain(limit, debug);
    
    if (!blockchainTokens || blockchainTokens.length === 0) {
      console.log("No token data found on blockchain");
      return;
    }
    
    console.log(`Found ${blockchainTokens.length} tokens to insert`);
    
    // Insert each token into the database
    for (const blockchainToken of blockchainTokens) {
      try {
        // Convert blockchain token to database token format
        const dbToken: Token = {
          id: blockchainToken.id,
          name: blockchainToken.name,
          symbol: blockchainToken.symbol,
          description: blockchainToken.description,
          image: blockchainToken.image,
          current_holder: blockchainToken.currentHolder,
          minter: blockchainToken.minter,
          current_price: blockchainToken.currentPrice,
          next_price: blockchainToken.nextPrice,
          pubkey: blockchainToken.pubkey,
          created_at: blockchainToken.createdAt ? new Date(blockchainToken.createdAt) : new Date()
        };
        
        // Insert token into database
        await insertToken(dbToken);
        console.log(`Inserted token: ${dbToken.name} (${dbToken.id})`);
      } catch (err) {
        console.error(`Error inserting token ${blockchainToken.id}:`, err);
      }
    }
    
    console.log("Token table population complete");
    
    // Display top tokens by price
    const topTokens = await getTopTokensByPrice(5);
    console.log("Top 5 tokens by price:");
    topTokens.forEach((token, index) => {
      console.log(`${index + 1}. ${token.name} (${token.symbol}) - ${token.current_price} SOL`);
    });
  } catch (error) {
    console.error("Error populating tokens table:", error);
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    let limit: number | undefined = undefined;
    
    // Check for --limit or -l flag
    const limitIndex = args.findIndex(arg => arg === '--limit' || arg === '-l');
    if (limitIndex >= 0 && limitIndex < args.length - 1) {
      const limitArg = parseInt(args[limitIndex + 1]);
      if (!isNaN(limitArg) && limitArg > 0) {
        limit = limitArg;
        console.log(`Limiting to ${limit} tokens for debugging`);
      }
    }
    
    // Check for --debug or -d flag
    const debug = args.includes('--debug') || args.includes('-d');
    if (debug) {
      console.log('Debug mode enabled - will print detailed information');
    }
    
    await populateTokensTable(limit, debug);
    console.log("Token population complete");
    
    // Safely close the pool
    await closePool();
    
    return 0; // Success exit code
  } catch (error) {
    console.error("Error in main function:", error);
    
    // Try to safely close the pool even on error
    try {
      await closePool();
    } catch (poolError) {
      console.error("Error closing database connection:", poolError);
    }
    
    return 1; // Error exit code
  }
}

// Run the main function if this file is executed directly
if (require.main === module) {
  main()
    .then((exitCode) => {
      console.log("Script completed successfully");
      // Use setTimeout to allow any pending operations to complete
      setTimeout(() => {
        process.exit(exitCode);
      }, 100);
    })
    .catch(error => {
      console.error("Script failed:", error);
      // Use setTimeout to allow any pending operations to complete
      setTimeout(() => {
        process.exit(1);
      }, 100);
    });
} 