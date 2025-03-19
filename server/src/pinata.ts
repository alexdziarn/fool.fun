import { PinataSDK } from 'pinata';
import * as dotenv from "dotenv";

dotenv.config();

const PINATA_JWT = process.env.PINATA_JWT;
const PINATA_GATEWAY = process.env.PINATA_GATEWAY;
const pinata = new PinataSDK({ pinataJwt: PINATA_JWT, pinataGateway: PINATA_GATEWAY });

// Helper function to convert Buffer to FileObject
function bufferToFile(buffer: Buffer, filename: string): File {
  return new File([buffer], filename, { type: 'application/octet-stream' });
}

export async function uploadToPinata(buffer: Buffer, filename: string): Promise<string> {
  try {
    const file = bufferToFile(buffer, filename);
    const result = await pinata.upload.public.file(file);

    console.log(`${PINATA_GATEWAY}/${result.cid}`);
    return `https://${PINATA_GATEWAY}/ipfs/${result.cid}`;
  } catch (error) {
    console.error('Error uploading to Pinata:', error);
    throw new Error('Failed to upload to IPFS');
  }
}

export async function uploadToPinataGroup(buffer: Buffer, filename: string, groupId: string): Promise<string> {
  try {
    // Upload the file first
    const file = bufferToFile(buffer, filename);
    const result = await pinata.upload.public.file(file).group(groupId);

    console.log(`${PINATA_GATEWAY}/${result.cid}`);
    return `https://${PINATA_GATEWAY}/ipfs/${result.cid}`;
  } catch (error) {
    console.error('Error uploading to Pinata group:', error);
    throw new Error('Failed to upload to IPFS group');
  }
} 