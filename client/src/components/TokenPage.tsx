import React, { useState, useEffect } from 'react';
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
import { useQuery } from '@apollo/client';
import { GET_TOKEN_BY_ID } from '../graphql/queries';
import { useParams, useNavigate } from 'react-router-dom';

export interface TokenPageProps {
  tokenId?: string;
  onBack?: () => void;
  onViewProfile?: (address: string) => void;
  onUpdate?: () => void;
  token?: Token;
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
  pubkey?: string;
}

interface Transaction {
  id: string;
  type: string;
  fromAddress: string;
  toAddress: string;
  amount?: number;
  timestamp: string;
  success: boolean;
}

export const TokenPage = ({ tokenId: propTokenId, onBack, onViewProfile, onUpdate, token: propToken }: TokenPageProps) => {
  const params = useParams<{ tokenId: string }>();
  const navigate = useNavigate();
  
  // Use the tokenId from props if provided, otherwise use from URL params
  const tokenId = propTokenId || params.tokenId;
  
  // Define navigation functions if not provided via props
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate('/');
    }
  };
  
  const handleViewProfile = (address: string) => {
    if (onViewProfile) {
      onViewProfile(address);
    } else {
      navigate(`/profile/${address}`);
    }
  };
  
  const { publicKey, sendTransaction } = useWallet();
  const [stealAmount, setStealAmount] = useState(0);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferAddress, setTransferAddress] = useState('');
  const [transferError, setTransferError] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState(false);
  const [transferInProgress, setTransferInProgress] = useState(false);
  const [invalidTokenId, setInvalidTokenId] = useState<string | null>(null);
  const [showStealModal, setShowStealModal] = useState(false);
  const [stealError, setStealError] = useState('');
  const [stealSuccess, setStealSuccess] = useState(false);
  const [stealOriginalPrice, setStealOriginalPrice] = useState(0);

  // Validate token ID format
  useEffect(() => {
    // Check if tokenId is in a valid format (you can customize this validation)
    // For example, if token IDs should be UUIDs or have a specific format
    if (!tokenId || tokenId.trim() === '') {
      setInvalidTokenId('Token ID cannot be empty');
    } else if (tokenId.length < 5) {
      // Example validation - adjust based on your actual token ID format
      setInvalidTokenId('Invalid token ID format');
    } else {
      setInvalidTokenId(null);
    }
  }, [tokenId]);

  // Handle redirection for invalid token ID
  useEffect(() => {
    if (invalidTokenId) {
      // Redirect to token/not-found page
      navigate('/token/not-found', { replace: true });
    }
  }, [invalidTokenId, navigate]);

  // Fetch token data using GraphQL
  const { loading: isLoading, error: queryError, data, refetch } = useQuery(GET_TOKEN_BY_ID, {
    variables: { id: tokenId },
    fetchPolicy: 'cache-and-network',
    skip: !!invalidTokenId, // Skip the query if token ID is invalid
    onCompleted: (data) => {
      // Check if token exists in the response
      if (!data?.getTokenById?.token) {
        console.log('Token not found in GraphQL response, redirecting to token/not-found page');
        navigate('/token/not-found', { replace: true });
      }
    },
    onError: (error) => {
      console.error('GraphQL error when fetching token:', error);
      navigate('/token/not-found', { replace: true });
    }
  });

  // Extract token and transactions from GraphQL response
  const token = data?.getTokenById?.token || null;
  const transactions = data?.getTokenById?.transactions || [];
  const transactionCount = data?.getTokenById?.transactionCount || 0;
  const error = queryError ? queryError.message : '';

  // Set initial steal amount when token data is loaded
  useEffect(() => {
    if (token) {
      setStealAmount(token.currentPrice);
    }
  }, [token]);

  // Handle navigation for invalid or not found tokens
  useEffect(() => {
    if (!isLoading) {
      if (invalidTokenId) {
        navigate('/token/not-found', { replace: true });
      } else if (error || !token) {
        navigate('/token/not-found', { replace: true });
      }
    }
  }, [isLoading, invalidTokenId, error, token, navigate]);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  // Check if the current user is the token owner
  const isOwner = publicKey && token?.currentHolder === publicKey.toString();

  const handleSteal = async () => {
    if (!publicKey || !token) return;
    
    try {
      setTransferInProgress(true);
      setStealOriginalPrice(token.currentPrice); // Store the original price
      const connection = new Connection(clusterApiUrl('devnet'));
      
      // Find the token PDA
      const [tokenPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('token'),
          new PublicKey(token.minter).toBuffer(),
          Buffer.from(token.name)
        ],
        PROGRAM_ID
      );
      
      // Create the steal instruction
      const paymentAmount = stealAmount * LAMPORTS_PER_SOL;
      const stealInstruction = new TransactionInstruction({
        keys: [
          { pubkey: tokenPDA, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: new PublicKey(token.currentHolder), isSigner: false, isWritable: true },
          { pubkey: new PublicKey('8BcW6T4Sm3tMtE9LJET1oU1vQec6m9R8LifnauQwshCi'), isSigner: false, isWritable: true }, // dev account
          { pubkey: new PublicKey(token.minter), isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data: Buffer.concat([
          Buffer.from([106, 222, 218, 118, 8, 131, 144, 221]), // steal instruction discriminator
          Buffer.from(new Uint8Array(new BigUint64Array([BigInt(paymentAmount)]).buffer)) // amount in lamports
        ])
      });
      
      const transaction = new SolanaTransaction();
      
      // Get the latest blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;
      transaction.feePayer = publicKey;
      
      // Add instruction
      transaction.add(stealInstruction);
      
      // Send the transaction
      const signature = await sendTransaction(transaction, connection);
      
      // Wait for confirmation
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      });
      
      if (confirmation.value.err) {
        throw new Error('Transaction failed');
      }
      
      // Refresh token data
      refetch();
      
      // Show success message and close modal after delay
      setStealSuccess(true);
      setTimeout(() => {
        setShowStealModal(false);
        setStealSuccess(false);
        setStealAmount(token.currentPrice); // Reset to current price
      }, 2000);
    } catch (err) {
      console.error('Error stealing token:', err);
      setStealError('Failed to steal token. Please try again.');
    } finally {
      setTransferInProgress(false);
    }
  };
  
  const handleTransfer = async () => {
    if (!publicKey || !token) return;
    
    try {
      setTransferError('');
      
      // Validate address
      let recipientPubkey;
      try {
        recipientPubkey = new PublicKey(transferAddress);
      } catch (err) {
        setTransferError('Invalid Solana address');
        return;
      }
      
      // Don't transfer to self
      if (recipientPubkey.equals(publicKey)) {
        setTransferError('Cannot transfer to yourself');
        return;
      }
      
      setIsTransferring(true);
      const connection = new Connection(clusterApiUrl('devnet'));
      
      // Find the token PDA
      const [tokenPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('token'),
          new PublicKey(token.minter).toBuffer(),
          Buffer.from(token.name)
        ],
        PROGRAM_ID
      );
      
      // Create the instruction
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: tokenPDA, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: recipientPubkey, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data: Buffer.from([163, 52, 200, 231, 140, 3, 69, 186]) // transfer instruction discriminator from IDL
      });
      
      const transaction = new SolanaTransaction();
      transaction.add(instruction);
      
      // Send the transaction
      const signature = await sendTransaction(transaction, connection);
      
      // Wait for confirmation
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');
      
      if (confirmation.value.err) {
        throw new Error('Transaction failed');
      }
      
      // Show success message and close modal
      setTransferSuccess(true);
      setTimeout(() => {
        setShowTransferModal(false);
        setTransferSuccess(false);
        setTransferAddress('');
        
        // Refresh token data
        refetch();
      }, 2000);
    } catch (err) {
      console.error('Error transferring token:', err);
      setTransferError('Failed to transfer token. See console for details.');
    } finally {
      setIsTransferring(false);
    }
  };
  
  // Transfer modal component
  const TransferModal = () => {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-800 p-6 rounded-lg w-full max-w-md">
          <h2 className="text-xl font-bold mb-4">Transfer Token</h2>
          
          {transferSuccess ? (
            <div className="text-green-400 mb-4">
              Token transferred successfully!
            </div>
          ) : isTransferring ? (
            <div className="flex flex-col items-center justify-center py-4">
              <div className="animate-spin text-blue-400 text-5xl mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <p className="text-gray-400">Processing transaction...</p>
            </div>
          ) : (
            <>
              <p className="mb-4">
                Enter the Solana address of the recipient:
              </p>
              
              <input
                type="text"
                value={transferAddress}
                onChange={(e) => setTransferAddress(e.target.value)}
                placeholder="Recipient address"
                className="w-full p-2 mb-4 bg-gray-700 rounded border border-gray-600 text-white"
              />
              
              {transferError && (
                <div className="text-red-400 mb-4">
                  {transferError}
                </div>
              )}
              
              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTransfer}
                  disabled={isTransferring || !transferAddress}
                  className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-500 disabled:bg-blue-800 disabled:opacity-50"
                >
                  Transfer
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const StealModal = () => {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-800 p-6 rounded-lg w-full max-w-md">
          <h2 className="text-xl font-bold mb-4">Steal Token</h2>
          
          {stealSuccess ? (
            <div className="text-green-400 mb-4">
              Successfully stole the token for {stealOriginalPrice} SOL!
            </div>
          ) : transferInProgress ? (
            <div className="flex flex-col items-center justify-center py-4">
              <div className="animate-spin text-blue-400 text-5xl mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <p className="text-gray-400">Processing transaction...</p>
            </div>
          ) : (
            <>
              <p className="mb-4">
                Enter the amount you want to pay (must be at least {token?.currentPrice} SOL):
              </p>
              
              <input
                type="number"
                value={stealAmount}
                onChange={(e) => {
                  const value = parseFloat(e.target.value);
                  if (value >= (token?.currentPrice || 0)) {
                    setStealAmount(value);
                    setStealError('');
                  } else {
                    setStealError(`Amount must be at least ${token?.currentPrice} SOL`);
                  }
                }}
                min={token?.currentPrice}
                step="0.1"
                className="w-full p-2 mb-4 bg-gray-700 rounded border border-gray-600 text-white"
              />
              
              {stealError && (
                <div className="text-red-400 mb-4">
                  {stealError}
                </div>
              )}
              
              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => setShowStealModal(false)}
                  className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSteal}
                  disabled={transferInProgress || stealAmount < (token?.currentPrice || 0)}
                  className="px-4 py-2 bg-red-600 rounded hover:bg-red-500 disabled:bg-red-800 disabled:opacity-50"
                >
                  Steal
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full text-center">
          <div className="animate-spin text-blue-400 text-5xl mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-4">Loading Token</h2>
          <p className="text-gray-400 mb-6">
            Please wait while we fetch the token information...
          </p>
        </div>
      </div>
    );
  }

  if (invalidTokenId) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full text-center">
          <div className="text-yellow-400 text-5xl mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-4">Invalid Token ID</h2>
          <p className="text-gray-400 mb-6">
            {invalidTokenId}
          </p>
        </div>
      </div>
    );
  }

  if (error || !token) {
    return null;
  }

  return (
    <div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Token Info */}
        <div className="md:col-span-1">
          <div className="bg-gray-800 rounded-lg p-6">
            <img 
              src={token.image} 
              alt={token.name} 
              className="w-full h-64 object-cover rounded-lg mb-4"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x300?text=Image+Error';
              }}
            />
            <h1 className="text-2xl font-bold mb-2">{token.name}</h1>
            <p className="text-gray-400 mb-4">{token.symbol}</p>
            <p className="mb-6">{token.description}</p>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-gray-400">Current Price</p>
                <p className="text-xl font-bold">{token.currentPrice} SOL</p>
              </div>
              <div>
                <p className="text-gray-400">Next Price</p>
                <p className="text-xl font-bold">{token.nextPrice} SOL</p>
              </div>
            </div>
            
            <div className="mb-4">
              <p className="text-gray-400 mb-1">Current Holder</p>
              <button 
                onClick={() => handleViewProfile(token.currentHolder)}
                className="text-blue-400 hover:underline"
              >
                {formatAddress(token.currentHolder)}
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-gray-400 mb-1">Minter</p>
              <button 
                onClick={() => handleViewProfile(token.minter)}
                className="text-blue-400 hover:underline"
              >
                {formatAddress(token.minter)}
              </button>
            </div>
            
            {token.pubkey && (
              <div className="mb-4">
                <p className="text-gray-400 mb-1">Token Address</p>
                <a 
                  href={`https://explorer.solana.com/address/${token.pubkey}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  {formatAddress(token.pubkey)}
                </a>
              </div>
            )}
          </div>
        </div>
        
        {/* Transaction History */}
        <div className="md:col-span-2">
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">Transaction History ({transactionCount})</h2>
            
            {transactions.length === 0 ? (
              <p className="text-gray-400">No transactions found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-700">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">From</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">To</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Explorer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {transactions.map((tx: Transaction) => (
                      <tr key={tx.id} className="hover:bg-gray-700">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            tx.type === 'steal' ? 'bg-red-900 text-red-200' : 
                            tx.type === 'transfer' ? 'bg-blue-900 text-blue-200' : 
                            'bg-green-900 text-green-200'
                          }`}>
                            {tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button 
                            onClick={() => handleViewProfile(tx.fromAddress)}
                            className="text-blue-400 hover:underline"
                          >
                            {formatAddress(tx.fromAddress)}
                          </button>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button 
                            onClick={() => handleViewProfile(tx.toAddress)}
                            className="text-blue-400 hover:underline"
                          >
                            {formatAddress(tx.toAddress)}
                          </button>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {tx.amount ? `${tx.amount} SOL` : '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {formatDate(tx.timestamp)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <a 
                            href={`https://solscan.io/tx/${tx.id}?cluster=devnet`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 flex items-center"
                            title="View on Solscan"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            Solscan
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Action buttons and modals would go here */}
      {isOwner && (
        <button 
          onClick={() => setShowTransferModal(true)}
          className="w-full mt-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
        >
          Transfer Token
        </button>
      )}

      {/* Add Steal Token button for users who don't own the token */}
      {!isOwner && publicKey && (
        <button 
          onClick={() => setShowStealModal(true)}
          className="w-full mt-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors"
        >
          Steal Token
        </button>
      )}

      {showTransferModal && <TransferModal />}
      {showStealModal && <StealModal />}
    </div>
  );
}; 