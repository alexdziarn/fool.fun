import { Buffer } from 'buffer';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Token } from '../types';

export function parseTokenData(data: Buffer): Omit<Token, 'id' | 'createdAt'> {
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
    name,
    symbol,
    description,
    image,
    currentHolder,
    minter,
    currentPrice,
    nextPrice
  };
} 