import { ApolloClient, InMemoryCache } from '@apollo/client';
import createUploadLink from 'apollo-upload-client/createUploadLink.mjs';

// import * as dotenv from 'dotenv';

// dotenv.config();

const uploadLink = createUploadLink({
  uri: 'http://localhost:4000/graphql',
});

export const client = new ApolloClient({
  link: uploadLink,
  cache: new InMemoryCache(),
}); 