import React from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useQuery } from '@apollo/client';
import { gql } from '@apollo/client';

interface ProfilePageProps {
  walletAddress: string;
  onBack: () => void;
  onViewToken: (tokenId: string) => void;
}

const GET_USER_TOKENS = gql`
  query GetUserTokens($address: String!) {
    userTokens(address: $address) {
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
    }
  }
`;

const formatAddress = (address: string) => {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};

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

const TokenCard = ({ token, onClick }: { token: Token; onClick: () => void }) => (
  <div 
    className="bg-gray-700 rounded-lg p-4 cursor-pointer hover:bg-gray-600 transition-all duration-200"
    onClick={onClick}
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
);

export const ProfilePage = ({ walletAddress, onBack, onViewToken }: ProfilePageProps) => {
  const { publicKey } = useWallet();
  const { loading, error, data, refetch } = useQuery(GET_USER_TOKENS, {
    variables: { address: walletAddress }
  });

  if (!publicKey) {
    return <div>Please connect your wallet to view your profile.</div>;
  }

  if (loading) return <div>Loading profile...</div>;
  if (error) return <div>Error loading profile: {error.message}</div>;

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <button onClick={onBack} className="text-gray-400 hover:text-white">
          ← Back to list
        </button>
        <button 
          onClick={() => refetch()} 
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500"
        >
          Refresh
        </button>
      </div>
      
      <h2 className="text-2xl font-bold mb-6">Profile: {formatAddress(walletAddress)}</h2>
      
      {data.userTokens.length === 0 ? (
        <p className="text-gray-400">No tokens found for this address.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.userTokens.map((token: Token) => (
            <TokenCard 
              key={token.id} 
              token={token} 
              onClick={() => onViewToken(token.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}; 