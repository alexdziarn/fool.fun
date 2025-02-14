import React, { useState } from 'react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
}

const FileUpload = ({ onFileSelect }: FileUploadProps) => {
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    onFileSelect(file);
    const previewUrl = URL.createObjectURL(file);
    setPreview(previewUrl);
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
        </div>
      )}
    </div>
  );
};

export default FileUpload;