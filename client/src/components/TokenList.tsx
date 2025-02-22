import React, { useEffect, useState } from 'react';
import { Connection, PublicKey, clusterApiUrl, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { PROGRAM_ID } from '../config/constants';
import { TokenPage } from './TokenPage';
import { SortTokens, SortOption } from './SortTokens';

interface Token {
  name: string;
  symbol: string;
  description: string;
  image: string;
  currentHolder: string;
  minter: string;
  currentPrice: number;
  nextPrice: number;
  pubkey: string;
  createdAt?: number;
}

export const TokenList = () => {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('price-desc');

  const fetchTokens = async () => {
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

        // Helper to read string
        const readString = () => {
          const len = data.readUInt32LE(offset);
          offset += 4;
          const str = data.slice(offset, offset + len).toString();
          offset += len;
          return str;
        };

        // Read fields in order they appear in CustomToken struct
        const symbol = readString();
        const description = readString();
        const image = readString();
        const currentHolder = new PublicKey(data.slice(offset, offset + 32)).toString();
        offset += 32;
        const minter = new PublicKey(data.slice(offset, offset + 32)).toString();
        offset += 32;
        offset += 32; // skip dev

        // Fix price reading
        const currentPriceLamports = Number(data.readBigUInt64LE(offset));
        const currentPrice = currentPriceLamports / LAMPORTS_PER_SOL;
        // console.log('Current price:', currentPrice);
        offset += 8;
        
        // Add logging for next price data
        // console.log('Next price data:', data.slice(offset, offset + 8));
        const nextPriceLamports = Number(data.readBigUInt64LE(offset));
        const nextPrice = nextPriceLamports / LAMPORTS_PER_SOL;
        // console.log('Next price:', nextPrice);

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
          createdAt: 0 // Default value
        };
      });

      setTokens(tokensWithoutDates); // Set tokens immediately

      // Process fewer tokens with longer delays
      const BATCH_SIZE = 3;
      const BATCH_DELAY = 2000; // 2 seconds
      const MAX_RETRIES = 3;

      for (let i = 0; i < tokensWithoutDates.length; i += BATCH_SIZE) {
        const batch = tokensWithoutDates.slice(i, i + BATCH_SIZE);
        
        let retries = 0;
        let success = false;

        while (!success && retries < MAX_RETRIES) {
          try {
            const updatedBatch = await Promise.all(
              batch.map(async (token) => {
                const signatures = await connection.getSignaturesForAddress(
                  new PublicKey(token.pubkey),
                  { limit: 1 }
                );
                return {
                  ...token,
                  createdAt: signatures[0]?.blockTime || 0
                };
              })
            );

            setTokens(currentTokens => {
              const tokensCopy = [...currentTokens];
              updatedBatch.forEach(updatedToken => {
                const index = tokensCopy.findIndex(t => t.pubkey === updatedToken.pubkey);
                if (index !== -1) {
                  tokensCopy[index] = updatedToken;
                }
              });
              return tokensCopy;
            });

            success = true;
          } catch (error) {
            retries++;
            if (retries === MAX_RETRIES) {
              console.error(`Failed to fetch creation times after ${MAX_RETRIES} retries`);
              return; // Skip this batch
            }
            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, BATCH_DELAY * Math.pow(2, retries)));
          }
        }

        // Wait between batches
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }
    } catch (error) {
      console.error('Error fetching tokens:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchTokens();
  }, []);

  const sortTokens = (tokensToSort: Token[]) => {
    return [...tokensToSort].sort((a, b) => {
      switch (sortBy) {
        case 'price-asc':
          return a.currentPrice - b.currentPrice;
        case 'price-desc':
          return b.currentPrice - a.currentPrice;
        case 'latest-buy':
          return 0; // Not implemented yet
        case 'creation-date':
          return (b.createdAt || 0) - (a.createdAt || 0);
        default:
          return 0;
      }
    });
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  if (selectedToken) {
    return (
      <TokenPage 
        token={selectedToken} 
        onBack={() => {
          setSelectedToken(null);
          fetchTokens(); // Refresh after going back
        }}
        onUpdate={fetchTokens} // Add this prop
      />
    );
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Available Tokens</h1>
        <div className="flex gap-4 items-center">
          <SortTokens sortBy={sortBy} onChange={setSortBy} />
          <button
            onClick={fetchTokens}
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
        {sortTokens(tokens).map((token, index) => (
          <div 
            key={index} 
            className="bg-gray-700 rounded-lg p-4 shadow cursor-pointer hover:bg-gray-600 transition-colors"
            onClick={() => setSelectedToken(token)}
          >
            <img 
              src={token.image} 
              alt={token.name} 
              className="w-full h-48 object-cover rounded-md mb-4"
            />
            <h3 className="text-xl font-bold mb-2">{token.name}</h3>
            <p className="text-sm text-gray-300 mb-2">{token.symbol}</p>
            <p className="text-sm mb-4">{token.description}</p>
            <div className="flex justify-between text-sm">
              <div>
                <p>Current Price</p>
                <p className="font-bold">{token.currentPrice} SOL</p>
              </div>
              <div>
                <p>Next Price</p>
                <p className="font-bold">{token.nextPrice} SOL</p>
              </div>
            </div>
            <div className="text-xs text-gray-400 mt-2 space-y-1">
              <p>Holder: {token.currentHolder.slice(0, 4)}...{token.currentHolder.slice(-4)}</p>
              <p>Created: {token.createdAt ? formatDate(token.createdAt) : 'Loading...'}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}; 