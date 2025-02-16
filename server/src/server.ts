import { ApolloServer } from '@apollo/server';
import { GraphQLError } from 'graphql';
import GraphQLUpload from 'graphql-upload/GraphQLUpload.mjs';
import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firebaseConfig } from './firebase';
import express from 'express';
import cors from 'cors';
import { expressMiddleware } from '@apollo/server/express4';
import { json } from 'body-parser';
import graphqlUploadExpress from 'graphql-upload/graphqlUploadExpress.mjs';
import { PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';

const firebaseApp = initializeApp(firebaseConfig);
const storage = getStorage(firebaseApp);

// Define TypeDefs
const typeDefs = `#graphql
  scalar Upload

  type File {
    url: String!
  }

  type Query {
    hello: String
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
    hello: () => 'Hello World!'
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

        // Create unique filename
        const timestamp = Date.now();
        const uniqueFilename = `${timestamp}-${filename}`;
        const storageRef = ref(storage, `uploads/${uniqueFilename}`);

        // Convert stream to buffer
        const stream = createReadStream();
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(chunk as Buffer);
        }
        const buffer = Buffer.concat(chunks);

        // Upload to Firebase
        await uploadBytes(storageRef, buffer, {
          contentType: mimetype
        });

        // Get download URL
        const url = await getDownloadURL(storageRef);
        console.log('File uploaded successfully:', url);

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
