import React from 'react';
import WalletContextProvider from './contexts/WalletContextProvider';
import { AuthProvider } from './contexts/AuthContext';
import AppContent from './components/AppContent';
import { ApolloProvider } from '@apollo/client';
import { client } from './apollo-client';

function App() {
  return (
    <ApolloProvider client={client}>
      <div className="min-h-screen bg-gray-800 text-gray-200 p-8">
        <h1 className="text-4xl font-bold mb-8">Fool.fun</h1>
        <WalletContextProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </WalletContextProvider>
      </div>
    </ApolloProvider>
  );
}

export default App;
