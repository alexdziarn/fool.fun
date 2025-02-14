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
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [formData, setFormData] = useState<TokenFormData>({
    name: '',
    ticker: '',
    description: '',
    imageUrl: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileSelect = (file: File) => {
    setFileToUpload(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fileToUpload) {
      alert('Please select an image first');
      return;
    }

    // TODO: Handle file upload here
    console.log('Form submitted:', formData, 'File:', fileToUpload);
    
    // Reset form data
    setFormData({
      name: '',
      ticker: '',
      description: '',
      imageUrl: ''
    });
    setFileToUpload(null);
    setIsOpen(false);
  };

  return (
    <div>
      {!isOpen ? (
        <button className="bg-blue-500 text-white px-4 py-2 rounded-md cursor-pointer" onClick={() => setIsOpen(true)}>
          Create New Token
        </button>
      ) : (
        <div>
          <div>
            <h2>Create New Token</h2>
            <form onSubmit={handleSubmit}>
              <div>
                <label>
                  Name
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="w-full bg-gray-100 border border-gray-300 rounded p-2 mt-1 text-black"
                  />
                </label>
              </div>
              
              <div>
                <label>
                  Ticker
                  <input
                    type="text"
                    name="ticker"
                    value={formData.ticker}
                    onChange={handleInputChange}
                    required
                    className="w-full bg-gray-100 border border-gray-300 rounded p-2 mt-1 text-black"
                  />
                </label>
              </div>
              
              <div>
                <label>
                  Description
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={4}
                    required
                    className="w-full bg-gray-100 border border-gray-300 rounded p-2 mt-1 text-black"
                  />
                </label>
              </div>

              <div>
                <label>
                  Token Image
                  <FileUpload onFileSelect={handleFileSelect} />
                </label>
              </div>

              <div>
                <button type="button" onClick={() => setIsOpen(false)}>
                  Cancel
                </button>
                <button type="submit">
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
