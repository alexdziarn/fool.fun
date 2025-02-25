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
    const handleUrlChange = () => {
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
    };

    // Handle initial URL
    handleUrlChange();

    // Listen for popstate events (back/forward navigation)
    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, []);

  const handleViewProfile = (address?: string) => {
    if (address) {
      window.history.pushState({}, '', `/profile/${address}`);
      setProfileAddress(address);
      setSelectedTokenId(null);
    } else if (publicKey) {
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
            onClick={() => {
              if (profileAddress || selectedTokenId) {
                // If on profile or token page, go to main page
                window.history.pushState({}, '', '/');
                setProfileAddress(null);
                setSelectedTokenId(null);
              } else {
                // If on main page, go to user's profile
                if (publicKey) {
                  window.history.pushState({}, '', `/profile/${publicKey.toString()}`);
                  setProfileAddress(publicKey.toString());
                  setSelectedTokenId(null);
                }
              }
            }}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500"
          >
            {profileAddress || selectedTokenId ? 'View All Tokens' : 'My Profile'}
          </button>
          <CreateToken onSuccess={handleViewToken} />
          <button onClick={logout} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-500">
            Logout
          </button>
        </div>
      </div>
      {profileAddress ? (
        <ProfilePage 
          walletAddress={profileAddress} 
          onBack={() => {
            window.history.pushState({}, '', '/');
            setProfileAddress(null);
          }}
          onViewToken={handleViewToken}
        />
      ) : selectedTokenId ? (
        <TokenPage 
          tokenId={selectedTokenId}
          onBack={() => {
            window.history.pushState({}, '', '/');
            setSelectedTokenId(null);
          }}
          onViewProfile={handleViewProfile}
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