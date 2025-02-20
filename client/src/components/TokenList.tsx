import React, { useEffect, useState } from 'react';
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { PROGRAM_ID } from './CreateToken';

interface Token {
  name: string;
  symbol: string;
  description: string;
  image: string;
  currentHolder: string;
  currentPrice: number;
  nextPrice: number;
}

export const TokenList = () => {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTokens = async () => {
      try {
        const connection = new Connection(clusterApiUrl('devnet'));
        const accounts = await connection.getProgramAccounts(PROGRAM_ID);
        
        const tokenList = await Promise.all(accounts.map(async ({ pubkey, account }) => {
          // Deserialize account data based on your CustomToken struct
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

          // Read fields in order they appear in CustomToken struct
          const name = readString();
          const symbol = readString();
          const description = readString();
          const image = readString();
          const currentHolder = new PublicKey(data.slice(offset, offset + 32)).toString();
          offset += 32;
          offset += 32; // skip minter
          offset += 32; // skip dev
          const currentPrice = data.readBigUInt64LE(offset) / BigInt(1_000_000_000);
          offset += 8;
          const nextPrice = data.readBigUInt64LE(offset) / BigInt(1_000_000_000);

          return {
            name,
            symbol,
            description,
            image,
            currentHolder,
            currentPrice: Number(currentPrice),
            nextPrice: Number(nextPrice)
          };
        }));

        setTokens(tokenList);
      } catch (error) {
        console.error('Error fetching tokens:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTokens();
  }, []);

  if (loading) {
    return <div>Loading tokens...</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
      {tokens.map((token, index) => (
        <div key={index} className="bg-gray-700 rounded-lg p-4 shadow">
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
  );
}; 