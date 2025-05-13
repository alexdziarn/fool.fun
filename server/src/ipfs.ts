import { create } from 'ipfs-http-client';

// Create IPFS client
export const ipfs = create({ url: 'http://localhost:5001/api/v0' });

// Helper function to add content with CIDv1
export const addWithCIDv1 = async (content: Buffer | Uint8Array): Promise<string> => {
  const result = await ipfs.add(content, {
    cidVersion: 1,
    hashAlg: 'sha2-256'
  });
  return result.cid.toString();
};