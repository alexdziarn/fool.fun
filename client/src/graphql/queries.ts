import { gql } from "@apollo/client";

export const GET_TOKEN_PAGE = gql`
  query GetTokenPage($page: Int!, $pageSize: Int) {
    getTokenPage(page: $page, pageSize: $pageSize) {
      tokens {
        id
        name
        symbol
        description
        image
        currentPrice
        nextPrice
        currentHolder
        minter
        pubkey
      }
      totalCount
      hasNextPage
    }
  }
`;

export const GET_TOKEN_BY_ID = gql`
  query GetTokenById($id: String!) {
    getTokenById(id: $id) {
      token {
        id
        name
        symbol
        description
        image
        currentHolder
        minter
        currentPrice
        nextPrice
        pubkey
        createdAt
      }
      transactions {
        id
        type
        fromAddress
        toAddress
        amount
        timestamp
        success
      }
      transactionCount
    }
  }
`;

export const UPLOAD_FILE_TO_GROUP = gql`
  mutation UploadFileToTempGroup($file: Upload!) {
    uploadFileToTempGroup(file: $file) {
      url
    }
  }
`;

export const GET_TOKENS_BY_HOLDER = gql`
  query GetTokensByHolder($address: String!) {
    getTokensByHolder(address: $address) {
      id
      name
      symbol
      description
      image
      currentHolder
      minter
      currentPrice
      nextPrice
      pubkey
    }
  }
`;

export const GET_TOKENS_BY_MINTER = gql`
  query GetTokensByMinter($address: String!) {
    getTokensByMinter(address: $address) {
      id
      name
      symbol
      description
      image
      currentHolder
      minter
      currentPrice
      nextPrice
      pubkey
    }
  }
`; 