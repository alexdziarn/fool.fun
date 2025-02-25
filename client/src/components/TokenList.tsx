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
  id: string;
}

interface TokenListProps {
  onViewProfile: (address: string) => void;
  onViewToken: (tokenId: string) => void;
}

export const TokenList = ({ onViewProfile, onViewToken }: TokenListProps) => {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('price-desc');
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTokens = async () => {
    if (isFetching) return;
    
    try {
      setIsFetching(true);
      setError(null);
      
      const connection = new Connection(clusterApiUrl('devnet'));
      
      // Get all program accounts in a single request
      const accounts = await connection.getProgramAccounts(PROGRAM_ID);
      console.log(`Found ${accounts.length} tokens`);
      
      // Process all accounts
      const tokensData = accounts.map(({ pubkey, account }) => {
        try {
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
          
          return {
            id: pubkey.toString(),
            name,
            symbol,
            description,
            image,
            currentHolder,
            minter,
            currentPrice,
            nextPrice
          };
        } catch (err) {
          console.error(`Error parsing token ${pubkey.toString()}:`, err);
          return null;
        }
      }).filter(token => token !== null);
      
      setTokens(tokensData);
    } catch (err) {
      console.error('Error fetching tokens:', err);
      setError('Failed to load tokens. Please try again.');
    } finally {
      setIsFetching(false);
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
        {sortTokens(tokens).map((token) => (
          <div 
            key={token.id}
            onClick={() => onViewToken(token.id)}
            className="bg-gray-700 rounded-lg p-4 cursor-pointer hover:bg-gray-600"
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
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}; 