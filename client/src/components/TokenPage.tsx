import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  LAMPORTS_PER_SOL,
  Connection, 
  clusterApiUrl, 
  TransactionInstruction
} from '@solana/web3.js';
import { PROGRAM_ID, DEV_WALLET } from '../config/constants';

interface TokenPageProps {
  token: {
    name: string;
    symbol: string;
    description: string;
    image: string;
    currentHolder: string;
    minter: string;
    currentPrice: number;
    nextPrice: number;
  };
  onBack: () => void;
  onUpdate: () => void;
}

export const TokenPage = ({ token, onBack, onUpdate }: TokenPageProps) => {
  const { publicKey, sendTransaction } = useWallet();
  const isOwner = publicKey?.toBase58() === token.currentHolder;
  const [stealAmount, setStealAmount] = useState(token.currentPrice);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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
      onUpdate();
      onBack();
    } catch (err: any) {
      console.error('Failed to steal token:', err);
      setError(err.message || 'Failed to steal token. Please try again.');
      onUpdate();
    } finally {
      setIsLoading(false);
    }
  };

  // Add polling for updates while on token page
  useEffect(() => {
    const interval = setInterval(() => {
      onUpdate();
    }, 5000);

    return () => clearInterval(interval);
  }, [onUpdate]);

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
              <span className="font-mono">
                {token.currentHolder.slice(0, 4)}...{token.currentHolder.slice(-4)}
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
    </div>
  );
}; 