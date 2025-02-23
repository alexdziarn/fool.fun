import { ApolloServer } from '@apollo/server';
import { GraphQLError } from 'graphql';
import GraphQLUpload from 'graphql-upload/GraphQLUpload.mjs';
import { initializeApp } from 'firebase/app';
// import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
// import { firebaseConfig } from './firebase';
import express from 'express';
import cors from 'cors';
import { expressMiddleware } from '@apollo/server/express4';
import { json } from 'body-parser';
import graphqlUploadExpress from 'graphql-upload/graphqlUploadExpress.mjs';
import { PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { uploadToPinata } from './pinata';
import { Connection, clusterApiUrl, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { PROGRAM_ID } from './config/constants';
import NodeCache from 'node-cache';

// const firebaseApp = initializeApp(firebaseConfig);
// const storage = getStorage(firebaseApp);

// Define TypeDefs
const typeDefs = `#graphql
  scalar Upload

  type File {
    url: String!
  }

  type Token {
    id: ID!
    name: String!
    symbol: String!
    description: String!
    image: String!
    currentHolder: String!
    minter: String!
    currentPrice: Float!
    nextPrice: Float!
    createdAt: Int!
    transactions: [Transaction!]!
  }

  type Transaction {
    signature: String!
    type: String!
    timestamp: Int!
    from: String!
    to: String!
    amount: Float
  }

  type Query {
    tokens: [Token!]!
    token(id: ID!): Token
    userTokens(address: String!): [Token!]!
  } 

  type AuthResponse {
    success: Boolean!
  }

  type Mutation {
    uploadFile(file: Upload!): File!
    verifySignature(
      publicKey: String!
      signature: String!
      message: String!
    ): AuthResponse!
  }
`;

// Add this interface at the top of the file
interface FileUpload {
  filename: string;
  mimetype: string;
  encoding: string;
  createReadStream: () => NodeJS.ReadableStream;
}

interface Token {
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
  transactions: Transaction[];
}

interface Transaction {
  signature: string;
  type: 'steal' | 'transfer';
  timestamp: number;
  from: string;
  to: string;
  amount?: number;
}

const tokenCache = new NodeCache({ stdTTL: 60 }); // Cache for 60 seconds

async function parseTransactions(signatures: any[], connection: Connection): Promise<Transaction[]> {
  const transactions = await Promise.all(
    signatures.map(async (sig) => {
      try {
        const tx = await connection.getTransaction(sig.signature, {
          maxSupportedTransactionVersion: 0,
          commitment: 'confirmed'
        });
        if (!tx) return null;

        const accountKeys = tx.transaction.message.staticAccountKeys;
        if (!accountKeys || accountKeys.length < 3) return null;
        console.log('Account keys:', accountKeys.length);

        // Check program ID to filter program transactions
        const programIdIndex = tx.transaction.message.compiledInstructions[0].programIdIndex;
        const programId = accountKeys[programIdIndex].toString();
        
        if (programId !== PROGRAM_ID.toString()) return null;

        // Determine type by account layout
        const isSteal = accountKeys.length === 6; // Steal has 6 accounts
        const isTransfer = accountKeys.length === 4; // Transfer has 4 accounts

        console.log('Transaction data:', {
          programId,
          accountCount: accountKeys.length,
          isSteal,
          isTransfer
        });

        if (!isSteal && !isTransfer) return null;

        const result: Transaction = {
          signature: sig.signature,
          type: isSteal ? 'steal' : 'transfer',
          timestamp: sig.blockTime || 0,
          from: isSteal ? accountKeys[2].toString() : accountKeys[1].toString(),
          to: isSteal ? accountKeys[1].toString() : accountKeys[2].toString(),
          amount: isSteal && tx.meta ? (tx.meta.postBalances[1] - tx.meta.preBalances[1]) / LAMPORTS_PER_SOL : undefined
        };
        return result;
      } catch (error) {
        console.error('Error parsing transaction:', error);
        return null;
      }
    })
  );

  return transactions.filter((tx): tx is Transaction => tx !== null);
}

// Define Resolvers
const resolvers = {
  Upload: GraphQLUpload,
  Query: {
    tokens: async (): Promise<Token[]> => {
      try {
        // Check cache first
        const cached = tokenCache.get('all_tokens');
        if (cached) return cached as Token[];

        const connection = new Connection(clusterApiUrl('devnet'));
        const accounts = await connection.getProgramAccounts(PROGRAM_ID);
        
        const tokens = await Promise.all(accounts.map(async ({ pubkey, account }) => {
          // Parse token data
          const data = account.data;
          let offset = 8; // Skip discriminator

          // Helper to read string
          const readString = () => {
            const len = data.readUInt32LE(offset);
            offset += 4;
            const str = data.slice(offset, offset + len).toString();
            offset += len;
            return str;
          };

          const name = readString();
          const symbol = readString();
          const description = readString();
          const image = readString();
          const currentHolder = new PublicKey(data.slice(offset, offset + 32)).toString();
          offset += 32;
          const minter = new PublicKey(data.slice(offset, offset + 32)).toString();
          offset += 64; // skip minter and dev

          const currentPrice = Number(data.readBigUInt64LE(offset)) / LAMPORTS_PER_SOL;
          offset += 8;
          const nextPrice = Number(data.readBigUInt64LE(offset)) / LAMPORTS_PER_SOL;

          // Get creation time
          const signatures = await connection.getSignaturesForAddress(pubkey, { limit: 1 });
          
          return {
            id: pubkey.toString(),
            name,
            symbol,
            description,
            image,
            currentHolder,
            minter,
            currentPrice,
            nextPrice,
            createdAt: signatures[0]?.blockTime || 0,
            transactions: [] // We'll fetch these separately when needed
          };
        }));

        // Store in cache
        tokenCache.set('all_tokens', tokens);
        return tokens;
      } catch (error) {
        console.error('Error fetching tokens:', error);
        throw new Error('Failed to fetch tokens');
      }
    },

    token: async (_: any, { id }: { id: string }) => {
      try {
        const connection = new Connection(clusterApiUrl('devnet'));
        const account = await connection.getAccountInfo(new PublicKey(id));
        if (!account) return null;

        const data = account.data;
        let offset = 8; // Skip discriminator

        // Helper to read string
        const readString = () => {
          const len = data.readUInt32LE(offset);
          offset += 4;
          const str = data.slice(offset, offset + len).toString();
          offset += len;
          return str;
        };

        const name = readString();
        const symbol = readString();
        const description = readString();
        const image = readString();
        const currentHolder = new PublicKey(data.slice(offset, offset + 32)).toString();
        offset += 32;
        const minter = new PublicKey(data.slice(offset, offset + 32)).toString();
        offset += 64; // skip minter and dev

        const currentPrice = Number(data.readBigUInt64LE(offset)) / LAMPORTS_PER_SOL;
        offset += 8;
        const nextPrice = Number(data.readBigUInt64LE(offset)) / LAMPORTS_PER_SOL;

        // Get transactions
        const signatures = await connection.getSignaturesForAddress(new PublicKey(id));
        console.log('Found signatures:', signatures.length);
        const transactions = await parseTransactions(signatures, connection);
        console.log('Parsed transactions:', transactions.length);

        return {
          id,
          name,
          symbol,
          description,
          image,
          currentHolder,
          minter,
          currentPrice,
          nextPrice,
          createdAt: signatures[0]?.blockTime || 0,
          transactions
        };
      } catch (error) {
        console.error('Error fetching token:', error);
        throw new Error('Failed to fetch token');
      }
    },

    userTokens: async (_: any, { address }: { address: string }): Promise<Token[]> => {
      const allTokens = await resolvers.Query.tokens();
      return allTokens.filter(token => token.currentHolder === address);
    }
  },

  Mutation: {
    uploadFile: async (_: any, { file }: { file: Promise<FileUpload> }) => {
      console.log('uploadFile', file);
      try {
        const { createReadStream, filename, mimetype } = await file;
        
        // Validate file type
        if (!mimetype.startsWith('image/')) {
          throw new GraphQLError('Only image files are allowed', {
            extensions: { code: 'BAD_USER_INPUT' }
          });
        }

        // Convert stream to buffer
        const stream = createReadStream();
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(chunk as Buffer);
        }
        const buffer = Buffer.concat(chunks);

        // Upload to Pinata
        console.log('Uploading file to Pinata...');
        const url = await uploadToPinata(buffer, filename);
        console.log('File uploaded successfully to IPFS:', url);

        return { url };
      } catch (error) {
        console.error('Upload error:', error);
        throw new GraphQLError('File upload failed', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' }
        });
      }
    },
    verifySignature: async (_: any, { publicKey, signature, message }: { 
      publicKey: string, 
      signature: string, 
      message: string 
    }) => {
      try {
        const pubKey = new PublicKey(publicKey);
        const signatureUint8 = bs58.decode(signature);
        const messageUint8 = new TextEncoder().encode(message);
        
        const verified = nacl.sign.detached.verify(
          messageUint8,
          signatureUint8,
          pubKey.toBytes()
        );

        console.log(`🔑 Wallet ${verified ? 'verified' : 'failed'}: ${publicKey}`);
        
        return { success: verified };
      } catch (error) {
        console.error('❌ Signature verification failed:', error);
        console.error('Failed wallet:', publicKey);
        return { success: false };
      }
    }
  }
};

// Create and start the server
const server = new ApolloServer({
  typeDefs,
  resolvers,
});

const startServer = async () => {
  await server.start();
  
  const app = express();
  app.use(cors());
  app.use(json());
  
  // Add file upload middleware
  app.use(graphqlUploadExpress());
  
  app.use(
    '/graphql',
    expressMiddleware(server, {
      context: async ({ req }) => ({ req })
    }) as unknown as express.RequestHandler
  );
  
  app.listen(4000, () => {
    console.log(`🚀 Server ready at http://localhost:4000/graphql`);
  });
};

startServer();
