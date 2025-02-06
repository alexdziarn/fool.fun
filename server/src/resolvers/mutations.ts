import { ref, set, push } from "firebase/database";
import { database } from "../firebase";

export const Mutation = {
  createCoin: async (
    _,
    { name, ticker, description, picture, currentPrice, owner, incrementMultiple }
  ) => {
    const newCoinRef = push(ref(database, "coins"));
    const newCoin = {
      name,
      ticker,
      description,
      picture,
      currentPrice,
      owner,
      incrementMultiple,
    };
    await set(newCoinRef, newCoin);
    return { id: newCoinRef.key, ...newCoin };
  },
  createAccount: async (_, { wallet }) => {
    const newAccountRef = push(ref(database, "accounts"));
    const newAccount = { wallet, coinsCreated: [], replies: [], coinsOwned: [] };
    await set(newAccountRef, newAccount);
    return { id: newAccountRef.key, ...newAccount };
  },
  createReply: async (_, { accountId, coinId, comment }) => {
    const newReplyRef = push(ref(database, "replies"));
    const newReply = { accountId, coinId, comment };
    await set(newReplyRef, newReply);
    return { id: newReplyRef.key, ...newReply };
  },
};