import React from 'react';
import ReactDOM from 'react-dom/client';
import { ApolloClient, InMemoryCache, ApolloProvider, gql } from '@apollo/client';
import createUploadLink from 'apollo-upload-client/createUploadLink.mjs';
import App from './App';

const uploadLink = createUploadLink({
  uri: 'http://localhost:4000/graphql',
});

const client = new ApolloClient({
  link: uploadLink,
  cache: new InMemoryCache(),
});

client.query({ query: gql`query { hello }` })
  .then(result => console.log('Connection test:', result))
  .catch(error => console.error('Connection error:', error));

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <ApolloProvider client={client}>
    <App />
  </ApolloProvider>
);