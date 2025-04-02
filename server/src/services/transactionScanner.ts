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
    let currentBlock = startBlock;
    const processingBlocks = new Set<number>();

    console.log(`Starting block scanner from block ${startBlock}`);

    // Function to process a single block
    async function processBlock(blockNumber: number) {
      // Skip if already processing this block
      if (processingBlocks.has(blockNumber)) {
        console.log(`Block ${blockNumber} is already being processed, skipping`);
        return;
      }

      try {
        processingBlocks.add(blockNumber);
        // console.log(`[Block ${blockNumber}] Starting processing`);

        // Get the block data with retries
        let block = null;
        let retries = 3;
        while (retries > 0 && !block) {
          try {
            block = await connection.getBlock(blockNumber, {
              maxSupportedTransactionVersion: 0,
              commitment: 'confirmed'
            });
          } catch (error: any) {
            if (error?.code === -32004) {
              // Block not available yet, wait and retry
              await new Promise(resolve => setTimeout(resolve, 100));
              retries--;
            } else {
              throw error;
            }
          }
        }

        if (!block) {
          console.log(`[Block ${blockNumber}] No block data found after retries`);
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
              queueEmail({
                from,
                to,
                type: type as 'steal' | 'transfer' | 'create',
                token_id,
                amount,
              })
            ]);
          }));

          // Call the callback if provided
          onTransaction?.(blockNumber, programTransactions);
        }

      } catch (error: any) {
        // Handle skipped blocks or missing blocks due to ledger jumps
        if (error?.code === -32007) {
          console.log(`Block ${blockNumber} was skipped or missing due to ledger jump, continuing to next block`);
          return;
        }
        console.error(`Error processing block ${blockNumber}:`, error);
        throw error;
      } finally {
        processingBlocks.delete(blockNumber);
      }
    }

    // Subscribe to slot changes for new blocks
    const slotSubscription = connection.onSlotChange(async (slotInfo) => {
      const newSlot = slotInfo.slot;
      if (newSlot > currentBlock) {
        // Only process blocks that are a few slots behind to ensure they're confirmed
        const confirmedSlot = newSlot - 2; // Wait for 2 slots to ensure confirmation
        const blocksToProcess = Math.min(MAX_CONCURRENT_BLOCKS, confirmedSlot - currentBlock);
        
        if (blocksToProcess > 0) {
          console.log(`New slot ${newSlot} detected, processing blocks ${currentBlock} to ${currentBlock + blocksToProcess - 1}`);
          
          // Process multiple blocks in parallel
          const blockPromises = Array.from({ length: blocksToProcess }, (_, i) => 
            processBlock(currentBlock + i)
          );
          
          try {
            await Promise.all(blockPromises);
            currentBlock += blocksToProcess;
          } catch (error) {
            // If any block fails, just increment currentBlock to avoid getting stuck
            console.log(`Some blocks failed to process, continuing from next block`);
            currentBlock += blocksToProcess;
          }
        }
      }
    });

    // Keep the process running
    await new Promise(() => { });

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