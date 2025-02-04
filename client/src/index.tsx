import React from 'react';
import { createRoot } from 'react-dom/client'; // Import createRoot
import { ApolloClient, InMemoryCache, ApolloProvider } from '@apollo/client';
import App from './App.tsx';

import './index.css';
// import reportWebVitals from './reportWebVitals';

// Create an Apollo Client instance
const client = new ApolloClient({
  uri: 'http://localhost:4000', // Backend server URL
  cache: new InMemoryCache(),
});

// Wrap the app with ApolloProvider
const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
  <ApolloProvider client={client}>
    <App />
  </ApolloProvider>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// reportWebVitals();
