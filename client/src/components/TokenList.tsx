import React, { useState, useEffect } from 'react';
import { SortTokens, SortOption } from './SortTokens';
import { useQuery } from '@apollo/client';
import { GET_TOKEN_PAGE, GET_SORT_OPTIONS } from '../graphql/queries';
import { useNavigate } from 'react-router-dom';

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
};

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
  lastSteal?: string;
  lastCreate?: string;
}

export interface TokenListProps {
  onViewToken?: (tokenId: string) => void;
}

export const TokenList = ({ onViewToken }: TokenListProps = {}) => {
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortOption>('latest-buy');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  
  // Query to get available sort options
  const { data: sortOptionsData } = useQuery(GET_SORT_OPTIONS);

  // GraphQL query for paginated tokens
  const { loading, error: graphqlError, data, refetch } = useQuery(GET_TOKEN_PAGE, {
    variables: { 
      page: currentPage,
      sortBy: sortBy === 'price-desc' ? 'PRICE_DESC' : 
              sortBy === 'price-asc' ? 'PRICE_ASC' :
              sortBy === 'latest-buy' ? 'LATEST_PURCHASE' :
              sortBy === 'creation-date' ? 'CREATION_DATE' : 'PRICE_DESC',
      search: activeSearchTerm || undefined
    },
    fetchPolicy: 'cache-and-network',
    onError: (error) => {
      console.error('GraphQL error details:', error);
      if (sortOptionsData?.__type?.enumValues) {
        console.log('Available sort options:', sortOptionsData.__type.enumValues.map((v: any) => v.name).join(', '));
      }
    }
  });

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await refetch({
        page: currentPage,
        sortBy: sortBy === 'price-desc' ? 'PRICE_DESC' : 
                sortBy === 'price-asc' ? 'PRICE_ASC' :
                sortBy === 'latest-buy' ? 'LATEST_PURCHASE' :
                sortBy === 'creation-date' ? 'CREATION_DATE' : 'PRICE_DESC',
        search: activeSearchTerm || undefined
      });
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div></div>;

  const handleSortChange = (newSort: SortOption) => {
    setSortBy(newSort);
    setCurrentPage(1);
  };

  const handleSearch = () => {
    setActiveSearchTerm(searchQuery);
    setCurrentPage(1);
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
  const totalPages = Math.ceil(totalCount / 12);

  
  const handleViewToken = (tokenId: string) => {
    if (onViewToken) {
      onViewToken(tokenId);
    } else {
      navigate(`/token/${tokenId}`);
    }
  };

  return (
    <div className="p-4">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Available Tokens</h1>
          <div className="flex gap-4 items-center">
            <SortTokens sortBy={sortBy} onChange={handleSortChange} />
            <button
              onClick={handleRefresh}
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
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search by token name or symbol..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch();
              }
            }}
            className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-purple-500 placeholder-gray-400"
          />
          <button
            onClick={handleSearch}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors"
          >
            Search
          </button>
        </div>
      </div>

      {graphqlError && <div className="text-red-500 mb-4">Error: {graphqlError.message}</div>}

      {tokens.length === 0 && !loading ? (
        <div className="text-center py-8">
          {activeSearchTerm ? 'No tokens found matching your search' : 'No tokens found'}
        </div>
      ) : (
        <>
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
              {tokens.map((token: Token) => (
                <div 
                  key={token.id}
                  onClick={() => handleViewToken(token.id)}
                  className="bg-gray-700 rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-200 cursor-pointer h-64 w-64"
                >
                  <div className="h-32">
                    <img 
                      src={token.image} 
                      alt={token.name} 
                      className="object-contain w-full h-full bg-gray-800"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://placehold.co/400x300/png?text=Image+Error';
                      }}
                    />
                  </div>
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
                    <div className="text-xs text-gray-400 mt-2">
                      <div>Last stolen: {token.lastSteal ? formatDate(token.lastSteal) : 'Never'}</div>
                      <div>Created: {token.lastCreate ? formatDate(token.lastCreate) : 'Unknown'}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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