import React from 'react';
import CreateToken from './components/CreateToken';

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400 mb-8">
          Fool.fun
        </h1>
        <CreateToken />
      </div>
    </div>
  );
}

export default App;
