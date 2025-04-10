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
import { PublicKey, Connection, clusterApiUrl, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { uploadToPinata, uploadToPinataGroup } from './pinata';
import { PROGRAM_ID } from './constants';
import { fetchTransactionHistoryByTokenId } from './db/populate-transactions';
import * as dotenv from 'dotenv';
import { insertToken } from './db/tokens';
import { getPool } from './db/pool';
import { Token } from './types';
import { insertTransaction } from './db/transactions';

dotenv.config();

// const firebaseApp = initializeApp(firebaseConfig);
// const storage = getStorage(firebaseApp);

// Configure PostgreSQL connection
const pool = getPool();

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
    lastSteal: String
    lastCreate: String
  }

  type TokenPage {
    tokens: [Token!]!
    totalCount: Int!
    hasNextPage: Boolean!
  }

  enum SortOption {
    PRICE_ASC
    PRICE_DESC
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

  type SyncResponse {
    success: Boolean!
    message: String!
    token: Token
  }

  type Query {
    hello: String
    getTokenPage(page: Int!, pageSize: Int = 12, sortBy: SortOption): TokenPage!
    getTokenById(id: String!): TokenWithTransactions
    getTokensByHolder(address: String!): [Token!]!
    getTokensByMinter(address: String!): [Token!]!
  }

  type AuthResponse {
    success: Boolean!
  }

  type Mutation {
    uploadFile(file: Upload!): File!
    uploadFileToTempGroup(file: Upload!): File!
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
    getTokenPage: async (_: unknown, { page = 1, pageSize = 12, sortBy }: { page: number, pageSize: number, sortBy?: 'PRICE_ASC' | 'PRICE_DESC' }) => {
      try {
        const offset = (page - 1) * pageSize;
        
        let orderBy = 'current_price DESC';
        if (sortBy === 'PRICE_ASC') {
          orderBy = 'current_price ASC';
        }

        const result = await pool.query(
          `SELECT 
            id,
            name,
            symbol,
            description,
            image,
            current_price as "currentPrice",
            next_price as "nextPrice",
            current_holder as "currentHolder",
            minter,
            pubkey
          FROM tokens
          ORDER BY ${orderBy}
          LIMIT $1 OFFSET $2`,
          [pageSize, offset]
        );

        const countResult = await pool.query('SELECT COUNT(*) FROM tokens');
        const totalCount = parseInt(countResult.rows[0].count);
        const hasNextPage = offset + result.rows.length < totalCount;

        
        // go through each row and get the latest steal transaction and the latest create transaction
        // add a new fields to the row called last steal, and created
        
        for (const row of result.rows) {
          const latestStealTransacion = await pool.query(
            `SELECT timestamp FROM transactions 
            WHERE token_id = $1 AND type = $2 
            ORDER BY timestamp DESC 
            LIMIT 1`, 
            [row.id, 'steal']
          );
          const createTransaction = await pool.query(
            `SELECT timestamp FROM transactions 
            WHERE token_id = $1 AND type = $2 
            ORDER BY timestamp DESC 
            LIMIT 1`, 
            [row.id, 'create']
          );
          row.lastSteal = latestStealTransacion.rows[0]?.timestamp ? new Date(latestStealTransacion.rows[0].timestamp).toISOString() : null;
          row.lastCreate = createTransaction.rows[0]?.timestamp ? new Date(createTransaction.rows[0].timestamp).toISOString() : null;
        }
        return {
          tokens: result.rows,
          totalCount,
          hasNextPage
        };
      } catch (error) {
        console.error('Error fetching token page:', error);
        throw new Error('Failed to fetch tokens');
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
              pubkey
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
    },
    getTokensByHolder: async (_: any, { address }: { address: string }) => {
      const client = await pool.connect();
      try {
        const query = {
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
              pubkey
            FROM tokens
            WHERE current_holder = $1
            ORDER BY current_price DESC
          `,
          values: [address]
        };
        
        const result = await client.query(query);
        return result.rows;
      } catch (error) {
        console.error('Error fetching tokens by holder:', error);
        throw new GraphQLError('Failed to fetch tokens by holder', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' }
        });
      } finally {
        client.release();
      }
    },
    getTokensByMinter: async (_: any, { address }: { address: string }) => {
      const client = await pool.connect();
      try {
        const query = {
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
              pubkey
            FROM tokens
            WHERE minter = $1
            ORDER BY current_price DESC
          `,
          values: [address]
        };
        
        const result = await client.query(query);
        return result.rows;
      } catch (error) {
        console.error('Error fetching tokens by minter:', error);
        throw new GraphQLError('Failed to fetch tokens by minter', {
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
    uploadFileToTempGroup: async (_: any, { file }: { file: Promise<FileUpload> }) => {
      console.log('uploadFileToTempGroup', file);
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

        // Upload to Pinata group
        console.log('Uploading file to Pinata group...');
        const url = await uploadToPinataGroup(buffer, filename, process.env.PINATA_TEMP_GROUP_ID || '');
        console.log('File uploaded successfully to IPFS group:', url);

        return { url };
      } catch (error) {
        console.error('File upload failed', error);
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
    },
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
