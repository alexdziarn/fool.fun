import { ref, get, query, orderByChild, equalTo } from "firebase/database";
import { database } from "../firebase";

interface Coin {
  id: string,
  name: string,
  ticker: string,
  description: string,
  picture: string,
  currentPrice: number,
  currentOwner: string,
  incrementMultiple: number,
  transactions: Transaction[]
}
interface Account {
  id: string,
  userName: string,
  walletAddress: string,
  coinsCreated: Coin[],
  coinsOwned: Coin[],
  replies: Reply[]
}
interface Reply {
  id: string,
  accountId: string,
  coinId: string,
  comment: string,
  time: string //ISO 8601 format, will turn into datetime in frontend
}
interface Transaction {
  id: string,
  coin: Coin,
  type: string,
  from: Account,
  to: Account,
  time: string
}

export const Query = {
  getCoin: async ( coinId: string ): Promise<Coin> => {
    const coinRef = ref(database, `coins/${coinId}`);
    const snapshot = await get(coinRef);
    if (snapshot.exists()) {
      return { coinId, ...snapshot.val() };
    } else {
      throw new Error("Coin not found");
    }
  },
  getAccount: async ( accountId: string ): Promise<Account> => {
    const accountRef = ref(database, `accounts/${accountId}`);
    const snapshot = await get(accountRef);
    if (snapshot.exists()) {
      return { accountId, ...snapshot.val() };
    } else {
      throw new Error("Account not found");
    }
  },
  getCoinReplies: async (coinId: string ): Promise<Reply[]> => {
    //query replies and filter by coinId
    const replyRef = ref(database, "replies");
    const replyQuery = query(replyRef, orderByChild("time"), equalTo(coinId));
    const snapshot = await get(replyQuery);
    if (snapshot.exists()) {
      const replyData = snapshot.val();
      return Object.keys(replyData).map((key) => ({
        id: key,
        ...replyData[key],
      }));
    } else {
      throw new Error("Coin not found");
    }
  },
  getTransaction: async ( transactionId: string ) => {
    const transactionRef = ref(database, `transactions/${transactionId}`);
    const snapshot = await get(transactionRef);
    if (snapshot.exists()) {
      return { transactionId, ...snapshot.val() };
    } else {
      throw new Error("Transaction not found");
    }
  }
}