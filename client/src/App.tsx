import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import WalletContextProvider from './contexts/WalletContextProvider';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ApolloProvider } from '@apollo/client';
import { client } from './apollo-client';
import Login from './components/Login';
import Layout from './components/Layout';
import { TokenList } from './components/TokenList';
import { ProfilePage } from './components/ProfilePage';
import { TokenPage } from './components/TokenPage';
import NotFound from './components/NotFound';
import TokenNotFound from './components/TokenNotFound';

// Protected route component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  
  if (!isAuthenticated) {
    // Pass the current location to the login page
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  return <>{children}</>;
};

function App() {
  return (
    <ApolloProvider client={client}>
      <WalletContextProvider>
        <AuthProvider>
          <Router>
            <div className="min-h-screen bg-gray-800 text-gray-200">
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={
                  <ProtectedRoute>
                    <Layout>
                      <TokenList />
                    </Layout>
                  </ProtectedRoute>
                } />
                <Route path="/profile/:walletAddress" element={
                  <ProtectedRoute>
                    <Layout>
                      <ProfilePage />
                    </Layout>
                  </ProtectedRoute>
                } />
                <Route path="/token/not-found" element={
                  <Layout>
                    <TokenNotFound />
                  </Layout>
                } />
                <Route path="/token/:tokenId" element={
                  <ProtectedRoute>
                    <Layout>
                      <TokenPage />
                    </Layout>
                  </ProtectedRoute>
                } />
                <Route path="/not-found" element={
                  <Layout>
                    <NotFound />
                  </Layout>
                } />
                <Route path="*" element={<Navigate to="/not-found" replace />} />
              </Routes>
            </div>
          </Router>
        </AuthProvider>
      </WalletContextProvider>
    </ApolloProvider>
  );
}

export default App;
