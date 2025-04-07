import React, { useState } from 'react';
import { SortTokens, SortOption } from './SortTokens';
import { useQuery } from '@apollo/client';
import { GET_TOKEN_PAGE } from '../graphql/queries';
import { useNavigate } from 'react-router-dom';

interface Token {
  id: string;
  name: string;
  symbol: string;
  description: string;
  image: string;
  currentHolder: string;
  minter: string;
  currentPrice: number;
  nextPrice: number;
  pubkey?: string;
}

export interface TokenListProps {
  onViewToken?: (tokenId: string) => void;
}

export const TokenList = ({ onViewToken }: TokenListProps = {}) => {
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('price-desc');
  const [currentPage, setCurrentPage] = useState(1);
  
  // GraphQL query for paginated tokens
  const { loading, error: graphqlError, data, refetch } = useQuery(GET_TOKEN_PAGE, {
    variables: { page: currentPage },
    fetchPolicy: 'cache-and-network',
  });

  const sortTokens = (tokensToSort: Token[]) => {
    return [...tokensToSort].sort((a, b) => {
      return sortBy === 'price-asc' 
        ? a.currentPrice - b.currentPrice 
        : b.currentPrice - a.currentPrice;
    });
  };

  const handleNextPage = () => {
    if (data?.getTokenPage?.hasNextPage) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  // Get tokens from GraphQL response
  const tokens = data?.getTokenPage?.tokens || [];
  const totalCount = data?.getTokenPage?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / 5); // Using server's default page size

  
  const handleViewToken = (tokenId: string) => {
    if (onViewToken) {
      onViewToken(tokenId);
    } else {
      navigate(`/token/${tokenId}`);
    }
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Available Tokens</h1>
        <div className="flex gap-4 items-center">
          <SortTokens sortBy={sortBy} onChange={setSortBy} />
          <button
            onClick={() => {
              setRefreshing(true);
              refetch().finally(() => setRefreshing(false));
            }}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors disabled:bg-purple-400"
            disabled={refreshing || loading}
          >
            {(refreshing || loading) ? (
              <div className="flex items-center">
                <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Refreshing...
              </div>
            ) : (
              'Refresh'
            )}
          </button>
        </div>
      </div>

      {graphqlError && <div className="text-red-500 mb-4">Error: {graphqlError.message}</div>}

      {tokens.length === 0 && !loading ? (
        <div className="text-center py-8">No tokens found</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mt-8">
            {sortTokens(tokens).map((token) => (
              <div 
                key={token.id}
                onClick={() => handleViewToken(token.id)}
                className="bg-gray-700 rounded-lg p-4 cursor-pointer hover:bg-gray-600"
              >
                <img 
                  src={`${token.image}?img-width=400&img-height=300`} 
                  alt={token.name} 
                  className="w-full h-48 object-cover rounded-md mb-4"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://placehold.co/400x300/png?text=Image+Error';
                  }}
                />
                <div className="p-3">
                  <h3 className="text-sm font-semibold text-white mb-1 truncate">{token.name}</h3>
                  <p className="text-xs text-gray-400 mb-1">{token.symbol}</p>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-white text-sm font-medium">
                      {token.currentPrice} SOL
                    </span>
                    <span className="text-xs text-gray-400">
                      Next: {token.nextPrice} SOL
                    </span>
                  </div>
                </div>
                <div className="text-xs text-gray-400 mt-2 space-y-1">
                  <p>Holder: {token.currentHolder.slice(0, 4)}...{token.currentHolder.slice(-4)}</p>
                </div>
              </div>
            ))}
          </div>
          
          {/* Enhanced pagination controls */}
          <div className="flex justify-between items-center mt-8">
            <button 
              onClick={handlePrevPage} 
              disabled={currentPage === 1}
              className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
            >
              Previous
            </button>
            
            <div className="flex items-center space-x-2">
              {/* Add page number buttons for better navigation */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = i + Math.max(1, currentPage - 2);
                if (pageNum <= totalPages) {
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 rounded-full ${
                        currentPage === pageNum 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-700 hover:bg-gray-600'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                }
                return null;
              })}
              {totalPages > 5 && currentPage < totalPages - 2 && (
                <span className="text-gray-400">...</span>
              )}
            </div>
            
            <button 
              onClick={handleNextPage} 
              disabled={!data?.getTokenPage?.hasNextPage}
              className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}; 