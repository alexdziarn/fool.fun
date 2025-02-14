import React from 'react';
import CreateToken from './components/CreateToken';
// import FileUpload from './components/FileUpload';

function App() {
  return (
    <div className="min-h-screen bg-gray-800 text-gray-200 p-8">
      <h1 className="text-4xl font-bold mb-8">Fool.fun</h1>
      <CreateToken />
    </div>
  );
}

export default App;
