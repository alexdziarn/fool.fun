import { Connection, clusterApiUrl, PublicKey, VersionedBlockResponse, ParsedAccountsModeBlockResponse, VersionedMessage } from '@solana/web3.js';
import { PROGRAM_ID } from '../constants';
import { queueTransactionUpdate } from './transactionQueueService';
import { DBTransaction, DBTransactionType, EmailData, Token } from '../types';
import { Transaction, ConfirmedTransactionMeta, TransactionVersion, TokenBalance } from '@solana/web3.js';
import { calculateAmountFromInnerInstructions, getTransactionToFromNew, getTransactionType } from '../db/transactions';
import { getData, getSingleTokenDataFromBlockchain } from '../db/populate-tokens';
import { queueEmail } from './emailQueueService';

const MAX_CONCURRENT_BLOCKS = 5; // Number of blocks to process in parallel

/**
 * Continuously scans blocks for program transactions
 * @param startBlock The block number to start scanning from
 * @param onTransaction Callback function called when a program transaction is found
 */
export async function scanBlocks(
  startBlock: number,
  onTransaction?: (blockNumber: number, transactions: Array<{
    transaction: { message: VersionedMessage; signatures: string[] };
    meta: ConfirmedTransactionMeta | null;
    version?: TransactionVersion;
  }>) => void
) {
  try {
    const connection = new Connection(clusterApiUrl('devnet'));
    const processingBlocks = new Set<number>();

    console.log(`Starting block scanner from block ${startBlock}`);

    // Function to process a single block
    async function processBlock(blockNumber: number) {
      try {
        console.log(`[Block ${blockNumber}] Starting processing`);

        // Get the block data with retries
        let block = null;
        try {
          block = await connection.getBlock(blockNumber, {
            maxSupportedTransactionVersion: 0,
            commitment: 'confirmed'
          });
        } catch (error: any) {
          if (error?.code === -32004) {
            // Block not available yet, wait and retry
            await new Promise(resolve => setTimeout(resolve, 100));
          } else {
            throw error;
          }
        }

        if (!block) {
          console.log(`[Block ${blockNumber}] No block data found after retries, adding back to queue`);
          // Add the block back to the beginning of the queue
          queue.unshift(blockNumber);
          return;
        }

        // Filter transactions that involve our program
        const programTransactions = block.transactions.filter(tx => {
          // Check if any instruction in the transaction involves our program
          return tx.transaction.message.compiledInstructions.some(ix =>
            tx.transaction.message.staticAccountKeys[ix.programIdIndex].equals(PROGRAM_ID)
          );
        });

        if (programTransactions.length > 0) {
          console.log(`[Block ${blockNumber}] Found ${programTransactions.length} program transactions`);
          // Process transactions in parallel
          await Promise.all(programTransactions.map(async (tx) => {
            const type = getTransactionType(tx.meta?.logMessages || []);
            // console.log(`[Block ${blockNumber}] Processing ${type} transaction ${tx.transaction.signatures[0]}`);

            let token: Token | null = null;
            let amount: number | null = null;
            const { from, to, token_id } = getTransactionToFromNew(type, tx);

            // Batch token and amount calculations
            const [tokenData, calculatedAmount] = await Promise.all([
              (type === DBTransactionType.STEAL || type === DBTransactionType.CREATE) 
                ? getSingleTokenDataFromBlockchain(token_id, blockNumber)
                : Promise.resolve(null),
              type === DBTransactionType.STEAL 
                ? Promise.resolve(calculateAmountFromInnerInstructions(tx.meta?.innerInstructions))
                : Promise.resolve(null)
            ]);

            token = tokenData;
            amount = calculatedAmount;

            // start creating a new transaction object
            const transaction: DBTransaction = {
              id: tx.transaction.signatures[0],
              token_id,
              token,
              type,
              from_address: from,
              to_address: to,
              amount,
              success: true,
              block_number: blockNumber,
              timestamp: block.blockTime ? new Date(block.blockTime * 1000) : new Date(),
            }

            // Batch queue operations
            await Promise.all([
              queueTransactionUpdate(transaction),
              // queueEmail({
              //   from,
              //   to,
              //   type: type as 'steal' | 'transfer' | 'create',
              //   token_id,
              //   amount,
              // })
            ]);
          }));

          // Call the callback if provided
          onTransaction?.(blockNumber, programTransactions);
        }

      } catch (error: any) {
        // Handle skipped blocks or missing blocks due to ledger jumps
        if (error?.code === -32007) {
          console.log(`Block ${blockNumber} was skipped or missing due to ledger jump, continuing to next block`);
        } else {
          console.error(`Error processing block ${blockNumber}:`, error);
        }
      }
    }


    const queue: number[] = [];
    const failedBlocks = new Set<number>();

    // Subscribe to slot changes for new blocks
    const slotSubscription = connection.onSlotChange(async (slotInfo) => {
      const newSlot = slotInfo.slot;
      queue.push(newSlot);
      
      if (queue.length >= 5) {
        console.log(`Processing blocks ${queue[0]} to ${queue[4]}`);
        
        // Process blocks in parallel but track failures
        const blockPromises = queue.splice(0, 5).sort((a, b) => a - b).map(async (blockNumber) => {
          try {
            await processBlock(blockNumber);
          } catch (error) {
            console.error(`Failed to process block ${blockNumber}:`, error);
            failedBlocks.add(blockNumber);
          }
        });

        // Wait for all blocks to complete processing
        await Promise.allSettled(blockPromises);
      }
    });

  } catch (error) {
    console.error('Fatal error in block scanner:', error);
    throw error;
  }
}

/**
 * Starts scanning from the latest confirmed block
 * @param onTransaction Callback function called when a program transaction is found
 */
export async function startScanningFromLatest(
  onTransaction?: (blockNumber: number, transactions: Array<{
    transaction: { message: VersionedMessage; signatures: string[] };
    meta: ConfirmedTransactionMeta | null;
    version?: TransactionVersion;
  }>) => void
) {
  try {
    const connection = new Connection(clusterApiUrl('devnet'));
    const currentSlot = await connection.getSlot('confirmed');
    
    console.log(`Starting scanner from current slot ${currentSlot}`);

    // Start scanning from the current slot
    await scanBlocks(currentSlot, onTransaction);

  } catch (error) {
    console.error('Error starting scanner from latest block:', error);
    throw error;
  }
}

// Only run this code if the file is being executed directly
if (require.main === module) {
  startScanningFromLatest();
}