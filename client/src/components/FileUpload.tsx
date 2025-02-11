import React, { useState } from 'react';
import { gql, useMutation } from '@apollo/client';

const UPLOAD_FILE = gql`
  mutation UploadFile($file: Upload!) {
    uploadFile(file: $file) {
      url
    }
  }
`;

const FileUpload = () => {
  const [uploadFile, { loading, error, data }] = useMutation(UPLOAD_FILE);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    const previewUrl = URL.createObjectURL(file);
    setPreview(previewUrl);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      const { data } = await uploadFile({
        variables: { file: selectedFile },
        context: {
          headers: {
            'Apollo-Require-Preflight': 'true',
          }
        }
      });
      
      // Clear preview after successful upload
      setPreview(null);
      setSelectedFile(null);
    } catch (err) {
      console.error('Upload failed:', err);
    }
  };

  React.useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  return (
    <div>
      <input 
        type="file" 
        accept="image/*"
        onChange={handleFileChange}
        disabled={loading}
        value=""
      />
      {preview && (
        <div style={{ marginTop: '20px' }}>
          <img 
            src={preview} 
            alt="Preview" 
            style={{ maxWidth: '200px', marginBottom: '10px' }} 
          />
          <br />
          <button 
            onClick={handleUpload} 
            disabled={loading}
          >
            {loading ? 'Uploading...' : 'Confirm Upload'}
          </button>
        </div>
      )}
      {error && (
        <p style={{ color: 'red', marginTop: '10px' }}>
          Upload failed: {error.message}
        </p>
      )}
      {data?.uploadFile?.url && (
        <div style={{ marginTop: '10px' }}>
          <p style={{ color: 'green' }}>✓ Upload successful!</p>
          <a 
            href={data.uploadFile.url} 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ color: '#0066cc' }}
          >
            View uploaded image
          </a>
        </div>
      )}
    </div>
  );
};

export default FileUpload;