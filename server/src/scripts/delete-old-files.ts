import { deleteOldFilesFromTempGroup } from '../pinata';

async function main() {
  try {
    await deleteOldFilesFromTempGroup();
    console.log('Successfully deleted old files from temp group');
    process.exit(0);
  } catch (error) {
    console.error('Failed to delete old files:', error);
    process.exit(1);
  }
}

main(); 