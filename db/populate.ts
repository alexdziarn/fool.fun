import { DynamoDBClient, CreateTableCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { clusterApiUrl, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Connection } from "@solana/web3.js";
import { PROGRAM_ID } from "./config/constants";
import { PublicKey } from '@solana/web3.js';

// Configure the DynamoDB client to connect to the local instance
const client = new DynamoDBClient({
  region: "local-env",
  endpoint: "http://localhost:8000",
  credentials: {
    accessKeyId: "fakeMyKeyId",
    secretAccessKey: "fakeSecretAccessKey",
  },
});

const docClient = DynamoDBDocumentClient.from(client);

interface Token {
  name: string;
  symbol: string;
  description: string;
  image: string;
  currentHolder: string;
  minter: string;
  currentPrice: number;
  nextPrice: number;
  pubkey?: string;
  createdAt?: number;
  id: string;
}

// Define the table name
const TOKEN_TABLE = "Tokens";

async function getTokenData() {
  try {
    // TODO: Change connection based on environment
    const connection = new Connection(clusterApiUrl('devnet'));
    const accounts = await connection.getProgramAccounts(PROGRAM_ID);
    console.log(`Found ${accounts.length} tokens`);

    // Sample token data
    const tokenData:Token[] = accounts.map(({ pubkey, account }) => {
      try {
        const data = account.data;
        let offset = 8; // Skip discriminator
        
        // Helper to read string
        const readString = () => {
          const len = data.readUInt32LE(offset);
          offset += 4;
          const str = data.slice(offset, offset + len).toString();
          offset += len;
          return str;
        };
        
        const name = readString();
        const symbol = readString();
        const description = readString();
        const image = readString();
        const currentHolder = new PublicKey(data.slice(offset, offset + 32)).toString();
        offset += 32;
        const minter = new PublicKey(data.slice(offset, offset + 32)).toString();
        offset += 64; // skip minter and dev
        
        const currentPrice = Number(data.readBigUInt64LE(offset)) / LAMPORTS_PER_SOL;
        offset += 8;
        const nextPrice = Number(data.readBigUInt64LE(offset)) / LAMPORTS_PER_SOL;
        
        return {
          id: pubkey.toString(),
          name,
          symbol,
          description,
          image,
          currentHolder,
          minter,
          currentPrice,
          nextPrice,
          pubkey: pubkey.toString()
        };
      } catch (err) {
        console.error(`Error parsing token ${pubkey.toString()}:`, err);
        return null;
      }
    }).filter(token => token !== null);

    return tokenData;
  } catch (error) {
    console.error("Error populating tokens table:", error);
  }

}

// Function to create the table if it doesn't exist
async function createTableIfNotExists() {
  try {
    const createTableCommand = new CreateTableCommand({
      TableName: TOKEN_TABLE,
      KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
      AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5,
      },
    });

    await client.send(createTableCommand);
    console.log(`Table ${TOKEN_TABLE} created successfully`);
  } catch (error) {
    // If the table already exists, this will throw an error, which we can ignore
    console.log(`Table ${TOKEN_TABLE} may already exist or there was an error:`, error);
  }
}

// Function to populate the table with coin data
async function populateCoinsTable() {
  const tokenData: Token[] | undefined = await getTokenData();

  if (!tokenData) {
    console.error("No token data found");
    return;
  }

  console.log("Starting to populate coins table...");
  
  try {
    // First ensure the table exists
    await createTableIfNotExists();
    
    // Add each coin to the database
    for (const token of tokenData) {
      const params = {
        TableName: TOKEN_TABLE,
        Item: token,
      };
      
      await docClient.send(new PutCommand(params));
      console.log(`Added token: ${token.name} (${token.symbol})`);
    }
    
    console.log("Finished populating tokens table successfully!");
  } catch (error) {
    console.error("Error populating tokens table:", error);
  }
}

// Run the populate function
populateCoinsTable();
