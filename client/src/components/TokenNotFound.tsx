import React from 'react';
import { useNavigate } from 'react-router-dom';

const TokenNotFound: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 py-12 text-center">
      <div className="w-full max-w-md">
        <h1 className="text-4xl font-bold text-red-400 mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-gray-200 mb-6">Token Not Found</h2>
        
        <div className="mb-8 text-gray-400">
          <p className="mb-4">The token you're looking for doesn't exist or has been removed.</p>
          <p>Check the token ID or try browsing available tokens.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
          >
            Browse Tokens
          </button>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default TokenNotFound; 