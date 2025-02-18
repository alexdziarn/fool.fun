import React, { useState } from 'react';
import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client';
import FileUpload from './FileUpload';

const UPLOAD_FILE = gql`
  mutation UploadFile($file: Upload!) {
    uploadFile(file: $file) {
      url
    }
  }
`;

interface TokenFormData {
  name: string;
  ticker: string;
  description: string;
  imageUrl?: string;
}

const CreateToken = () => {
  const [uploadFile] = useMutation(UPLOAD_FILE);
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

    try {
      console.log('Uploading file...');
      const { data } = await uploadFile({
        variables: { file: fileToUpload },
        context: {
          headers: {
            'Apollo-Require-Preflight': 'true',
          }
        }
      });

      if (data?.uploadFile?.url) {
        console.log('Upload successful:', data.uploadFile.url);
        // TODO: Create token with form data and image URL
      }
    } catch (error) {
      console.error('Upload failed:', error);
    }
    
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
        <button
          type="button"
        className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          onClick={() => setIsOpen(true)}
        >
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
                <button
                  type="button"
                  className="m-5 rounded-sm bg-white px-2 py-1 text-xs font-semibold text-gray-900 ring-1 shadow-xs ring-gray-300 ring-inset hover:bg-gray-50"
                  onClick={() => setIsOpen(false)}>
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="m-5 rounded-sm bg-indigo-600 px-2 py-1 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
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
