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
  const [uploadFile] = useMutation(UPLOAD_FILE);
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
    <div className="mt-1 space-y-4">
      <input 
        type="file" 
        accept="image/*"
        onChange={handleFileChange}
        className="block w-full text-sm text-slate-500
          file:mr-4 file:py-2 file:px-4
          file:rounded-xl file:border-0
          file:text-sm file:font-medium
          file:bg-gradient-to-r file:from-indigo-50 file:to-cyan-50
          file:text-indigo-700
          hover:file:bg-gradient-to-r hover:file:from-indigo-100 hover:file:to-cyan-100
          transition-all cursor-pointer"
      />
      {preview && (
        <div className="space-y-4">
          <img 
            src={preview} 
            alt="Preview" 
            className="max-w-xs rounded-xl shadow-lg ring-1 ring-slate-200" 
          />
          <button 
            onClick={handleUpload}
            className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 
              to-cyan-500 rounded-xl hover:from-indigo-600 hover:to-cyan-600 transform 
              hover:scale-105 transition-all shadow-lg hover:shadow-indigo-500/25"
          >
            Confirm Upload
          </button>
        </div>
      )}
    </div>
  );
};

export default FileUpload;