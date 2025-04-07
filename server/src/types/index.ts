// Database Types
export interface Token {
  id: string;                   // Token ID (public key as string)
  name: string;                 // Token name
  symbol: string;               // Token symbol
  description: string;          // Token description
  image: string;                // Token image URL
  current_holder: string;       // Current token holder address
  minter: string;               // Token minter address
  current_price: number;        // Current token price in SOL
  next_price: number;           // Next token price in SOL
  pubkey: string;              // Token public key
  last_steal?: string;         // Timestamp of last steal
  last_create?: string;        // Timestamp of creation
}

export enum DBTransactionType {
  STEAL = 'steal',
  TRANSFER = 'transfer',
  CREATE = 'create',
  UNKNOWN = 'unknown'
}

export interface DBTransaction {
  id: string;                   // Transaction signature
  token_id: string;             // Token ID
  token: Token | null;          // Token data (null for non-steal transactions)
  type: DBTransactionType;      // Transaction type
  from_address: string;         // Sender address
  to_address: string;           // Recipient address
  amount: number | null;        // Amount in SOL (null for non-monetary transactions)
  timestamp: Date;              // Transaction timestamp
  block_number: number | null;  // Block number
  success: boolean;             // Transaction success status
}

// GraphQL Types
export interface FileUpload {
  filename: string;
  mimetype: string;
  encoding: string;
  createReadStream: () => NodeJS.ReadableStream;
}

export interface TokenPage {
  tokens: Token[];
  totalCount: number;
  hasNextPage: boolean;
}

export interface TokenWithTransactions {
  token: Token;
  transactions: DBTransaction[];
  transactionCount: number;
}

export interface SyncResponse {
  success: boolean;
  message: string;
  token?: Token;
}

export enum SortOption {
  PRICE_ASC = 'PRICE_ASC',
  PRICE_DESC = 'PRICE_DESC',
  LATEST_PURCHASE = 'LATEST_PURCHASE',
  CREATION_DATE = 'CREATION_DATE'
}

// Pinata Types
export interface PinataUploadResult {
  cid: string;
  size: number;
  path: string;
}

// Database Query Types
export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface TokenQueryParams extends PaginationParams {
  holderAddress?: string;
  minterAddress?: string;
}

export interface TransactionQueryParams extends PaginationParams {
  tokenId?: string;
  address?: string;
}

// Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
} 

export interface EmailData {
  from: string;
  to: string;
  type: 'steal' | 'transfer' | 'create';
  token_id: string;
  amount: number | null;
}