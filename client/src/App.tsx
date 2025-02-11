import React from 'react';
import { useQuery, gql } from '@apollo/client';
import FileUpload from './components/FileUpload.tsx';

import './App.css';



function App() {
  // const { loading, error, data } = useQuery(HELLO_QUERY);

  // if (loading) return <p>Loading...</p>;
  // if (error) return <p>Error: {error.message}</p>;

  return (
    <div>
      {/* <h1>{data.hello}</h1> */}
      <h1>File Upload</h1>
      <FileUpload />
    </div>
  );
}

export default App;
