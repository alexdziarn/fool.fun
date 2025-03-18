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
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

// const firebaseApp = initializeApp(firebaseConfig);
// const storage = getStorage(firebaseApp);

// Configure PostgreSQL connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'tokens_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

// Define TypeDefs
const typeDefs = `#graphql
  scalar Upload

  type File {
    url: String!
  }

  type Token {
    id: String!
    name: String!
    symbol: String!
    description: String
    image: String
    currentHolder: String!
    minter: String!
    currentPrice: Float!
    nextPrice: Float!
    pubkey: String
    createdAt: String
  }

  type TokenPage {
    tokens: [Token!]!
    totalCount: Int!
    hasNextPage: Boolean!
  }

  enum SortOption {
    PRICE_ASC
    PRICE_DESC
    LATEST_PURCHASE
    CREATION_DATE
  }

  type Transaction {
    id: String!
    tokenId: String!
    type: String!
    fromAddress: String!
    toAddress: String!
    amount: Float
    timestamp: String!
    blockNumber: Int
    slot: Int
    fee: Float
    success: Boolean!
    createdAt: String
  }

  type TokenWithTransactions {
    token: Token!
    transactions: [Transaction!]!
    transactionCount: Int!
  }

  type Query {
    hello: String
    getTokenPage(page: Int!, pageSize: Int = 5): TokenPage!
    getTokenById(id: String!): TokenWithTransactions
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

// Define Resolvers
const resolvers = {
  Upload: GraphQLUpload,
  Query: {
    hello: () => 'Hello World!',
    getTokenPage: async (_: any, { page, pageSize }: { page: number, pageSize: number }) => {
      // Validate input
      if (page < 1) {
        throw new GraphQLError('Page number must be greater than 0', {
          extensions: { code: 'BAD_USER_INPUT' }
        });
      }

      const client = await pool.connect();
      try {
        // Calculate offset
        const offset = (page - 1) * pageSize;
        
        // Get tokens for the requested page
        const tokensQuery = {
          text: `
            SELECT 
              id, 
              name, 
              symbol, 
              description, 
              image, 
              current_holder as "currentHolder", 
              minter, 
              current_price as "currentPrice", 
              next_price as "nextPrice", 
              pubkey,
              created_at as "createdAt"
            FROM tokens
            ORDER BY current_price DESC
            LIMIT $1 OFFSET $2
          `,
          values: [pageSize, offset]
        };
        
        // Get total count for pagination info
        const countQuery = {
          text: 'SELECT COUNT(*) FROM tokens'
        };
        
        const [tokensResult, countResult] = await Promise.all([
          client.query(tokensQuery),
          client.query(countQuery)
        ]);
        
        const tokens = tokensResult.rows;
        const totalCount = parseInt(countResult.rows[0].count);
        const hasNextPage = offset + tokens.length < totalCount;
        
        return {
          tokens,
          totalCount,
          hasNextPage
        };
      } catch (error) {
        console.error('Error fetching token page:', error);
        throw new GraphQLError('Failed to fetch tokens', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' }
        });
      } finally {
        client.release();
      }
    },
    getTokenById: async (_: any, { id }: { id: string }) => {
      const client = await pool.connect();
      try {
        // Get token data
        const tokenQuery = {
          text: `
            SELECT 
              id, 
              name, 
              symbol, 
              description, 
              image, 
              current_holder as "currentHolder", 
              minter, 
              current_price as "currentPrice", 
              next_price as "nextPrice", 
              pubkey,
              created_at as "createdAt"
            FROM tokens
            WHERE id = $1
          `,
          values: [id]
        };
        
        // Get token transactions
        const transactionsQuery = {
          text: `
            SELECT 
              id,
              token_id as "tokenId",
              type,
              from_address as "fromAddress",
              to_address as "toAddress",
              amount,
              timestamp,
              block_number as "blockNumber",
              slot,
              fee,
              success,
              created_at as "createdAt"
            FROM transactions
            WHERE token_id = $1 AND success = true
            ORDER BY timestamp DESC
            LIMIT 50
          `,
          values: [id]
        };
        
        // Get transaction count
        const countQuery = {
          text: 'SELECT COUNT(*) FROM transactions WHERE token_id = $1 AND success = true',
          values: [id]
        };
        
        // Execute all queries in parallel
        const [tokenResult, transactionsResult, countResult] = await Promise.all([
          client.query(tokenQuery),
          client.query(transactionsQuery),
          client.query(countQuery)
        ]);
        
        const token = tokenResult.rows[0];
        
        // If token not found, return null
        if (!token) {
          return null;
        }
        
        const transactions = transactionsResult.rows;
        const transactionCount = parseInt(countResult.rows[0].count);
        
        // Format dates as ISO strings
        if (token.createdAt) {
          token.createdAt = new Date(token.createdAt).toISOString();
        }
        
        transactions.forEach(tx => {
          if (tx.timestamp) {
            tx.timestamp = new Date(tx.timestamp).toISOString();
          }
          if (tx.createdAt) {
            tx.createdAt = new Date(tx.createdAt).toISOString();
          }
        });
        
        return {
          token,
          transactions,
          transactionCount
        };
      } catch (error) {
        console.error('Error fetching token by ID:', error);
        throw new GraphQLError('Failed to fetch token', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' }
        });
      } finally {
        client.release();
      }
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
  
  app.listen(process.env.SERVER_PORT || 4000, () => {
    console.log(`🚀 Server ready at http://localhost:${process.env.SERVER_PORT || 4000}/graphql`);
  });
};

// Graceful shutdown to close the database pool
process.on('SIGINT', async () => {
  console.log('Closing database pool...');
  await pool.end();
  process.exit(0);
});

startServer();
