// src/server.ts
import { ApolloServer } from '@apollo/server';
import express from 'express';
import { Account } from './resolvers/account';
import { Coin } from './resolvers/coin';
import { Mutation } from './resolvers/mutations';
import { Query } from './resolvers/queries';
import { Reply } from './resolvers/reply';
import { readFileSync } from "fs";
import { join } from "path";
import { processRequest } from 'graphql-upload';
import { initializeApp, cert } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import * as fs from 'fs';
import * as path from 'path';
import { createWriteStream } from 'fs';
import { finished } from 'stream/promises';

// Define your GraphQL schema
const coinTypeDefs = readFileSync(join(__dirname, "Coin.graphql"), "utf-8");
const accountTypeDefs = readFileSync(join(__dirname, "Account.graphql"), "utf-8");
const replyTypeDefs = readFileSync(join(__dirname, "Reply.graphql"), "utf-8");
const queryTypeDefs = readFileSync(join(__dirname, "Query.graphql"), "utf-8");
const mutationTypeDefs = readFileSync(join(__dirname, "Mutation.graphql"), "utf-8");
const typeDefs = [
  coinTypeDefs,
  accountTypeDefs,
  replyTypeDefs,
  queryTypeDefs,
  mutationTypeDefs,
];

// Define resolvers
const resolvers = {
  Account,
  Coin,
  Mutation,
  Query,
  Reply
};

// Create an Apollo Server instance
const server = new ApolloServer({ typeDefs, resolvers });

// Start the server
const app = express();

// Enable file uploads
app.use(async (req, res, next) => {
  if (req.method === 'POST' && req.headers['content-type']?.startsWith('multipart/form-data')) {
    try {
      const request = await processRequest(req, res);
      req.body = request;
      next();
    } catch (error) {
      console.error('Error processing file upload:', error);
      res.status(500).send('File upload failed');
    }
  } else {
    next();
  }
});

async function startServer() {
  await server.start();
  server.applyMiddleware({ app });

  app.listen({ port: 4000 }, () => {
    console.log(`🚀 Server ready at http://localhost:4000${server.graphqlPath}`);
  });
}

startServer();