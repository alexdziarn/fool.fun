import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { signMessage } from '../services/auth.service';
import { saveAuth, checkAuth, clearAuth, getStoredPublicKey, updateLastConnected } from '../utils/auth';

interface AuthContextType {
  isAuthenticated: boolean;
  login: () => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const wallet = useWallet();

  // Check auth status on mount and when wallet changes
  useEffect(() => {
    const isValid = checkAuth();
    setIsAuthenticated(isValid);

    // If wallet is connected and we have stored auth, update the last connected timestamp
    if (wallet.publicKey && isValid) {
      updateLastConnected(wallet.publicKey.toString());
    }
  }, [wallet.publicKey]);

  // Auto re-authenticate when wallet connects and matches stored public key
  useEffect(() => {
    const autoReAuthenticate = async () => {
      // If already authenticated, no need to proceed
      if (isAuthenticated) return;

      // If wallet is connected and we have a stored public key
      if (wallet.publicKey && wallet.signMessage) {
        const storedPublicKey = getStoredPublicKey();
        
        // If the connected wallet matches the stored public key, auto re-authenticate
        if (storedPublicKey && storedPublicKey === wallet.publicKey.toString()) {
          try {
            const message = 'Login to Fool.fun';
            const messageBytes = new TextEncoder().encode(message);
            const signature = await wallet.signMessage(messageBytes);
            const success = await signMessage(wallet.publicKey.toString(), signature, message);
            
            if (success) {
              saveAuth(wallet.publicKey.toString());
              setIsAuthenticated(true);
              console.log('Auto re-authentication successful');
            }
          } catch (error) {
            console.error('Auto re-authentication failed:', error);
          }
        }
      }
    };

    // Only try to auto re-authenticate if wallet is connected but not authenticated
    if (wallet.connected && !isAuthenticated) {
      autoReAuthenticate();
    }
  }, [wallet.connected, wallet.publicKey, wallet.signMessage, isAuthenticated]);

  const login = useCallback(async (): Promise<boolean> => {
    if (!wallet.publicKey || !wallet.signMessage) return false;

    try {
      const message = 'Login to Fool.fun';
      const messageBytes = new TextEncoder().encode(message);
      const signature = await wallet.signMessage(messageBytes);
      const success = await signMessage(wallet.publicKey.toString(), signature, message);
      
      if (success) {
        saveAuth(wallet.publicKey.toString());
        setIsAuthenticated(true);
        console.log('Login successful');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
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