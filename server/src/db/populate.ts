import { closePool } from './pool';
import { createTokenTableIfNotExists } from './tokens';
import { createTransactionTableIfNotExists } from './transactions';
import { spawn } from 'child_process';
import path from 'path';  

/**
 * Runs a script using ts-node
 * @param scriptPath Path to the script to run
 */
async function runScript(scriptPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`Running script: ${scriptPath}`);
    
    const process = spawn('ts-node', [scriptPath], {
      stdio: 'inherit',
      shell: true
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        console.log(`Script ${scriptPath} completed successfully`);
        resolve();
      } else {
        console.error(`Script ${scriptPath} failed with code ${code}`);
        reject(new Error(`Script ${scriptPath} failed with code ${code}`));
      }
    });
    
    process.on('error', (err) => {
      console.error(`Error running script ${scriptPath}:`, err);
      reject(err);
    });
  });
}

/**
 * Main function to orchestrate the database setup and population
 */
async function main() {
  try {
    // Create tables if they don't exist
    console.log("Creating database tables...");
    await createTokenTableIfNotExists();
    await createTransactionTableIfNotExists();
    
    // Run populate-tokens script
    console.log("Populating tokens table...");
    await runScript(path.join(__dirname, 'populate-tokens.ts'));
    
    // Run populate-transactions script
    console.log("Populating transactions table...");
    await runScript(path.join(__dirname, 'populate-transactions.ts'));


    // TODO: complete functionality of emailing system
    // Run populate-accounts script
    // console.log("Populating accounts table...");
    // await runScript(path.join(__dirname, 'populate-accounts.ts'));
    
    console.log("Database population completed successfully");
  } catch (error) {
    console.error("Error in main function:", error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

// Run the main function
main().catch(error => {
  console.error("Script completed with error:", error);
  process.exit(1);
});
