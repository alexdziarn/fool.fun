import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { gql } from '@apollo/client';
import { useWallet } from '@solana/wallet-adapter-react';
import { 
  PublicKey, 
  Transaction as SolanaTransaction,
  SystemProgram, 
  LAMPORTS_PER_SOL,
  Connection, 
  clusterApiUrl, 
  TransactionInstruction
} from '@solana/web3.js';
import { PROGRAM_ID, DEV_WALLET } from '../config/constants';

const GET_TOKEN = gql`
  query GetToken($id: ID!) {
    token(id: $id) {
      id
      name
      symbol
      description
      image
      currentHolder
      minter
      currentPrice
      nextPrice
      createdAt
      transactions {
        signature
        type
        timestamp
        from
        to
        amount
      }
    }
  }
`;

interface TokenPageProps {
  tokenId: string;
  onBack: () => void;
  onViewProfile: (address: string) => void;
}

interface TokenTransaction {
  signature: string;
  type: 'steal' | 'transfer';
  timestamp: number;
  from: string;
  to: string;
  amount?: number;
}

export const TokenPage = ({ tokenId, onBack, onViewProfile }: TokenPageProps) => {
  const { publicKey, sendTransaction } = useWallet();
  const { loading, error, data, refetch } = useQuery(GET_TOKEN, {
    variables: { id: tokenId }
  });
  const [stealAmount, setStealAmount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferAddress, setTransferAddress] = useState('');
  const [transferError, setTransferError] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);

  if (loading) return <div>Loading token...</div>;
  if (error) return <div>Error loading token: {error.message}</div>;
  if (!data?.token) return <div>Token not found</div>;

  const token = data.token;
  console.log('Token data:', token);
  console.log('Transactions:', token.transactions);
  const isOwner = publicKey?.toBase58() === token.currentHolder;

  const handleSteal = async () => {
    if (!publicKey) return;
    setErrorMsg('');
    setIsLoading(true);

    try {
      const connection = new Connection(clusterApiUrl('devnet'));
      
      // Check wallet balance
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

      // Create steal instruction
      const amountBuffer = Buffer.alloc(8);
      const amountInLamports = BigInt(Math.floor(stealAmount * LAMPORTS_PER_SOL));
      amountBuffer.writeBigUInt64LE(amountInLamports);

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: tokenPDA, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: new PublicKey(token.currentHolder), isSigner: false, isWritable: true },
          { pubkey: new PublicKey(DEV_WALLET), isSigner: false, isWritable: true },
          { pubkey: new PublicKey(token.minter), isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
        ],
        programId: PROGRAM_ID,
        data: Buffer.concat([
          Buffer.from([106, 222, 218, 118, 8, 131, 144, 221]), // steal discriminator
          amountBuffer
        ])
      });

      const transaction = new SolanaTransaction().add(instruction);
      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature);

      refetch();
      onBack();
    } catch (err: any) {
      console.error('Failed to steal token:', err);
      setErrorMsg(err.message || 'Failed to steal token');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (!publicKey) return;
    setTransferError('');
    setIsTransferring(true);

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

      const transaction = new SolanaTransaction();
      transaction.add(instruction);

      const connection = new Connection(clusterApiUrl('devnet'));
      const latestBlockhash = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = latestBlockhash.blockhash;
      transaction.feePayer = publicKey;

      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature, 'confirmed');

      console.log('Token transferred successfully!');
      setShowTransferModal(false);
      onBack();
    } catch (err: any) {
      console.error('Failed to transfer token:', err);
      setTransferError(err.message || 'Failed to transfer token. Please try again.');
    } finally {
      setIsTransferring(false);
    }
  };

  const formatAddress = (address: string) => {
    return address;
  };

  const TransferModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
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
              <button
                onClick={() => onViewProfile(token.currentHolder)}
                className="font-mono hover:text-purple-400 transition-colors"
              >
                {formatAddress(token.currentHolder)}
              </button>
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
            
            {errorMsg && <p className="text-red-500 text-sm">{errorMsg}</p>}
            
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
        {data.token.transactions.length === 0 ? (
          <p className="text-gray-400">No transaction history available</p>
        ) : (
          <div className="space-y-2">
            {data.token.transactions.map((tx: TokenTransaction) => (
              <div 
                key={tx.signature} 
                className="bg-gray-700 p-4 rounded-lg"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-sm px-2 py-1 rounded ${
                    tx.type === 'steal' ? 'bg-red-900 text-red-200' : 'bg-blue-900 text-blue-200'
                  }`}>
                    {tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
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
                      <span>{tx.amount.toFixed(2)} SOL</span>
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