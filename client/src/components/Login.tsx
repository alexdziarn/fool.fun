import React from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useAuth } from '../contexts/AuthContext';

const Login = () => {
  const { connected } = useWallet();
  const { login } = useAuth();

  return (
    <div className="flex flex-col items-center space-y-4">
      <WalletMultiButton />
      {connected && (
        <button
          onClick={login}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-500"
        >
          Sign Message to Login
        </button>
      )}
    </div>
  );
};

export default Login;
