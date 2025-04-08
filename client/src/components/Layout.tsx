import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWallet } from '@solana/wallet-adapter-react';
import CreateToken from './CreateToken';
import LoginModal from './LoginModal';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { logout, isAuthenticated } = useAuth();
  const { publicKey, disconnect } = useWallet();
  const navigate = useNavigate();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const goToHomePage = () => {
    navigate('/');
  };

  const goToMyProfile = () => {
    if (publicKey) {
      navigate(`/profile/${publicKey.toString()}`);
    }
  };

  const handleTokenCreated = (tokenId: string) => {
    navigate(`/token/${tokenId}`);
  };

  const handleLogout = async () => {
    logout();
    await disconnect();
  };

  return (
    <div className="p-8">
      {/* Header with Fool.Fun title */}
      <header className="bg-gray-800 text-white p-4 mb-6 rounded-md">
        <div className="flex justify-between items-center">
          <h1 
            className="text-2xl font-bold cursor-pointer hover:text-purple-300 transition-colors"
            onClick={goToHomePage}
          >
            Fool.Fun
          </h1>
          
          <div className="flex items-center space-x-4">
            {isAuthenticated && publicKey && (
              <>
                <div className="flex flex-col items-end mr-2">
                  <span className="text-sm text-gray-300">
                    Signed in as:
                  </span>
                  <span className="text-sm font-medium">
                    {publicKey.toString().slice(0, 4)}...{publicKey.toString().slice(-4)}
                  </span>
                </div>
                <button
                  onClick={goToMyProfile}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500"
                >
                  My Profile
                </button>
                <button onClick={handleLogout} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-500">
                  Logout
                </button>
              </>
            )}
            {!isAuthenticated && (
              <button
                onClick={() => setIsLoginModalOpen(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500"
              >
                Login
              </button>
            )}
            <CreateToken onSuccess={handleTokenCreated} />
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <main>
        {children}
      </main>

      {/* Login Modal */}
      <LoginModal 
        isOpen={isLoginModalOpen} 
        onClose={() => setIsLoginModalOpen(false)} 
      />
    </div>
  );
};

export default Layout; 