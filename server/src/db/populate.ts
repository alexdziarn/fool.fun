import pool, { closePool } from './pool';
import { createTokenTableIfNotExists } from './tokens';
import { createTransactionTableIfNotExists } from './transactions';
import { spawn } from 'child_process';

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
    await runScript('db/populate-tokens.ts');
    
    // Run populate-transactions script
    console.log("Populating transactions table...");
    await runScript('db/populate-transactions.ts');
    
    console.log("Database setup and population complete");
    
    // Safely close the pool
    await closePool();
    
    return 0; // Success exit code
  } catch (error) {
    console.error("Error in main function:", error);
    
    // Try to safely close the pool even on error
    try {
      await closePool();
    } catch (poolError) {
      console.error("Error closing database connection:", poolError);
    }
    
    return 1; // Error exit code
  }
}

// Run the main function if this file is executed directly
if (require.main === module) {
  main()
    .then((exitCode) => {
      console.log("Script completed successfully");
      // Use setTimeout to allow any pending operations to complete
      setTimeout(() => {
        process.exit(exitCode);
      }, 100);
    })
    .catch(error => {
      console.error("Script failed:", error);
      // Use setTimeout to allow any pending operations to complete
      setTimeout(() => {
        process.exit(1);
      }, 100);
    });
}
