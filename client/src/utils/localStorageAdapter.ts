/**
 * LocalStorageAdapter for wallet-adapter
 * Helps with persisting wallet connection state
 */

const WALLET_STATE_KEY = 'walletState';

export const LocalStorageAdapter = {
  setItem: (key: string, value: string) => {
    try {
      localStorage.setItem(`${WALLET_STATE_KEY}:${key}`, value);
      return true;
    } catch (error) {
      console.error('Error saving wallet state to localStorage:', error);
      return false;
    }
  },
  
  getItem: (key: string) => {
    try {
      return localStorage.getItem(`${WALLET_STATE_KEY}:${key}`);
    } catch (error) {
      console.error('Error getting wallet state from localStorage:', error);
      return null;
    }
  },
  
  removeItem: (key: string) => {
    try {
      localStorage.removeItem(`${WALLET_STATE_KEY}:${key}`);
      return true;
    } catch (error) {
      console.error('Error removing wallet state from localStorage:', error);
      return false;
    }
  }
}; 