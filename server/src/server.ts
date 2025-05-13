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
import { uploadToTempGroup } from './pinata';
import { PROGRAM_ID } from './constants';
import { fetchTransactionHistoryByTokenId } from './db/populate-transactions';
import * as dotenv from 'dotenv';
import { insertToken } from './db/tokens';
import { getPool } from './db/pool';
import { Token } from './types';
import { insertTransaction } from './db/transactions';
import { createHelia } from 'helia'
import { createHeliaHTTP } from '@helia/http'
import { unixfs } from '@helia/unixfs';
import { FsBlockstore } from 'blockstore-fs';
import type { Helia } from 'helia'
import { create } from 'ipfs-http-client'
import { multiaddr } from '@multiformats/multiaddr'
import { ipfs, addWithCIDv1 } from './ipfs';
dotenv.config();

// const firebaseApp = initializeApp(firebaseConfig);
// const storage = getStorage(firebaseApp);

// Configure PostgreSQL connection
const pool = getPool();


// Define TypeDefs
const typeDefs = `#graphql
  scalar Upload

  type File {
    cid: String!
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

  type SyncResponse {
    success: Boolean!
    message: String!
    token: Token
  }

  type Query {
    hello: String
    getTokenPage(page: Int!, pageSize: Int = 12, sortBy: SortOption, search: String): TokenPage!
    getTokenById(id: String!): TokenWithTransactions
    getTokensByHolder(address: String!): [Token!]!
    getTokensByMinter(address: String!): [Token!]!
  }

  type AuthResponse {
    success: Boolean!
  }

  type Mutation {
    uploadFileToTempGroup(file: Upload!): File!
    verifySignature(
      publicKey: String!
      signature: String!
      message: String!
    ): AuthResponse!
    uploadFileToIpfs(file: Upload!): File!
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
    getTokenPage: async (_: unknown, { page = 1, pageSize = 12, sortBy = 'LATEST_PURCHASE', search }: { page: string | number, pageSize: string | number, sortBy?: 'PRICE_ASC' | 'PRICE_DESC' | 'LATEST_PURCHASE' | 'CREATION_DATE', search?: string }) => {
      try {
        const pageSizeNum = Number(pageSize);
        const pageNum = Number(page);
        const offsetNum = (pageNum - 1) * pageSizeNum;
        
        let orderBy = '(SELECT MAX(timestamp) FROM transactions WHERE token_id = t.id AND type = \'steal\') DESC NULLS LAST';
        if (sortBy === 'PRICE_ASC') {
          orderBy = 'current_price ASC';
        } else if (sortBy === 'PRICE_DESC') {
          orderBy = 'current_price DESC';
        } else if (sortBy === 'CREATION_DATE') {
          orderBy = '(SELECT timestamp FROM transactions WHERE token_id = t.id AND type = \'create\' LIMIT 1) DESC NULLS LAST';
        }

        // Base query without search
        let baseQuery = {
          text: `
            SELECT 
              t.id,
              t.name,
              t.symbol,
              t.description,
              t.image,
              t.current_holder as "currentHolder",
              t.minter,
              t.current_price as "currentPrice",
              t.next_price as "nextPrice",
              t.pubkey,
              (SELECT MAX(timestamp) FROM transactions WHERE token_id = t.id AND type = 'steal') as "lastSteal",
              (SELECT timestamp FROM transactions WHERE token_id = t.id AND type = 'create' LIMIT 1) as "lastCreate",
              (SELECT COUNT(*) FROM transactions WHERE token_id = t.id AND type = 'steal') as steal_count
            FROM tokens t
            ${search ? 'WHERE LOWER(t.name) LIKE LOWER($3) OR LOWER(t.symbol) LIKE LOWER($3)' : ''}
            ORDER BY ${orderBy}
            LIMIT $1 OFFSET $2
          `,
          values: search ? [pageSizeNum, offsetNum, `%${search}%`] : [pageSizeNum, offsetNum]
        };

        const result = await pool.query(baseQuery);

        // Count query
        const countQuery = {
          text: `SELECT COUNT(*) FROM tokens t ${search ? 'WHERE LOWER(t.name) LIKE LOWER($1) OR LOWER(t.symbol) LIKE LOWER($1)' : ''}`,
          values: search ? [`%${search}%`] : []
        };

        const countResult = await pool.query(countQuery);
        const totalCount = parseInt(countResult.rows[0].count);
        const hasNextPage = offsetNum + result.rows.length < totalCount;

        // Format dates as ISO strings
        result.rows.forEach(row => {
          if (row.lastSteal) {
            row.lastSteal = new Date(row.lastSteal).toISOString();
          }
          if (row.lastCreate) {
            row.lastCreate = new Date(row.lastCreate).toISOString();
          }
          // if image already starts with https, do nothing
          // just a quick fix for dev, remove later
          if (row.image.startsWith('https://')) {
            return;
          }

          row.image = `https://${process.env.PINATA_GATEWAY}/ipfs/${row.image}`;
        });

        return {
          tokens: result.rows,
          totalCount,
          hasNextPage
        };
      } catch (error) {
        console.error('Error fetching token page:', error);
        throw new GraphQLError('Failed to fetch tokens', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' }
        });
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
              success
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
        
        if (!token.image.startsWith('https://')) {
          token.image = `https://${process.env.PINATA_GATEWAY}/ipfs/${token.image}`;
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
    uploadFileToIpfs: async (_: any, { file }: { file: Promise<FileUpload> }) => {
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
          
        console.log('Uploading file to IPFS node...');
        const cid = await addWithCIDv1(buffer);

        if (!cid) {
          throw new Error('Failed to get CID from IPFS upload');
        }

        // Construct IPFS URL using our local gateway
        const ipfsUrl = `http://localhost:8080/ipfs/${cid}`; // TODO: have this dynamically change based on the environment
        console.log('File uploaded successfully to IPFS:', ipfsUrl);

        return { cid };
      } catch (error) {
        console.error('File upload failed', error);
        throw new GraphQLError('File upload failed', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' }
        });
      }
    },

    // TODO: Remove this once we have local IPFS implmentation.
    // will pin file after it is confirmed on blockchain and scanned by the scanner.
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
        const url = await uploadToTempGroup(buffer, filename);
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
