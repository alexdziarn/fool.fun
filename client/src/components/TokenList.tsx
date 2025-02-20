import React, { useEffect, useState } from 'react';
import { Connection, PublicKey, clusterApiUrl, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { PROGRAM_ID } from '../config/constants';
import { TokenPage } from './TokenPage';

interface Token {
  name: string;
  symbol: string;
  description: string;
  image: string;
  currentHolder: string;
  minter: string;
  currentPrice: number;
  nextPrice: number;
}

export const TokenList = () => {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTokens = async () => {
    try {
      setRefreshing(true);
      const connection = new Connection(clusterApiUrl('devnet'));
      const accounts = await connection.getProgramAccounts(PROGRAM_ID);
      
      const tokenList = await Promise.all(accounts.map(async ({ pubkey, account }) => {
        const data = account.data;
        // console.log("data", data);
        let offset = 8; // Skip discriminator

        // Helper to read string
        const readString = () => {
          const len = data.readUInt32LE(offset);
          offset += 4;
          const str = data.slice(offset, offset + len).toString();
          offset += len;
          return str;
        };

        // Read fields in order they appear in CustomToken struct
        const name = readString();
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
          name,
          symbol,
          description,
          image,
          currentHolder,
          minter,
          currentPrice,
          nextPrice
        };
      }));

      setTokens(tokenList);
    } catch (error) {
      console.error('Error fetching tokens:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchTokens();
  }, []);

  // Poll for updates every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchTokens();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

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

  if (loading) {
    return <div>Loading tokens...</div>;
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Available Tokens</h1>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
        {tokens.map((token, index) => (
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
            <p className="text-xs text-gray-400 mt-2">
              Holder: {token.currentHolder.slice(0, 4)}...{token.currentHolder.slice(-4)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}; 