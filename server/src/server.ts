// src/server.ts
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { Account } from './resolvers/account';
import { Coin } from './resolvers/coin';
import { Mutation } from './resolvers/mutations';
import { Query } from './resolvers/queries';
import { Reply } from './resolvers/reply';
import { readFileSync } from "fs";
import { join } from "path";

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
startStandaloneServer(server, {
  listen: { port: 4000 },
}).then(({ url }) => {
  console.log(`🚀 Server ready at ${url}`);
});