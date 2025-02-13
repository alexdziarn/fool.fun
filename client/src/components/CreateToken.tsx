import React, { useState } from 'react';
import FileUpload from './FileUpload';

interface TokenFormData {
  name: string;
  ticker: string;
  description: string;
  imageUrl?: string;
}

const CreateToken = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState<TokenFormData>({
    name: '',
    ticker: '',
    description: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
    // TODO: Add mutation to create token
    setIsOpen(false);
  };

  return (
    <div>
      {!isOpen ? (
        <button 
          onClick={() => setIsOpen(true)}
          className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-cyan-500 text-white rounded-xl 
            hover:from-indigo-600 hover:to-cyan-600 transform hover:scale-105 transition-all 
            shadow-lg hover:shadow-indigo-500/25"
        >
          Create New Token
        </button>
      ) : (
        <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-8 w-full max-w-2xl shadow-xl">
            <h2 className="text-3xl font-bold text-slate-800 mb-8">Create New Token</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Name
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-xl border-slate-200 bg-slate-50 shadow-sm 
                      focus:border-indigo-500 focus:ring-indigo-500 hover:border-indigo-400 transition-colors"
                    required
                  />
                </label>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Ticker
                  <input
                    type="text"
                    name="ticker"
                    value={formData.ticker}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-xl border-slate-200 bg-slate-50 shadow-sm 
                      focus:border-indigo-500 focus:ring-indigo-500 hover:border-indigo-400 transition-colors"
                    required
                  />
                </label>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Description
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={4}
                    className="mt-1 block w-full rounded-xl border-slate-200 bg-slate-50 shadow-sm 
                      focus:border-indigo-500 focus:ring-indigo-500 hover:border-indigo-400 transition-colors"
                    required
                  />
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Token Image
                  <FileUpload />
                </label>
              </div>

              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl 
                    hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 
                    to-cyan-500 rounded-xl hover:from-indigo-600 hover:to-cyan-600 transform 
                    hover:scale-105 transition-all shadow-lg hover:shadow-indigo-500/25"
                >
                  Create Token
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateToken;
