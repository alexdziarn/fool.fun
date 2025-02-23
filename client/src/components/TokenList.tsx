import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { gql } from '@apollo/client';
import { TokenPage } from './TokenPage';
import { SortTokens, SortOption } from './SortTokens';

const GET_TOKENS = gql`
  query GetTokens {
    tokens {
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
  createdAt: number;
}

interface TokenListProps {
  onViewProfile: (address: string) => void;
  onViewToken: (tokenId: string) => void;
}

export const TokenList = ({ onViewProfile, onViewToken }: TokenListProps) => {
  const { loading, error, data, refetch } = useQuery(GET_TOKENS);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('price-desc');

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

  if (loading) return <div>Loading tokens...</div>;
  if (error) return <div>Error loading tokens: {error.message}</div>;

  if (selectedToken) {
    return (
      <TokenPage 
        tokenId={selectedToken.id}
        onBack={() => {
          setSelectedToken(null);
          refetch();
        }}
        onViewProfile={onViewProfile}
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
            onClick={() => refetch()}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
        {sortTokens(data.tokens).map((token: Token) => (
          <div 
            key={token.id} 
            className="bg-gray-700 rounded-lg p-4 shadow cursor-pointer hover:bg-gray-600 transition-colors"
            onClick={() => onViewToken(token.id)}
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
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onViewProfile(token.currentHolder);
                }}
                className="hover:text-white transition-colors"
              >
                Holder: {token.currentHolder.slice(0, 4)}...{token.currentHolder.slice(-4)}
              </button>
              <p>Created: {formatDate(token.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}; 