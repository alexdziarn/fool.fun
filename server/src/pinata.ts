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

// TODO: Remove this once we have local IPFS implmentation.
export async function uploadToTempGroup(buffer: Buffer, filename: string): Promise<string> {
  try {
    // Check file size (10 MB limit)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB in bytes
    if (buffer.length > MAX_FILE_SIZE) {
      throw new Error(`File size (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds the 10 MB limit`);
    }

    // Upload the file first
    const file = bufferToFile(buffer, filename);
    const result = await pinata.upload.public.file(file).group(process.env.PINATA_TEMP_GROUP_ID || '');

    // if file in active group, remove it from temp group
    if (await checkFileInGroup(result.cid, process.env.PINATA_ACTIVE_GROUP_ID || '')) {
      // get the file id
      const files = await pinata.files.public.list().cid(result.cid);
      const fileId = files.files[0].id;

      // Move the file from temp group to active group
      await pinata.groups.public.removeFiles({
        groupId: process.env.PINATA_TEMP_GROUP_ID || '',
        files: [fileId]
      });
    }

    console.log(`${PINATA_GATEWAY}/${result.cid}`);
    return `https://${PINATA_GATEWAY}/ipfs/${result.cid}`;
  } catch (error) {
    console.error('Error uploading to Pinata group:', error);
    throw new Error('Failed to upload to IPFS group');
  }
}

// TODO: Remove this once we have local IPFS implmentation.
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
    // console.log(`Successfully moved file ${fileId} from ${process.env.PINATA_TEMP_GROUP_ID} to ${process.env.PINATA_ACTIVE_GROUP_ID}`);
  } catch (error) {
    console.error('Error moving file to active group:', error);
    // throw new Error('Failed to move file to active group');
  }
}

export const checkFileInGroup = async (fileCid: string, groupId: string): Promise<boolean> => {
  try {
    const filesInGroup = await pinata.files.public.list().group(groupId);
    return filesInGroup.files.some(file => file.cid === fileCid);
  } catch (error) {
    console.error('Error checking file in group:', error);
    return false;
  }
};

export const pinFile = async (fileCid: string) => {
  try {
    await pinata.upload.public.cid(fileCid);
  } catch (error) {
    console.error('Error pinning file:', error);
    throw new Error('Failed to pin file');
  }
}





