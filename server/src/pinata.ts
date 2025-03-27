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

// DEPRECATED: use uploadToPinataGroup instead
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

export async function moveFileFromTempToActiveGroup(fileCid: string) {
  try {
    // get the file id
    const files = await pinata.files.public.list().cid(fileCid);
    const fileId = files.files[0].id;

    // Move the file from temp group to active group
    await pinata.groups.public.removeFiles({
      groupId: process.env.PINATA_TEMP_GROUP_ID || '',
      files: [fileId]
    })
    await pinata.groups.public.addFiles({
      groupId: process.env.PINATA_ACTIVE_GROUP_ID || '',
      files: [fileId]
    })
    console.log(`Successfully moved file ${fileId} from ${process.env.PINATA_TEMP_GROUP_ID} to ${process.env.PINATA_ACTIVE_GROUP_ID}`);
  } catch (error) {
    console.error('Error moving file to active group:', error);
    throw new Error('Failed to move file to active group');
  }
}

/**
 * Deletes all files from the temp group that are older than 24 hours
 */
export async function deleteOldFilesFromTempGroup() {
  try {
    const files = await pinata.files.public.list().group(process.env.PINATA_TEMP_GROUP_ID || '');
    const oldFiles = files.files.filter(file => new Date(file.created_at) < new Date(Date.now() - 24 * 60 * 60 * 1000));
    await pinata.groups.public.removeFiles({
      groupId: process.env.PINATA_TEMP_GROUP_ID || '',
      files: oldFiles.map(file => file.id)
    })
  } catch (error) {
    console.error('Error deleting old files from temp group:', error);
    throw new Error('Failed to delete old files from temp group');
  }
}