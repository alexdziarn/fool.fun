import { Connection, clusterApiUrl, PublicKey } from '@solana/web3.js';
import { PROGRAM_ID } from '../constants';

/**
 * Determines the type of transaction based on log messages
 * @param logs Array of log messages from the transaction
 * @returns string indicating transaction type
 */
function getTransactionType(logs: string[]): string {
  const isSteal = logs.some(log => log.includes('Instruction: Steal'));
  const isTransfer = logs.some(log => log.includes('Instruction: Transfer'));
  const isCreate = logs.some(log => log.includes('Instruction: Initialize'));

  if (isSteal) return 'steal';
  if (isTransfer) return 'transfer';
  if (isCreate) return 'create';

  return 'unknown';
}

/**
 * Checks if a confirmed block contains any successful transactions involving the program
 * @param blockNumber The block number to check
 * @returns Promise<boolean> indicating whether the block contains successful program transactions
 */
export async function hasProgramTransactions(blockNumber: number): Promise<boolean> {
  try {
    // Connect to Solana devnet
    const connection = new Connection(clusterApiUrl('devnet'));

    // Get the block with transaction details
    const block = await connection.getBlock(blockNumber, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed'
    });

    if (!block) {
      console.log(`Block ${blockNumber} not found`);
      return false;
    }

    // Check each transaction in the block
    for (const tx of block.transactions) {
      // Skip failed transactions
      if (tx.meta?.err) continue;

      // Get account keys from the transaction message
      const accountKeys = tx.transaction.message.staticAccountKeys;

      // Check if the transaction involves our program
      for (const key of accountKeys) {
        if (key.equals(PROGRAM_ID)) {
          console.log(`Found successful program transaction in block ${blockNumber}`);
          return true;
        }
      }
    }

    console.log(`No successful program transactions found in block ${blockNumber}`);
    return false;
  } catch (error) {
    console.error(`Error checking block ${blockNumber}:`, error);
    throw error;
  }
}

/**
 * Gets all successful program transactions from a specific block
 * @param blockNumber The block number to check
 * @returns Promise<Array<{signature: string, accounts: string[], type: string}>> Array of successful program transactions
 */
export async function getProgramTransactions(blockNumber: number): Promise<Array<{ signature: string, accounts: string[], type: string }>> {
  try {
    const connection = new Connection(clusterApiUrl('devnet'));

    const block = await connection.getBlock(blockNumber, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed'
    });

    if (!block) {
      console.log(`Block ${blockNumber} not found`);
      return [];
    }

    const programTransactions: Array<{ signature: string, accounts: string[], type: string }> = [];

    for (const tx of block.transactions) {
      // Skip failed transactions
      if (tx.meta?.err) continue;

      // Get account keys from the transaction message
      const accountKeys = tx.transaction.message.staticAccountKeys;

      // Check if program is involved
      let programInvolved = false;
      for (const key of accountKeys) {
        if (key.equals(PROGRAM_ID)) {
          programInvolved = true;
          break;
        }
      }

      if (programInvolved && tx.meta?.logMessages) {
        const type = getTransactionType(tx.meta.logMessages);

        programTransactions.push({
          signature: tx.transaction.signatures[0],
          accounts: accountKeys.map(key => key.toString()),
          type
        });
      }
    }

    return programTransactions;
  } catch (error) {
    console.error(`Error getting program transactions from block ${blockNumber}:`, error);
    throw error;
  }
}

/**
 * Continuously scans blocks for program transactions
 * @param startBlock The block number to start scanning from
 * @param delayMs Delay when caught up to current slot in milliseconds (default: 1000)
 * @param onTransaction Callback function called when a program transaction is found
 */
export async function scanBlocks(
  startBlock: number,
  delayMs: number = 1000,
  onTransaction?: (blockNumber: number, transactions: Array<{ signature: string, accounts: string[], type: string }>) => void
) {
  try {
    const connection = new Connection(clusterApiUrl('devnet'));
    let currentBlock = startBlock;
    let isProcessing = false;
    
    console.log(`Starting block scanner from block ${startBlock}`);
    
    // Function to process a single block
    async function processBlock(blockNumber: number) {
      try {
        console.log(`Processing block ${blockNumber}`);
        
        // Get transactions from current block
        const transactions = await getProgramTransactions(blockNumber);
        
        if (transactions.length > 0) {
          console.log(`\nFound ${transactions.length} program transactions in block ${blockNumber}`);
          transactions.forEach((tx, index) => {
            console.log(`\nTransaction ${index + 1}:`);
            console.log('Signature:', tx.signature);
            console.log('Type:', tx.type);
            console.log('Accounts involved:', tx.accounts);
          });
          
          // Call the callback if provided
          if (onTransaction) {
            onTransaction(blockNumber, transactions);
          }
        }
        
        // Move to next block
        currentBlock++;
        
      } catch (error) {
        console.error(`Error processing block ${blockNumber}:`, error);
        throw error;
      }
    }

    // Function to check and process the next block if needed
    async function checkAndProcessNextBlock() {
      if (isProcessing) return;
      
      try {
        isProcessing = true;
        const currentSlot = await connection.getSlot();
        
        if (currentBlock <= currentSlot) {
          await processBlock(currentBlock);
        } else {
          console.log(`Caught up to current slot ${currentSlot}, waiting for new blocks...`);
        }
      } catch (error) {
        console.error('Error in checkAndProcessNextBlock:', error);
      } finally {
        isProcessing = false;
      }
    }

    // Subscribe to slot changes for new blocks
    const slotSubscription = connection.onSlotChange(() => {
      checkAndProcessNextBlock().catch(error => {
        console.error('Error processing new block:', error);
      });
    });

    // Process historical blocks until we catch up
    while (true) {
      try {
        const currentSlot = await connection.getSlot();
        
        if (currentBlock > currentSlot) {
          console.log(`Caught up to current slot ${currentSlot}, waiting for new blocks...`);
          break;
        }
        
        await checkAndProcessNextBlock();
        
      } catch (error) {
        console.error(`Error processing historical blocks:`, error);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    // Keep the process running
    await new Promise(() => {});

  } catch (error) {
    console.error('Fatal error in block scanner:', error);
    throw error;
  }
}

// Only run this code if the file is being executed directly
if (require.main === module) {
  // Get command line arguments
  const args = process.argv.slice(2);
  const startBlock = parseInt(args[0]) || 368473568;
  const delayMs = parseInt(args[1]) || 1000;

  // Check if we should run in continuous mode
  const isContinuous = args.includes('--continuous') || args.includes('-c');

  if (isContinuous) {
    console.log(`Starting continuous block scanner from block ${startBlock}`);
    console.log(`Delay between blocks: ${delayMs}ms`);

    scanBlocks(startBlock, delayMs).catch(error => {
      console.error('Scanner failed:', error);
      process.exit(1);
    });
  } else {
    // Run single block check
    console.log(`Checking block ${startBlock} for successful program transactions...`);

    Promise.all([
      hasProgramTransactions(startBlock),
      getProgramTransactions(startBlock)
    ]).then(([hasTransactions, transactions]) => {
      console.log('\nResults:');
      console.log('Has successful program transactions:', hasTransactions);
      console.log('\nSuccessful program transactions found:', transactions.length);
      if (transactions.length > 0) {
        console.log('\nTransaction details:');
        transactions.forEach((tx, index) => {
          console.log(`\nTransaction ${index + 1}:`);
          console.log('Signature:', tx.signature);
          console.log('Type:', tx.type);
          console.log('Accounts involved:', tx.accounts);
        });
      }
    }).catch(error => {
      console.error('Error:', error);
      process.exit(1);
    });
  }
}