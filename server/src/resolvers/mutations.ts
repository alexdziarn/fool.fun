import { ref, set, push } from "firebase/database";
import { database } from "../firebase";

export const Mutation = {
  createCoin: async (
    name: string,
    ticker: string,
    description: string,
    picture: string,
    currentPrice: number,
    owner: string,
    incrementMultiple: number ) => {
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
  createAccount: async ( wallet: string ) => {
    const newAccountRef = push(ref(database, "accounts"));
    const userName: string = wallet.substring(0, 8);
    const newAccount = { userName, wallet, coinsCreated: [], replies: [], coinsOwned: [] };
    await set(newAccountRef, newAccount);
    return { id: newAccountRef.key, ...newAccount };
  },
  createReply: async ( accountId: string, coinId: string, comment: string, time: string ) => {
    // time var will be converted to time type in frontend
    const newReplyRef = push(ref(database, "replies"));
    const newReply = { accountId, coinId, comment, time };
    await set(newReplyRef, newReply);
    return { id: newReplyRef.key, ...newReply };
  },
  createTransaction: async ( coinId: string, type: string, from: string, to: string, time: string ) => {
    const newTransactionRef = push(ref(database, "transactions"));
    const newTransaction = { coin: coinId, type, from, to, time };
    await set(newTransactionRef, newTransaction);
    return { id: newTransactionRef.key, ...newTransaction };
  }
};