import { ref, get } from "firebase/database";
import { database } from "../firebase";

export const Query = {
  getCoin: async (_, { id }) => {
    const coinRef = ref(database, `coins/${id}`);
    const snapshot = await get(coinRef);
    if (snapshot.exists()) {
      return { id, ...snapshot.val() };
    } else {
      throw new Error("Coin not found");
    }
  },
  getAccount: async (_, { id }) => {
    const accountRef = ref(database, `accounts/${id}`);
    const snapshot = await get(accountRef);
    if (snapshot.exists()) {
      return { id, ...snapshot.val() };
    } else {
      throw new Error("Account not found");
    }
  },
  getReply: async (_, { id }) => {
    const replyRef = ref(database, `replies/${id}`);
    const snapshot = await get(replyRef);
    if (snapshot.exists()) {
      return { id, ...snapshot.val() };
    } else {
      throw new Error("Reply not found");
    }
  },
}