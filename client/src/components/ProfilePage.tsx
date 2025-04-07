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

const GET_TOKENS_BY_MINTER = gql`
  query GetTokensByMinter($address: String!) {
    getTokensByMinter(address: $address) {
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
}

type TabType = 'owned' | 'minted';

export const ProfilePage = () => {
  const { walletAddress } = useParams<{ walletAddress: string }>();
  const navigate = useNavigate();
  const { publicKey } = useWallet();
  const [selectedToken, setSelectedToken] = useState<any>(null);
  const [sortBy, setSortBy] = useState<SortOption>('price-desc');
  const [isCurrentUser, setIsCurrentUser] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('owned');

  const { loading: loadingOwned, error: errorOwned, data: ownedData } = useQuery(GET_TOKENS_BY_HOLDER, {
    variables: { address: walletAddress },
    skip: !walletAddress,
  });

  const { loading: loadingMinted, error: errorMinted, data: mintedData } = useQuery(GET_TOKENS_BY_MINTER, {
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
          return 0; // We'll implement this later
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

  const loading = loadingOwned || loadingMinted;
  const error = errorOwned || errorMinted;

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

  const ownedTokens = ownedData?.getTokensByHolder || [];
  const mintedTokens = mintedData?.getTokensByMinter || [];
  const displayedTokens = activeTab === 'owned' ? ownedTokens : mintedTokens;
  const sortedTokens = sortTokens(displayedTokens);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          {isCurrentUser ? 'Your Profile' : `Profile: ${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`}
        </h1>
        <p className="text-gray-400">
          {isCurrentUser ? 'View and manage your tokens' : 'View tokens owned by this address'}
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-700 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('owned')}
            className={`${
              activeTab === 'owned'
                ? 'border-purple-500 text-purple-500'
                : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Owned Tokens ({ownedTokens.length})
          </button>
          <button
            onClick={() => setActiveTab('minted')}
            className={`${
              activeTab === 'minted'
                ? 'border-purple-500 text-purple-500'
                : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Minted Tokens ({mintedTokens.length})
          </button>
        </nav>
      </div>

      {/* Sort Options */}
      <div className="mb-6">
        <SortTokens sortBy={sortBy} onChange={setSortBy} />
      </div>

      {/* Token Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedTokens.map((token) => (
          <div
            key={token.id}
            className="bg-gray-700 rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-200 cursor-pointer"
            onClick={() => handleViewToken(token.id)}
          >
            <div className="aspect-w-16 aspect-h-9">
              <img
                src={token.image}
                alt={token.name}
                className="object-cover w-full h-full"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://placehold.co/400x300/png?text=Image+Error';
                }}
              />
            </div>
            <div className="p-3">
              <h3 className="text-sm font-semibold text-white mb-1 truncate">{token.name}</h3>
              <p className="text-xs text-gray-400 mb-1">{token.symbol}</p>
              <div className="flex justify-between items-center mb-1">
                <span className="text-white text-sm font-medium">
                  {token.currentPrice} SOL
                </span>
                <span className="text-xs text-gray-400">
                  Next: {token.nextPrice} SOL
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {sortedTokens.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400">
            {activeTab === 'owned' 
              ? 'No tokens owned yet' 
              : 'No tokens minted yet'}
          </p>
        </div>
      )}
    </div>
  );
}; 