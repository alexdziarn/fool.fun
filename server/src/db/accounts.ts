import { Pool } from 'pg';
import { getPool } from './pool';

export interface Account {
  id: string; // wallet address
  username?: string;
  email?: string;
}

export interface EmailPreferences {
  email: string;
  steal: boolean;
  transfer: boolean;
  create: boolean;
}

/**
 * Create the accounts table if it doesn't exist
 */
export async function createAccountsTable(): Promise<void> {
  const pool = getPool();
  const query = `
    CREATE TABLE IF NOT EXISTS accounts (
      id VARCHAR(42) PRIMARY KEY, -- Ethereum address (0x + 40 hex chars)
      username VARCHAR(50) UNIQUE,
      email VARCHAR(255) UNIQUE
    );

    CREATE INDEX IF NOT EXISTS idx_accounts_username ON accounts(username);
    CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email);
  `;

  try {
    await pool.query(query);
    console.log('Accounts table created or already exists');
  } catch (error) {
    console.error('Error creating accounts table:', error);
    throw error;
  }
}

/**
 * Create the email preferences table if it doesn't exist
 */
export async function createEmailPreferencesTable(): Promise<void> {
  const pool = getPool();
  const query = `
    CREATE TABLE IF NOT EXISTS email_preferences (
      email VARCHAR(255) PRIMARY KEY,
      steal BOOLEAN DEFAULT false,
      transfer BOOLEAN DEFAULT false,
      create BOOLEAN DEFAULT false,
      FOREIGN KEY (email) REFERENCES accounts(email) ON DELETE CASCADE
    );
  `;

  try {
    await pool.query(query);
    console.log('Email preferences table created or already exists');
  } catch (error) {
    console.error('Error creating email preferences table:', error);
    throw error;
  }
}

/**
 * Create or update an account
 */
export async function upsertAccount(
  walletAddress: string,
  username?: string,
  email?: string
): Promise<Account> {
  const pool = getPool();
  const query = `
    INSERT INTO accounts (id, username, email)
    VALUES ($1, $2, $3)
    ON CONFLICT (id) 
    DO UPDATE SET 
      username = EXCLUDED.username,
      email = EXCLUDED.email
    RETURNING *
  `;

  try {
    const result = await pool.query(query, [walletAddress, username, email]);
    return result.rows[0];
  } catch (error) {
    console.error('Error upserting account:', error);
    throw error;
  }
}

/**
 * Get an account by wallet address
 */
export async function getAccountById(walletAddress: string): Promise<Account | null> {
  const pool = getPool();
  const query = `
    SELECT * FROM accounts WHERE id = $1
  `;

  try {
    const result = await pool.query(query, [walletAddress]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting account:', error);
    throw error;
  }
}

/**
 * Get an account by username
 */
export async function getAccountByUsername(username: string): Promise<Account | null> {
  const pool = getPool();
  const query = `
    SELECT * FROM accounts WHERE username = $1
  `;

  try {
    const result = await pool.query(query, [username]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting account by username:', error);
    throw error;
  }
}

/**
 * Get an account by email
 */
export async function getAccountByEmail(email: string): Promise<Account | null> {
  const pool = getPool();
  const query = `
    SELECT * FROM accounts WHERE email = $1
  `;

  try {
    const result = await pool.query(query, [email]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting account by email:', error);
    throw error;
  }
}

/**
 * Update an account's username
 */
export async function updateUsername(walletAddress: string, username: string): Promise<void> {
  const pool = getPool();
  const query = `
    UPDATE accounts 
    SET username = $1
    WHERE id = $2
  `;

  try {
    await pool.query(query, [username, walletAddress]);
  } catch (error) {
    console.error('Error updating username:', error);
    throw error;
  }
}

/**
 * Update an account's email
 */
export async function updateEmail(walletAddress: string, email: string): Promise<void> {
  const pool = getPool();
  const query = `
    UPDATE accounts 
    SET email = $1
    WHERE id = $2
  `;

  try {
    await pool.query(query, [email, walletAddress]);
  } catch (error) {
    console.error('Error updating email:', error);
    throw error;
  }
}

/**
 * Get email preferences for an email address
 */
export async function getEmailPreferences(email: string): Promise<EmailPreferences | null> {
  const pool = getPool();
  const query = `
    SELECT * FROM email_preferences WHERE email = $1
  `;

  try {
    const result = await pool.query(query, [email]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting email preferences:', error);
    throw error;
  }
}

/**
 * Create or update email preferences
 */
export async function upsertEmailPreferences(
  email: string,
  preferences: {
    steal?: boolean;
    transfer?: boolean;
    create?: boolean;
  }
): Promise<EmailPreferences> {
  const pool = getPool();
  const query = `
    INSERT INTO email_preferences (email, steal, transfer, create)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (email) 
    DO UPDATE SET 
      steal = COALESCE(EXCLUDED.steal, email_preferences.steal),
      transfer = COALESCE(EXCLUDED.transfer, email_preferences.transfer),
      create = COALESCE(EXCLUDED.create, email_preferences.create)
    RETURNING *
  `;

  try {
    const result = await pool.query(query, [
      email,
      preferences.steal ?? false,
      preferences.transfer ?? false,
      preferences.create ?? false
    ]);
    return result.rows[0];
  } catch (error) {
    console.error('Error upserting email preferences:', error);
    throw error;
  }
}

/**
 * Update a single email preference
 */
export async function updateEmailPreference(
  email: string,
  preference: 'steal' | 'transfer' | 'create',
  value: boolean
): Promise<void> {
  const pool = getPool();
  const query = `
    UPDATE email_preferences 
    SET ${preference} = $1
    WHERE email = $2
  `;

  try {
    await pool.query(query, [value, email]);
  } catch (error) {
    console.error(`Error updating ${preference} preference:`, error);
    throw error;
  }
} 