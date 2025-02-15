import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import Login from './Login';
import CreateToken from './CreateToken';

function AppContent() {
  const { isAuthenticated, logout } = useAuth();

  return (
    <div className="app">
      {!isAuthenticated ? (
        <Login />
      ) : (
        <div className="authenticated-content">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl">Welcome!</h2>
            <button 
              onClick={logout}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-500"
            >
              Logout
            </button>
          </div>
          <CreateToken />
        </div>
      )}
    </div>
  );
}

export default AppContent; 