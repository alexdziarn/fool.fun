import { useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { signMessage } from '../services/auth.service';

export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const wallet = useWallet();

  const login = useCallback(async () => {
    if (!wallet.publicKey || !wallet.signMessage) return;

    try {
      const message = 'Login to Fool.fun';
      const messageBytes = new TextEncoder().encode(message);
      const signature = await wallet.signMessage(messageBytes);
      const success = await signMessage(wallet.publicKey.toString(), signature, message);
      
      if (success) {
        setIsAuthenticated(true);
        console.log('Login successful');
      }
    } catch (error) {
      console.error('Login failed:', error);
    }
  }, [wallet]);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
  }, []);

  return { isAuthenticated, login, logout };
};