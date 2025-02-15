import { PublicKey } from '@solana/web3.js';
import { SignerWalletAdapterProps } from '@solana/wallet-adapter-base';
import { gql } from '@apollo/client';
import { client } from '../apollo-client';
import * as bs58 from 'bs58';

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    walletAddress: string;
  };
}

class AuthService {
  private static instance: AuthService;
  private token: string | null = null;

  private constructor() {
    // Load token from localStorage on initialization
    this.token = localStorage.getItem('token');
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  async signIn(
    publicKey: PublicKey,
    signMessage: SignerWalletAdapterProps['signMessage']
  ): Promise<AuthResponse> {
    try {
      // Create the message
      const message = new TextEncoder().encode(`
        Welcome to Our App!
        
        Please sign this message to verify your wallet ownership.
        This won't create a transaction or cost any fees.
        
        Wallet: ${publicKey.toString()}
        Timestamp: ${Date.now()}
        Nonce: ${Math.random().toString(36).substring(2, 15)}
      `);

      // Request signature from user
      const signature = await signMessage(message);

      // Send to backend for verification
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          publicKey: publicKey.toString(),
          signature: Buffer.from(signature).toString('base64'),
          message: new TextDecoder().decode(message),
        }),
      });

      if (!response.ok) {
        throw new Error('Authentication failed');
      }

      const data: AuthResponse = await response.json();
      
      // Store token
      this.setToken(data.token);
      
      return data;
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('token', token);
  }

  getToken(): string | null {
    return this.token;
  }

  logout() {
    this.token = null;
    localStorage.removeItem('token');
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }
}

const VERIFY_SIGNATURE = gql`
  mutation VerifySignature($publicKey: String!, $signature: String!, $message: String!) {
    verifySignature(publicKey: $publicKey, signature: $signature, message: $message) {
      success
    }
  }
`;

export const signMessage = async (
  publicKey: string, 
  signature: Uint8Array, 
  message: string
): Promise<boolean> => {
  try {
    const { data } = await client.mutate({
      mutation: VERIFY_SIGNATURE,
      variables: {
        publicKey,
        signature: bs58.encode(signature),
        message
      }
    });
    
    return data.verifySignature.success;
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
};

export const authService = AuthService.getInstance();