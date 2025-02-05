// src/server.ts
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';

// Define your GraphQL schema
const typeDefs = `#graphql
  type Coin {
    id: ID!
    name: String!
    ticker: String!
    description: String!
    picture: String!
    currentPrice: Float!
    owner: String!
    incrementMultiple: Float!
  }

  type Account {
    id: ID!
    wallet: String!
    coinsCreated: [Coin!]!
    replies: [Reply!]!
    coinsOwned: [Coin!]!
  }

  type Reply {
    id: ID!
    account: Account!
    coin: Coin!
    comment: String!
  }

  type Query {
    getCoin(id: ID!): Coin
    getAccount(id: ID!): Account
    getReply(id: ID!): Reply
  }

  type Mutation {
    createCoin(
      name: String!
      ticker: String!
      description: String!
      picture: String!
      currentPrice: Float!
      owner: String!
      incrementMultiple: Float!
    ): Coin

    createAccount(wallet: String!): Account

    createReply(accountId: ID!, coinId: ID!, comment: String!): Reply
  }
`;

// Define resolvers
const resolvers = {
  Query: {
    hello: () => 'Hello, world!',
  },
};

// Create an Apollo Server instance
const server = new ApolloServer({
  typeDefs,
  resolvers,
});

// Start the server
startStandaloneServer(server, {
  listen: { port: 4000 },
}).then(({ url }) => {
  console.log(`🚀 Server ready at ${url}`);
});