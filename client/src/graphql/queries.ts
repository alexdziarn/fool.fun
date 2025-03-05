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