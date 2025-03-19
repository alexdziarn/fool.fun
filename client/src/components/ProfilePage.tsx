import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useParams, useNavigate } from 'react-router-dom';
import { TokenPage } from './TokenPage';
import { SortTokens, SortOption } from './SortTokens';
import { gql, useQuery } from '@apollo/client';

const GET_TOKENS_BY_HOLDER = gql`
  query GetTokensByHolder($address: String!) {
    getTokensByHolder(address: $address) {
      id
      name
      symbol
      description
      image
      currentHolder
      minter
      currentPrice
      nextPrice
      pubkey
      createdAt
    }
  }
`;

interface OwnedToken {
  id: string;
  name: string;
  symbol: string;
  description: string;
  image: string;
  currentHolder: string;
  minter: string;
  currentPrice: number;
  nextPrice: number;
  pubkey: string;
  createdAt: string;
}

export const ProfilePage = () => {
  const { walletAddress } = useParams<{ walletAddress: string }>();
  const navigate = useNavigate();
  const { publicKey } = useWallet();
  const [selectedToken, setSelectedToken] = useState<any>(null);
  const [sortBy, setSortBy] = useState<SortOption>('price-desc');
  const [isCurrentUser, setIsCurrentUser] = useState(false);

  const { loading, error, data, refetch } = useQuery(GET_TOKENS_BY_HOLDER, {
    variables: { address: walletAddress },
    skip: !walletAddress,
  });

  // Check if the profile being viewed is the current user's profile
  useEffect(() => {
    if (publicKey && walletAddress) {
      setIsCurrentUser(publicKey.toString() === walletAddress);
    } else {
      setIsCurrentUser(false);
    }
  }, [publicKey, walletAddress]);

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
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        default:
          return 0;
      }
    });
  };
  
  const handleViewToken = (tokenId: string) => {
    navigate(`/token/${tokenId}`);
  };

  if (!walletAddress) {
    return <div>Please connect your wallet to view your profile.</div>;
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 text-center p-4">
        Error loading tokens: {error.message}
      </div>
    );
  }

  const ownedTokens = data?.getTokensByHolder || [];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">
            {isCurrentUser ? 'My Profile' : 'User Profile'}
          </h2>
          <p className="text-gray-400 font-mono">
            Wallet: {walletAddress}
          </p>
        </div>
      </div>

      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">
            {isCurrentUser ? 'My Tokens' : 'User\'s Tokens'}
          </h3>
          <div className="flex gap-4 items-center">
            <SortTokens sortBy={sortBy} onChange={setSortBy} />
            <button
              onClick={() => refetch()}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-500 disabled:bg-purple-400"
              disabled={loading}
            >
              {loading ? (
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
                key={token.id} 
                className="bg-gray-700 rounded-lg p-4 cursor-pointer hover:bg-gray-600 transition-all duration-200"
                onClick={() => handleViewToken(token.id)}
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