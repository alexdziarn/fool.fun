export interface Token {
  id: string;
  name: string;
  symbol: string;
  description: string;
  image: string;
  currentHolder: string;
  minter: string;
  currentPrice: number;
  nextPrice: number;
  createdAt: number;
}

export interface Transaction {
  signature: string;
  type: 'steal' | 'transfer';
  timestamp: number;
  from: string;
  to: string;
  amount?: number;
} 