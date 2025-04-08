import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useAuth } from '../contexts/AuthContext';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { publicKey, connected } = useWallet();
  const { login } = useAuth();
  const [isSigning, setIsSigning] = useState(false);

  const handleSignIn = async () => {
    if (!connected || !publicKey) return;
    
    setIsSigning(true);
    try {
      const success = await login();
      if (success) {
        onClose();
      }
    } catch (error) {
      console.error('Sign in failed:', error);
    } finally {
      setIsSigning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">
            {connected ? 'Sign In' : 'Connect Wallet'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>
        <div className="flex flex-col items-center space-y-4">
          <WalletMultiButton className="!bg-blue-600 hover:!bg-blue-500" />
          {connected && (
            <button
              onClick={handleSignIn}
              disabled={isSigning}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSigning ? 'Signing...' : 'Sign In'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginModal; 