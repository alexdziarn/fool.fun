import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  LAMPORTS_PER_SOL,
  Connection, 
  clusterApiUrl, 
  TransactionInstruction,
  ParsedInstruction,
  ParsedTransactionWithMeta
} from '@solana/web3.js';
import { PROGRAM_ID, DEV_WALLET } from '../config/constants';

interface TokenPageProps {
  tokenId: string;
  onBack: () => void;
  onViewProfile: (address: string) => void;
}

interface Token {
  id: string;
  name: string;
  symbol: string;
  description: string;
  image: string;
  currentHolder: string;
  minter: string;
  currentPrice: number;
  nextPrice: number;
}

interface TransactionHistory {
  signature: string;
  type: 'steal' | 'transfer' | 'create';
  timestamp: number;
  from: string;
  to: string;
  amount?: number;
}

export const TokenPage = ({ tokenId, onBack, onViewProfile }: TokenPageProps) => {
  const { publicKey, sendTransaction } = useWallet();
  const [token, setToken] = useState<Token | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [stealAmount, setStealAmount] = useState(0);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferAddress, setTransferAddress] = useState('');
  const [transferError, setTransferError] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [transactions, setTransactions] = useState<TransactionHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [transferSuccess, setTransferSuccess] = useState(false);
  const [transferInProgress, setTransferInProgress] = useState(false);

  // Load token data on mount
  useEffect(() => {
    const loadToken = async () => {
      try {
        setIsLoading(true);
        const connection = new Connection(clusterApiUrl('devnet'));
        const tokenPubkey = new PublicKey(tokenId);
        const account = await connection.getAccountInfo(tokenPubkey);
        
        if (!account) {
          throw new Error('Token not found');
        }

        // Parse token data
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

        const tokenData = {
          id: tokenId,
          name,
          symbol,
          description,
          image,
          currentHolder,
          minter,
          currentPrice,
          nextPrice
        };

        setToken(tokenData);
        setStealAmount(currentPrice); // Initialize steal amount with current price

      } catch (err) {
        console.error('Error loading token:', err);
        setError(err instanceof Error ? err.message : 'Failed to load token');
      } finally {
        setIsLoading(false);
      }
    };

    loadToken();
  }, [tokenId]);

  // Extract fetchTransactionHistory outside the useEffect
  const fetchTransactionHistory = async () => {
    if (!token) return;
    
    try {
      setLoadingHistory(true);
      const connection = new Connection(clusterApiUrl('devnet'));
      
      const [tokenPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('token'),
          new PublicKey(token.minter).toBuffer(),
          Buffer.from(token.name)
        ],
        PROGRAM_ID
      );

      // 1. Get all signatures in one call
      const signatures = await connection.getSignaturesForAddress(tokenPDA);
      
      // 2. Batch process transactions (10 at a time to avoid rate limits)
      const BATCH_SIZE = 10;
      const allTransactions: TransactionHistory[] = [];
      
      for (let i = 0; i < signatures.length; i += BATCH_SIZE) {
        const batch = signatures.slice(i, i + BATCH_SIZE);
        
        // Process this batch in parallel
        const batchPromises: Promise<ParsedTransactionWithMeta | null>[] = batch.map(sig => 
          connection.getParsedTransaction(sig.signature, {
            maxSupportedTransactionVersion: 0
          })
        );
        
        // Wait for all transactions in this batch to be fetched
        const txBatch = await Promise.all(batchPromises);
        
        // Process the fetched transactions
        const batchResults = txBatch.map((tx, index) => {
          try {
            if (!tx?.meta?.logMessages) return null;
            
            const sig = batch[index].signature;
            const timestamp = batch[index].blockTime || 0;
            const logs = tx.meta.logMessages;
            
            const isSteal = logs.some(log => log.includes('Instruction: Steal'));
            const isTransfer = logs.some(log => log.includes('Instruction: Transfer'));
            const isCreate = logs.some(log => log.includes('Instruction: Initialize'));
            
            if (!isSteal && !isTransfer && !isCreate) return null;
            
            let amount = 0;
            let from = '';
            let to = '';
            
            if (isSteal) {
              if (!tx?.meta?.innerInstructions) {
                console.log('No inner instructions found');
                return null;
              }
              tx.meta.innerInstructions.forEach((inner) => {
                inner.instructions.slice(0, 3).forEach((ix) => {
                  const parsedIx = ix as ParsedInstruction;
                  if (parsedIx.parsed?.type === 'transfer') {
                    const info = parsedIx.parsed.info;
                    amount += info.lamports / 1e9;
                  }
                });
                to = inner.instructions[0].parsed.info.source;
                from = inner.instructions[0].parsed.info.destination;
              });
            } else if (isCreate) {
              from = 'System';
              to = tx.meta.innerInstructions?.[0]?.instructions[0]?.parsed?.info?.source || '';
            } else if (isTransfer) {
              from = tx.transaction.message.instructions[2].accounts?.[1]?.toString() || '';
              to = tx.transaction.message.instructions[2].accounts?.[2]?.toString() || '';
            }
            
            return {
              signature: sig,
              timestamp,
              type: isSteal ? 'steal' : isTransfer ? 'transfer' : 'create',
              from,
              to,
              amount: isSteal ? amount : undefined
            };
          } catch (error) {
            console.error('Error parsing transaction:', error);
            return null;
          }
        });
        
        // Add valid transactions from this batch
        allTransactions.push(...batchResults.filter((tx): tx is TransactionHistory => tx !== null));
        
        // Add a small delay between batches to avoid rate limiting
        if (i + BATCH_SIZE < signatures.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      setTransactions(allTransactions);
    } catch (error) {
      console.error('Error fetching transaction history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Then in the useEffect, just call the function
  useEffect(() => {
    if (!token) return;
    fetchTransactionHistory();
  }, [token]);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  if (isLoading) {
    return <div>Loading token...</div>;
  }

  if (error || !token) {
    return (
      <div>
        <button onClick={onBack} className="text-gray-400 hover:text-white mb-4">
          ← Back to list
        </button>
        <div className="text-red-500">{error || 'Token not found'}</div>
      </div>
    );
  }

  const isOwner = publicKey?.toBase58() === token.currentHolder;

  const handleSteal = async () => {
    if (!publicKey) return;
    setError('');
    setIsLoading(true);

    try {
      const connection = new Connection(clusterApiUrl('devnet'));
      
      // Add logging for amount being sent
      console.log('Sending amount:', stealAmount, 'SOL');
      console.log('Current price:', token.currentPrice, 'SOL');

      // Check wallet balance using stealAmount
      const balance = await connection.getBalance(publicKey);
      const requiredBalance = stealAmount * LAMPORTS_PER_SOL + 0.001 * LAMPORTS_PER_SOL;
      
      if (balance < requiredBalance) {
        throw new Error(`Insufficient balance. Need ${stealAmount + 0.001} SOL (including fees)`);
      }

      const [tokenPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('token'),
          new PublicKey(token.minter).toBuffer(),
          Buffer.from(token.name)
        ],
        PROGRAM_ID
      );

      // Create instruction data with amount
      const amountBuffer = Buffer.alloc(8);
      console.log("stealAmount", stealAmount);
      const amountInLamports = BigInt(Math.floor(stealAmount * LAMPORTS_PER_SOL));
      amountBuffer.writeBigUInt64LE(amountInLamports);

      const instructionData = Buffer.concat([
        Buffer.from([106, 222, 218, 118, 8, 131, 144, 221]), // steal discriminator
        amountBuffer // steal amount in lamports
      ]);

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: tokenPDA, isSigner: false, isWritable: true },          // token
          { pubkey: publicKey, isSigner: true, isWritable: true },          // stealer
          { pubkey: new PublicKey(token.currentHolder), isSigner: false, isWritable: true }, // current_holder
          { pubkey: new PublicKey(DEV_WALLET), isSigner: false, isWritable: true }, // dev
          { pubkey: new PublicKey(token.minter), isSigner: false, isWritable: true }, // minter
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false } // system_program
        ],
        programId: PROGRAM_ID,
        data: instructionData  // Use the instruction data with amount
      });

      const transaction = new Transaction();
      transaction.add(instruction);

      const latestBlockhash = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = latestBlockhash.blockhash;
      transaction.feePayer = publicKey;

      // Simulate transaction
      console.log('Simulating transaction...');
      const simulation = await connection.simulateTransaction(transaction);
      
      if (simulation.value.err) {
        console.error('Simulation error:', simulation.value.logs);
        throw new Error(`Simulation failed: ${simulation.value.err.toString()}`);
      }

      // Log simulation results
      console.log('Simulation successful. Logs:', simulation.value.logs);

      // Execute transaction
      const signature = await sendTransaction(transaction, connection);
      console.log("Transaction sent:", signature);

      // Wait for confirmation and get transaction details
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');
      const txDetails = await connection.getTransaction(signature, { maxSupportedTransactionVersion: 0 });
      
      if (txDetails) {
        console.log('Transaction details:', txDetails);
        // Look for refund in transaction details
        const postBalances = txDetails.meta?.postBalances;
        const preBalances = txDetails.meta?.preBalances;
        if (postBalances && preBalances) {
          const balanceChange = (postBalances[1] - preBalances[1]) / LAMPORTS_PER_SOL;
          console.log('Balance change:', balanceChange, 'SOL');
        }
      }

      console.log('Token stolen successfully!');
      onViewProfile(token.currentHolder);
      onBack();
    } catch (err: any) {
      console.error('Failed to steal token:', err);
      setError(err.message || 'Failed to steal token. Please try again.');
      onViewProfile(token.currentHolder);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (!publicKey) return;
    setTransferError('');
    setTransferInProgress(true);
    setIsTransferring(true);
    setTransferSuccess(false);

    try {
      // Validate the transfer address
      const recipientPubkey = new PublicKey(transferAddress);
      
      const [tokenPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('token'),
          new PublicKey(token.minter).toBuffer(),
          Buffer.from(token.name)
        ],
        PROGRAM_ID
      );

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: tokenPDA, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: false },
          { pubkey: recipientPubkey, isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
        ],
        programId: PROGRAM_ID,
        data: Buffer.from([163, 52, 200, 231, 140, 3, 69, 186]) // transfer discriminator
      });

      const transaction = new Transaction();
      transaction.add(instruction);

      const connection = new Connection(clusterApiUrl('devnet'));
      const latestBlockhash = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = latestBlockhash.blockhash;
      transaction.feePayer = publicKey;

      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature, 'confirmed');

      console.log('Token transferred successfully!');
      setTransferSuccess(true);
    } catch (err: any) {
      console.error('Failed to transfer token:', err);
      setTransferError(err.message || 'Failed to transfer token. Please try again.');
    } finally {
      setIsTransferring(false);
      setTransferInProgress(false);
    }
  };

  const TransferModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
        {transferSuccess ? (
          <div className="flex flex-col items-center justify-center p-4">
            <div className="w-16 h-16 bg-green-800 rounded-full flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-green-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-4 text-center">Token Transferred Successfully!</h3>
            <button
              onClick={() => {
                setShowTransferModal(false);
                setTransferSuccess(false);
              }}
              className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-500 mt-4"
            >
              Close
            </button>
          </div>
        ) : transferInProgress ? (
          <div className="flex flex-col items-center justify-center p-4">
            <svg className="animate-spin h-10 w-10 mb-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p>Processing transfer...</p>
          </div>
        ) : (
          <>
            <h3 className="text-xl font-bold mb-4">Transfer Token</h3>
            <div className="mb-4">
              <label className="block text-sm mb-2">Recipient Address</label>
              <input
                type="text"
                value={transferAddress}
                onChange={(e) => setTransferAddress(e.target.value)}
                className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-white"
                placeholder="Enter Solana address"
              />
            </div>
            {transferError && (
              <p className="text-red-500 text-sm mb-4">{transferError}</p>
            )}
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setShowTransferModal(false)}
                className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleTransfer}
                disabled={isTransferring || !transferAddress}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-500 disabled:bg-gray-600"
              >
                {isTransferring ? 'Transferring...' : 'Transfer'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto p-6 bg-gray-800 rounded-lg">
      <button 
        onClick={onBack}
        className="mb-4 text-gray-400 hover:text-white"
      >
        ← Back to list
      </button>
      
      <div className="flex gap-6">
        <img 
          src={token.image} 
          alt={token.name} 
          className="w-64 h-64 object-cover rounded-lg"
        />
        
        <div className="flex-1">
          <h1 className="text-3xl font-bold mb-2">{token.name}</h1>
          <p className="text-gray-400 mb-4">{token.symbol}</p>
          <p className="mb-6">{token.description}</p>
          
          <div className="space-y-2 mb-6">
            <div className="flex justify-between">
              <span>Current Price:</span>
              <span className="font-bold">{token.currentPrice} SOL</span>
            </div>
            <div className="flex justify-between">
              <span>Next Price:</span>
              <span className="font-bold">{token.nextPrice} SOL</span>
            </div>
            <div className="flex justify-between">
              <span>Current Holder:</span>
              <span 
                className="font-mono cursor-pointer text-blue-400 hover:text-blue-300"
                onClick={() => onViewProfile(token.currentHolder)}
              >
                {formatAddress(token.currentHolder)}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <input
                type="number"
                value={stealAmount}
                onChange={(e) => setStealAmount(Number(e.target.value))}
                min={token.currentPrice}
                step={0.1}
                className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-white"
                disabled={isOwner}
              />
              <span className={isOwner ? "text-gray-500" : ""}>SOL</span>
            </div>
            
            <p className="text-sm text-gray-400">
              Transaction requires an additional ~0.001 SOL for fees
            </p>
            
            {error && <p className="text-red-500 text-sm">{error}</p>}
            
            <button 
              className="w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors disabled:bg-gray-600"
              onClick={handleSteal}
              disabled={isLoading || !publicKey || stealAmount < token.currentPrice || isOwner}
            >
              {isOwner ? (
                "You own this token"
              ) : isLoading ? (
                <div className="flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Stealing...
                </div>
              ) : (
                `Buy for ${stealAmount} SOL`
              )}
            </button>
          </div>
        </div>
      </div>

      {isOwner && (
        <button 
          onClick={() => setShowTransferModal(true)}
          className="w-full mt-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
        >
          Transfer Token
        </button>
      )}

      {showTransferModal && <TransferModal />}

      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">Transaction History</h2>
        {loadingHistory ? (
          <div className="flex justify-center p-4">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : transactions.length === 0 ? (
          <p className="text-gray-400">No transaction history available</p>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div 
                key={tx.signature} 
                className="bg-gray-700 p-4 rounded-lg"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-sm px-2 py-1 rounded ${
                    tx.type === 'steal' ? 'bg-red-900 text-red-200' : 
                    tx.type === 'transfer' ? 'bg-blue-900 text-blue-200' :
                    'bg-green-900 text-green-200'
                  }`}>
                    {tx.type === 'create' ? 'Create' : tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
                  </span>
                  <span className="text-sm text-gray-400">
                    {new Date(tx.timestamp * 1000).toLocaleString()}
                  </span>
                </div>
                <div className="text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">From:</span>
                    <span>{formatAddress(tx.from)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">To:</span>
                    <span>{formatAddress(tx.to)}</span>
                  </div>
                  {tx.amount !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Amount:</span>
                      <span>{(tx.amount).toFixed(4)} SOL</span>
                    </div>
                  )}
                </div>
                <a 
                  href={`https://solscan.io/tx/${tx.signature}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 mt-2 block"
                >
                  View on Solscan
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}; 