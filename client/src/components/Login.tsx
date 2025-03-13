import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getStoredPublicKey } from '../utils/auth';

const Login = () => {
  const { connected, publicKey } = useWallet();
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [autoLoginAttempted, setAutoLoginAttempted] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  // Auto-login when wallet connects
  useEffect(() => {
    const attemptAutoLogin = async () => {
      if (connected && publicKey && !isAuthenticated && !autoLoginAttempted && !isLoggingIn) {
        const storedPublicKey = getStoredPublicKey();
        
        // If the connected wallet matches the stored public key, try to auto-login
        if (storedPublicKey && storedPublicKey === publicKey.toString()) {
          setIsLoggingIn(true);
          try {
            await login();
          } catch (error) {
            console.error('Auto-login failed:', error);
          } finally {
            setIsLoggingIn(false);
            setAutoLoginAttempted(true);
          }
        } else {
          setAutoLoginAttempted(true);
        }
      }
    };

    attemptAutoLogin();
  }, [connected, publicKey, isAuthenticated, login, autoLoginAttempted, isLoggingIn]);

  const handleLogin = async () => {
    try {
      setIsLoggingIn(true);
      const success = await login();
      // Navigate to homepage after successful login
      if (success) {
        navigate('/');
      }
    } catch (error) {
      console.error('Login failed:', error);
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg max-w-md w-full">
        <h1 className="text-3xl font-bold mb-6 text-center">Welcome to Fool.Fun</h1>
        <div className="flex flex-col items-center space-y-6">
          <p className="text-gray-300 text-center mb-4">
            {!connected 
              ? "Connect your Solana wallet to get started" 
              : "Your wallet is connected. Sign a message to authenticate."}
          </p>
          <WalletMultiButton />
          {connected && (
            <button
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-500 disabled:bg-indigo-400 disabled:cursor-not-allowed"
            >
              {isLoggingIn ? (
                <div className="flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Signing in...
                </div>
              ) : (
                "Sign Message to Login"
              )}
            </button>
          )}
          {connected && autoLoginAttempted && (
            <p className="text-sm text-gray-400 text-center">
              Your session may have expired. Please sign in again.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
