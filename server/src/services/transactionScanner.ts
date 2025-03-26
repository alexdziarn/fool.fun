import { Connection, clusterApiUrl, PublicKey, VersionedBlockResponse, ParsedAccountsModeBlockResponse, VersionedMessage } from '@solana/web3.js';
import { PROGRAM_ID } from '../constants';
import { queueTransactionUpdate } from './queueService';
import { DBTransaction, DBTransactionType, Token } from '../types';
import { Transaction, ConfirmedTransactionMeta, TransactionVersion } from '@solana/web3.js';
import { getTransactionToFromNew, getTransactionType } from '../db/transactions';
import { getSingleTokenDataFromBlockchain } from '../db/populate-tokens';

/**
 * Continuously scans blocks for program transactions
 * @param startBlock The block number to start scanning from
 * @param delayMs Delay when caught up to current slot in milliseconds (default: 1000)
 * @param onTransaction Callback function called when a program transaction is found
 */
export async function scanBlocks(
  startBlock: number,
  delayMs: number = 1000,
  onTransaction?: (blockNumber: number, transactions: Array<{
    transaction: { message: VersionedMessage; signatures: string[] };
    meta: ConfirmedTransactionMeta | null;
    version?: TransactionVersion;
  }>) => void
) {
  try {
    const connection = new Connection(clusterApiUrl('devnet'));
    let currentBlock = startBlock;

    console.log(`Starting block scanner from block ${startBlock}`);

    // Function to process a single block
    async function processBlock(blockNumber: number) {
      try {
        console.log(`Processing block ${blockNumber}`);

        // Get the block data
        const block = await connection.getBlock(blockNumber, {
          maxSupportedTransactionVersion: 0,
          commitment: 'confirmed'
        });

        if (!block) {
          console.log(`No block data found for block ${blockNumber}`);
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
          // console.log(`Found ${programTransactions.length} program transactions in block ${blockNumber}`);
          // console.log(programTransactions);

          for (const tx of programTransactions) {
            const type = getTransactionType(tx.meta?.logMessages || []);

            let token: Token | null = null;
            let amount: number | null = null;

            console.log("tx", tx);
            console.log("tx.meta", tx.meta);
            console.log("tx.transaction", tx.transaction);

            
            // figure way to get amount from the transaction
            const {from, to, token_id} = getTransactionToFromNew(type, tx);

            console.log("from", from);
            console.log("to", to);

            if (type === DBTransactionType.STEAL) {
              // getSingleTokenDataFromBlockchain is getting old data, need to update
              token = await getSingleTokenDataFromBlockchain(token_id, connection);
              amount = token?.current_price || null
            }

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

            console.log("Transaction pre-queue insert", transaction);

            // add the transaction to the queue
            await queueTransactionUpdate(transaction);

          }

          // Call the callback if provided
          onTransaction?.(blockNumber, programTransactions);
        }
        
        currentBlock++;

      } catch (error: any) {
        // Handle skipped blocks or missing blocks due to ledger jumps
        if (error?.code === -32007) {
          console.log(`Block ${blockNumber} was skipped or missing due to ledger jump, continuing to next block`);
          currentBlock++;
          return;
        }
        console.error(`Error processing block ${blockNumber}:`, error);
        throw error;
      }
    }

    // Subscribe to slot changes for new blocks
    const slotSubscription = connection.onSlotChange((slotInfo) => {
      // When we get a new slot, process the current block
      processBlock(currentBlock).catch(error => {
        console.error(`Error processing block ${currentBlock}:`, error);
      });
    });

    // Continuously process blocks until we catch up
    while (true) {
      try {
        const currentSlot = await connection.getSlot();

        if (currentBlock > currentSlot) {
          console.log(`Caught up to current slot ${currentSlot}, waiting for new blocks...`);
          break;
        }

        await processBlock(currentBlock);

      } catch (error) {
        console.error(`Error processing historical blocks:`, error);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    // Keep the process running
    await new Promise(() => { });

  } catch (error) {
    console.error('Fatal error in block scanner:', error);
    throw error;
  }
}

/**
 * Starts scanning from the latest confirmed block
 * @param delayMs Delay when caught up to current slot in milliseconds (default: 1000)
 * @param onTransaction Callback function called when a program transaction is found
 */
export async function startScanningFromLatest(
    delayMs: number = 1000,
    onTransaction?: (blockNumber: number, transactions: Array<{
      transaction: { message: VersionedMessage; signatures: string[] };
      meta: ConfirmedTransactionMeta | null;
      version?: TransactionVersion;
    }>) => void
) {
    try {
        const connection = new Connection(clusterApiUrl('devnet'));
        const currentSlot = await connection.getSlot('confirmed');
        
        console.log(`Starting scanner from latest confirmed block ${currentSlot}`);
        
        // Start scanning from the latest block
        await scanBlocks(currentSlot, delayMs, onTransaction);
        
    } catch (error) {
        console.error('Error starting scanner from latest block:', error);
        throw error;
    }
}

// Only run this code if the file is being executed directly
if (require.main === module) {
  startScanningFromLatest();
}