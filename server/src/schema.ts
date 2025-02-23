type Token = {
  id: string;
  name: string;
  symbol: string;
  description: string;
  image: string;
  currentHolder: string;
  minter: string;
  currentPrice: number;
  nextPrice: number;
  createdAt: number;
  transactions: Transaction[];
}

type Query {
  tokens: [Token!]!
  token(id: String!): Token
  userTokens(address: String!): [Token!]!
} 