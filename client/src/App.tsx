import React from 'react';
import { useQuery, gql } from '@apollo/client';

import './App.css';


// Define a GraphQL query
// const HELLO_QUERY = gql`
//   query Hello {
//     hello
//   }
// `;

function App() {
  // const { loading, error, data } = useQuery(HELLO_QUERY);

  // if (loading) return <p>Loading...</p>;
  // if (error) return <p>Error: {error.message}</p>;

  return (
    <div>
      {/* <h1>{data.hello}</h1> */}
      
    </div>
  );
}

export default App;
