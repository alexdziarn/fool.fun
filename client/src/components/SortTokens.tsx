import React from 'react';

export type SortOption = 'price-asc' | 'price-desc' | 'latest-buy' | 'creation-date';

interface SortTokensProps {
  sortBy: SortOption;
  onChange: (option: SortOption) => void;
}

export const SortTokens = ({ sortBy, onChange }: SortTokensProps) => {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-400">Sort by:</span>
      <select
        value={sortBy}
        onChange={(e) => onChange(e.target.value as SortOption)}
        className="bg-gray-700 text-white rounded px-3 py-1 text-sm border border-gray-600 focus:outline-none focus:border-purple-500"
      >
        <option value="price-desc">Price (High to Low)</option>
        <option value="price-asc">Price (Low to High)</option>
        <option value="latest-buy">Latest Purchase</option>
        <option value="creation-date">Creation Date</option>
      </select>
    </div>
  );
}; 