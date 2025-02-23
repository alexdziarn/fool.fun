import { Connection, PublicKey } from '@solana/web3.js';
import NodeCache from 'node-cache';
import { parseTokenData } from './utils/tokenParser';
import { PROGRAM_ID } from './constants';
import { Token, Transaction } from './types';

const tokenCache = new NodeCache({ stdTTL: 60 }); // Cache for 1 minute
const connection = new Connection(process.env.SOLANA_RPC_URL || '');

async function parseTransactions(signatures: any[], connection: Connection): Promise<Transaction[]> {
  const transactions = await Promise.all(
    signatures.map(async (sig) => {
      try {
        const tx = await connection.getTransaction(sig.signature, {
          maxSupportedTransactionVersion: 0
        });
        if (!tx) return null;

        const accountKeys = tx.transaction.message.getAccountKeys();
        const instruction = tx.transaction.message.instructions[0];
        
        // Determine if steal or transfer based on instruction data
        const isSteal = instruction.data[0] === 106;
        const isTransfer = instruction.data[0] === 163;

        if (!isSteal && !isTransfer) return null;

        return {
          signature: sig.signature,
          type: isSteal ? 'steal' : 'transfer',
          timestamp: sig.blockTime,
          from: isSteal ? accountKeys[2].toString() : accountKeys[1].toString(),
          to: isSteal ? accountKeys[1].toString() : accountKeys[2].toString(),
          amount: isSteal ? tx.meta?.postBalances[1] - tx.meta?.preBalances[1] : undefined
        };
      } catch (error) {
        console.error('Error parsing transaction:', error);
        return null;
      }
    })
  );

  return transactions.filter((tx): tx is Transaction => tx !== null);
}

export const resolvers = {
  Query: {
    tokens: async () => {
      const cached = tokenCache.get('all_tokens');
      if (cached) return cached;

      try {
        const accounts = await connection.getProgramAccounts(PROGRAM_ID);
        const tokens = await Promise.all(
          accounts.map(async ({ pubkey, account }) => {
            const token = parseTokenData(account.data);
            const signatures = await connection.getSignaturesForAddress(pubkey, { limit: 1 });
            
            return {
              ...token,
              id: pubkey.toString(),
              createdAt: signatures[0]?.blockTime || 0,
              transactions: []
            };
          })
        );

        tokenCache.set('all_tokens', tokens);
        return tokens;
      } catch (error) {
        console.error('Error fetching tokens:', error);
        throw new Error('Failed to fetch tokens');
      }
    },

    token: async (_, { id }) => {
      const cacheKey = `token_${id}`;
      const cached = tokenCache.get(cacheKey);
      if (cached) return cached;

      try {
        const account = await connection.getAccountInfo(new PublicKey(id));
        if (!account) return null;

        const token = parseTokenData(account.data);
        const signatures = await connection.getSignaturesForAddress(new PublicKey(id));
        const transactions = await parseTransactions(signatures, connection);

        const result = {
          ...token,
          id,
          transactions,
          createdAt: signatures[0]?.blockTime || 0
        };

        tokenCache.set(cacheKey, result);
        return result;
      } catch (error) {
        console.error('Error fetching token:', error);
        throw new Error('Failed to fetch token');
      }
    },

    userTokens: async (_, { address }) => {
      const allTokens = await resolvers.Query.tokens();
      return allTokens.filter(token => token.currentHolder === address);
    }
  }
}; 