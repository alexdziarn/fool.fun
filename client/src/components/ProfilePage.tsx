import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, clusterApiUrl, PublicKey } from '@solana/web3.js';
import { PROGRAM_ID } from '../config/constants';
import { TokenPage } from './TokenPage';
import { SortTokens, SortOption } from './SortTokens';

interface OwnedToken {
  pubkey: string;
  name: string;
  symbol: string;
  description: string;
  image: string;
  currentHolder: string;
  minter: string;
  currentPrice: number;
  nextPrice: number;
  createdAt?: number;
}

export const ProfilePage = ({ walletAddress, onBack, onViewToken }: {
  walletAddress: string;
  onBack: () => void;
  onViewToken: (tokenId: string) => void;
}) => {
  const { publicKey } = useWallet();
  const [ownedTokens, setOwnedTokens] = useState<OwnedToken[]>([]);
  const [selectedToken, setSelectedToken] = useState<any>(null);
  const [sortBy, setSortBy] = useState<SortOption>('price-desc');
  const [refreshing, setRefreshing] = useState(false);

  const fetchOwnedTokens = async () => {
    if (!publicKey) return;
    
    try {
      setRefreshing(true);
      const connection = new Connection(clusterApiUrl('devnet'));
      const accounts = await connection.getProgramAccounts(PROGRAM_ID);
      
      // First get all token data without creation times
      const tokensWithoutDates = accounts.map(({ pubkey, account }) => {
        const data = account.data;
        let offset = 8; // Skip discriminator

        // Parse token data
        const nameLength = data.readUInt32LE(offset);
        offset += 4;
        const name = data.slice(offset, offset + nameLength).toString();
        offset += nameLength;

        const symbolLength = data.readUInt32LE(offset);
        offset += 4;
        const symbol = data.slice(offset, offset + symbolLength).toString();
        offset += symbolLength;

        const descriptionLength = data.readUInt32LE(offset);
        offset += 4;
        const description = data.slice(offset, offset + descriptionLength).toString();
        offset += descriptionLength;

        const imageLength = data.readUInt32LE(offset);
        offset += 4;
        const image = data.slice(offset, offset + imageLength).toString();
        offset += imageLength;

        const currentHolder = new PublicKey(data.slice(offset, offset + 32)).toString();
        offset += 32;
        const minter = new PublicKey(data.slice(offset, offset + 32)).toString();
        offset += 32;
        offset += 32; // skip dev

        const currentPrice = Number(data.readBigUInt64LE(offset)) / 1_000_000_000;
        offset += 8;
        const nextPrice = Number(data.readBigUInt64LE(offset)) / 1_000_000_000;

        return {
          pubkey: pubkey.toString(),
          name,
          symbol,
          description,
          image,
          currentHolder,
          minter,
          currentPrice,
          nextPrice,
          createdAt: 0
        };
      });

      const userTokens = tokensWithoutDates.filter(
        token => token.currentHolder === publicKey.toString()
      );
      setOwnedTokens(userTokens); // Set tokens immediately

      // Then fetch creation times in batches
      const BATCH_SIZE = 4;
      for (let i = 0; i < userTokens.length; i += BATCH_SIZE) {
        const batch = userTokens.slice(i, i + BATCH_SIZE);
        
        const updatedBatch = await Promise.all(
          batch.map(async (token) => {
            try {
              const signatures = await connection.getSignaturesForAddress(
                new PublicKey(token.pubkey),
                { limit: 1 }
              );
              return {
                ...token,
                createdAt: signatures[0]?.blockTime || 0
              };
            } catch (error) {
              console.error(`Error fetching creation time for token ${token.name}:`, error);
              return token;
            }
          })
        );

        setOwnedTokens(currentTokens => {
          const tokensCopy = [...currentTokens];
          updatedBatch.forEach(updatedToken => {
            const index = tokensCopy.findIndex(t => t.pubkey === updatedToken.pubkey);
            if (index !== -1) {
              tokensCopy[index] = updatedToken;
            }
          });
          return tokensCopy;
        });

        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error('Error fetching owned tokens:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOwnedTokens();
  }, [publicKey]);

  const sortTokens = (tokensToSort: OwnedToken[]) => {
    return [...tokensToSort].sort((a, b) => {
      switch (sortBy) {
        case 'price-asc':
          return a.currentPrice - b.currentPrice;
        case 'price-desc':
          return b.currentPrice - a.currentPrice;
        case 'latest-buy':
          return 0; // We'll implement this later
        case 'creation-date':
          return (b.createdAt || 0) - (a.createdAt || 0); // Newest first
        default:
          return 0;
      }
    });
  };

  if (selectedToken) {
    return (
      <TokenPage 
        token={selectedToken} 
        onBack={() => {
          setSelectedToken(null);
          fetchOwnedTokens(); // Refresh tokens when returning
        }}
        onUpdate={fetchOwnedTokens}
      />
    );
  }

  if (!publicKey) {
    return <div>Please connect your wallet to view your profile.</div>;
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-2">Your Profile</h2>
        <p className="text-gray-400 font-mono">
          Wallet: {publicKey?.toString()}
        </p>
      </div>

      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">Your Tokens ({ownedTokens.length})</h3>
          <div className="flex gap-4 items-center">
            <SortTokens sortBy={sortBy} onChange={setSortBy} />
            <button
              onClick={fetchOwnedTokens}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors disabled:bg-purple-400"
              disabled={refreshing}
            >
              {refreshing ? (
                <div className="flex items-center">
                  <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Refreshing...
                </div>
              ) : (
                'Refresh'
              )}
            </button>
          </div>
        </div>
        {ownedTokens.length === 0 ? (
          <p className="text-gray-400">You don't own any tokens yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortTokens(ownedTokens).map(token => (
              <div 
                key={token.pubkey} 
                className="bg-gray-700 rounded-lg p-4 cursor-pointer hover:bg-gray-600 transition-all duration-200"
                onClick={() => onViewToken(token.pubkey)}
              >
                <img src={token.image} alt={token.name} className="w-full h-48 object-cover rounded-lg mb-4" />
                <h4 className="text-lg font-bold mb-2">{token.name}</h4>
                <p className="text-gray-400 mb-2">{token.symbol}</p>
                <div className="flex justify-between text-sm">
                  <span>Current Price:</span>
                  <span className="font-bold">{token.currentPrice} SOL</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Next Price:</span>
                  <span className="font-bold">{token.nextPrice} SOL</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}; 