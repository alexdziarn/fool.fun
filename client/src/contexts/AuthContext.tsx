import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { signMessage as signMessageService } from '../services/auth.service';
import { saveAuth, checkAuth, clearAuth, getStoredWallet } from '../utils/auth';

interface AuthContextType {
  isAuthenticated: boolean;
  login: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { publicKey, connected, signMessage } = useWallet();

  // Check auth status and wallet match on mount and when wallet changes
  useEffect(() => {
    const storedWallet = getStoredWallet();
    const isValid = checkAuth();
    
    // If auth is valid and wallet matches, set authenticated
    if (isValid && connected && publicKey && storedWallet === publicKey.toString()) {
      setIsAuthenticated(true);
    } else if (!connected || !publicKey || (storedWallet && storedWallet !== publicKey.toString())) {
      clearAuth();
      setIsAuthenticated(false);
    }
  }, [publicKey, connected]);

  const login = useCallback(async () => {
    if (!publicKey || !signMessage) return;

    try {
      // Check if we already have valid auth for this wallet
      const storedWallet = getStoredWallet();
      const isValid = checkAuth();

      if (isValid && storedWallet === publicKey.toString()) {
        setIsAuthenticated(true);
        return;
      }

      // If not valid or different wallet, request new signature
      const message = 'Login to Fool.fun';
      const messageBytes = new TextEncoder().encode(message);
      const signature = await signMessage(messageBytes);
      const success = await signMessageService(publicKey.toString(), signature, message);
      
      if (success) {
        saveAuth(publicKey.toString());
        setIsAuthenticated(true);
        console.log('Login successful');
      }
    } catch (error) {
      console.error('Login failed:', error);
    }
  }, [publicKey, signMessage]);

  const logout = useCallback(() => {
    clearAuth();
    setIsAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 