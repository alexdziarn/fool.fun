import axios from 'axios';
import FormData from 'form-data';
import * as dotenv from "dotenv";

dotenv.config();

const PINATA_JWT = process.env.PINATA_JWT;

export async function uploadToPinata(buffer: Buffer, filename: string): Promise<string> {
  try {
    const formData = new FormData();
    formData.append('file', buffer, {
      filename: filename,
    });

    const response = await axios.post(
      'https://api.pinata.cloud/pinning/pinFileToIPFS',
      formData,
      {
        headers: {
          'Content-Type': `multipart/form-data; boundary=${formData.getBoundary()}`,
          Authorization: `Bearer ${PINATA_JWT}`,
        },
      }
    );
    console.log(`https://gateway.pinata.cloud/ipfs/${response.data.IpfsHash}`);
    return `https://gateway.pinata.cloud/ipfs/${response.data.IpfsHash}`;
  } catch (error) {
    console.error('Error uploading to Pinata:', error);
    throw new Error('Failed to upload to IPFS');
  }
} 