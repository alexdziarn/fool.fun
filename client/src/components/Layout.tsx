import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWallet } from '@solana/wallet-adapter-react';
import CreateToken from './CreateToken';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { logout } = useAuth();
  const { publicKey } = useWallet();
  const navigate = useNavigate();

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
            {publicKey && (
              <div className="flex flex-col items-end mr-2">
                <span className="text-sm text-gray-300">
                  Signed in as:
                </span>
                <span className="text-sm font-medium">
                  {publicKey.toString().slice(0, 4)}...{publicKey.toString().slice(-4)}
                </span>
              </div>
            )}
            
            <button
              onClick={goToMyProfile}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500"
            >
              My Profile
            </button>
            <CreateToken onSuccess={handleTokenCreated} />
            <button onClick={logout} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-500">
              Logout
            </button>
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <main>
        {children}
      </main>
    </div>
  );
};

export default Layout; 