import { clusterApiUrl, Connection, PublicKey, ParsedTransactionWithMeta, ParsedInstruction } from "@solana/web3.js";
import { PROGRAM_ID } from "./config/constants";
import pool, { closePool } from './pool';
import { Transaction, TransactionType, insertTransaction } from './transactions';

// Define the table name
const TOKEN_TABLE = "tokens";

/**
 * Fetches all tokens from the database
 */
async function getAllTokens() {
  const client = await pool.connect();
  try {
    const result = await client.query(`SELECT * FROM ${TOKEN_TABLE}`);
    return result.rows;
  } catch (error) {
    console.error("Error fetching tokens:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Fetches transaction history for a token
 * @param tokenPubkey The token's public key
 * @param tokenId The token's ID in the database
 */
async function fetchTransactionHistory(tokenPubkey: string, tokenId: string) {
  try {
    console.log(`Fetching transaction history for token ${tokenId} (${tokenPubkey})`);
    const connection = new Connection(clusterApiUrl('devnet'));
    
    // Convert string to PublicKey
    const tokenPDA = new PublicKey(tokenPubkey);
    
    // 1. Get all signatures for the token
    const signatures = await connection.getSignaturesForAddress(tokenPDA);
    console.log(`Found ${signatures.length} transactions for token ${tokenId}`);
    
    // 2. Process transactions in batches to avoid rate limits
    const BATCH_SIZE = 5;
    const transactions: Transaction[] = [];
    
    for (let i = 0; i < signatures.length; i += BATCH_SIZE) {
      const batch = signatures.slice(i, i + BATCH_SIZE);
      
      // Process this batch in parallel
      const batchPromises = batch.map(sig => 
        connection.getParsedTransaction(sig.signature, {
          maxSupportedTransactionVersion: 0
        })
      );
      
      // Wait for all transactions in this batch to be fetched
      const txBatch = await Promise.all(batchPromises);
      
      // Process the fetched transactions
      for (let j = 0; j < txBatch.length; j++) {
        const tx = txBatch[j];
        const sig = batch[j];
        
        if (!tx?.meta?.logMessages) continue;
        
        const timestamp = sig.blockTime ? new Date(sig.blockTime * 1000) : new Date();
        const logs = tx.meta.logMessages;
        
        // Determine transaction type
        const isSteal = logs.some(log => log.includes('Instruction: Steal'));
        const isTransfer = logs.some(log => log.includes('Instruction: Transfer'));
        const isCreate = logs.some(log => log.includes('Instruction: Initialize'));
        
        if (!isSteal && !isTransfer && !isCreate) continue;
        
        let type: TransactionType;
        let amount: number | null = null;
        let from = '';
        let to = '';
        
        if (isSteal) {
          type = TransactionType.STEAL;
          
          if (tx?.meta?.innerInstructions) {
            tx.meta.innerInstructions.forEach((inner) => {
              inner.instructions.slice(0, 3).forEach((ix) => {
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
        } else if (isCreate) {
          type = TransactionType.CREATE;
          from = 'System';
          
          // Try to extract the recipient from inner instructions
          if (tx.meta.innerInstructions?.[0]) {
            // Use type assertion to bypass type checking
            const firstIx = tx.meta.innerInstructions[0].instructions[0] as any;
            if (firstIx?.parsed?.info) {
              to = firstIx.parsed.info.source || '';
            }
          }
        } else if (isTransfer) {
          type = TransactionType.TRANSFER;
          
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
        } else {
          // Skip unknown transaction types
          continue;
        }
        
        // Create transaction object
        const transaction: Transaction = {
          id: sig.signature,
          token_id: tokenId,
          type,
          from_address: from || 'Unknown',
          to_address: to || 'Unknown',
          amount,
          timestamp,
          block_number: tx.slot || null,
          slot: tx.slot || null,
          fee: tx.meta.fee ? tx.meta.fee / 1e9 : null,
          success: !tx.meta.err
        };
        
        transactions.push(transaction);
      }
      
      // Add a small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < signatures.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return transactions;
  } catch (error) {
    console.error(`Error fetching transaction history for token ${tokenId}:`, error);
    return [];
  }
}

/**
 * Populates the transactions table with historical data
 */
async function populateTransactionsTable() {
  try {
    // Get all tokens
    const tokens = await getAllTokens();
    console.log(`Found ${tokens.length} tokens to process`);
    
    // Process each token
    for (const token of tokens) {
      // Skip tokens without a pubkey
      if (!token.pubkey) {
        console.log(`Skipping token ${token.id} - no pubkey`);
        continue;
      }
      
      // Fetch transaction history
      const transactions = await fetchTransactionHistory(token.pubkey, token.id);
      console.log(`Found ${transactions.length} transactions for token ${token.id}`);
      
      // Insert transactions into the database
      for (const transaction of transactions) {
        try {
          await insertTransaction(transaction);
        } catch (error) {
          console.error(`Error inserting transaction ${transaction.id}:`, error);
        }
      }
      
      console.log(`Processed ${transactions.length} transactions for token ${token.id}`);
      
      // Add a delay between tokens to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log("Transaction table population complete");
  } catch (error) {
    console.error("Error populating transactions table:", error);
  }
}

/**
 * Main function
 */
async function main() {
  try {
    await populateTransactionsTable();
    console.log("Transaction history population complete");
    
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