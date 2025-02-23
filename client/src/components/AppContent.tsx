import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useWallet } from '@solana/wallet-adapter-react';
import Login from './Login';
import CreateToken from './CreateToken';
import { TokenList } from './TokenList';
import { ProfilePage } from './ProfilePage';
import { TokenPage } from './TokenPage';

function AppContent() {
  const { isAuthenticated, logout } = useAuth();
  const { publicKey } = useWallet();
  const [profileAddress, setProfileAddress] = useState<string | null>(null);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);

  // Check URL for wallet address or token ID on mount and URL changes
  useEffect(() => {
    const path = window.location.pathname;
    const profileMatch = path.match(/^\/profile\/([A-Za-z0-9]{32,44})$/);
    const tokenMatch = path.match(/^\/token\/([A-Za-z0-9]{32,44})$/);
    
    if (profileMatch) {
      setProfileAddress(profileMatch[1]);
      setSelectedTokenId(null);
    } else if (tokenMatch) {
      setSelectedTokenId(tokenMatch[1]);
      setProfileAddress(null);
    } else {
      setProfileAddress(null);
      setSelectedTokenId(null);
    }
  }, [window.location.pathname]);

  const handleViewProfile = (address?: string) => {
    if (address) {
      window.history.pushState({}, '', `/profile/${address}`);
      setProfileAddress(address);
      setSelectedTokenId(null);
    } else if (publicKey && !profileAddress) {
      window.history.pushState({}, '', `/profile/${publicKey.toString()}`);
      setProfileAddress(publicKey.toString());
      setSelectedTokenId(null);
    } else {
      window.history.pushState({}, '', '/');
      setProfileAddress(null);
      setSelectedTokenId(null);
    }
  };

  const handleViewToken = (tokenId: string) => {
    window.history.pushState({}, '', `/token/${tokenId}`);
    setSelectedTokenId(tokenId);
    setProfileAddress(null);
  };

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <div className="authenticated-content">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl">Welcome!</h2>
        <div className="flex gap-4">
          <button
            onClick={() => handleViewProfile()}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500"
          >
            {profileAddress ? 'View All Tokens' : 'My Profile'}
          </button>
          <CreateToken />
          <button onClick={logout} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-500">
            Logout
          </button>
        </div>
      </div>
      {profileAddress ? (
        <ProfilePage 
          walletAddress={profileAddress} 
          onBack={() => handleViewProfile()} 
          onViewToken={handleViewToken}
        />
      ) : selectedTokenId ? (
        <TokenPage 
          tokenId={selectedTokenId}
          onBack={() => {
            window.history.pushState({}, '', '/');
            setSelectedTokenId(null);
          }}
          onViewProfile={(address) => {
            window.history.pushState({}, '', `/profile/${address}`);
            setProfileAddress(address);
            setSelectedTokenId(null);
          }}
        />
      ) : (
        <TokenList 
          onViewProfile={handleViewProfile}
          onViewToken={handleViewToken}
        />
      )}
    </div>
  );
}

export default AppContent; 