import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Login from './Login';
import CreateToken from './CreateToken';
import { TokenList } from './TokenList';
import { ProfilePage } from './ProfilePage';

function AppContent() {
  const { isAuthenticated, logout } = useAuth();
  const [showProfile, setShowProfile] = useState(false);

  return (
    <div className="app">
      {!isAuthenticated ? (
        <Login />
      ) : (
        <div className="authenticated-content">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl">Welcome!</h2>
            <div className="flex gap-4">
              <button
                onClick={() => setShowProfile(!showProfile)}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500"
              >
                {showProfile ? 'View All Tokens' : 'My Profile'}
              </button>
              <CreateToken />
              <button 
                onClick={logout}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-500"
              >
                Logout
              </button>
            </div>
          </div>
          {showProfile ? <ProfilePage /> : <TokenList />}
        </div>
      )}
    </div>
  );
}

export default AppContent; 