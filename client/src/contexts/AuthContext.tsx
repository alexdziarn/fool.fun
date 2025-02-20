import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { signMessage } from '../services/auth.service';
import { saveAuth, checkAuth, clearAuth } from '../utils/auth';

interface AuthContextType {
  isAuthenticated: boolean;
  login: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const wallet = useWallet();

  // Check auth status on mount
  useEffect(() => {
    const isValid = checkAuth();
    setIsAuthenticated(isValid);
  }, []);

  const login = useCallback(async () => {
    if (!wallet.publicKey || !wallet.signMessage) return;

    try {
      const message = 'Login to Fool.fun';
      const messageBytes = new TextEncoder().encode(message);
      const signature = await wallet.signMessage(messageBytes);
      const success = await signMessage(wallet.publicKey.toString(), signature, message);
      
      if (success) {
        saveAuth(wallet.publicKey.toString());
        setIsAuthenticated(true);
        console.log('Login successful');
      }
    } catch (error) {
      console.error('Login failed:', error);
    }
  }, [wallet]);

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