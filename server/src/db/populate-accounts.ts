import { createAccountsTable, createEmailPreferencesTable, upsertAccount, upsertEmailPreferences } from './accounts';

async function populateAccounts() {
  try {
    // Create tables if they don't exist
    await createAccountsTable();
    await createEmailPreferencesTable();

    // Sample accounts
    const accounts = [
      {
        walletAddress: '0x1234567890123456789012345678901234567890',
        username: 'testuser1',
        email: 'test1@example.com'
      },
      {
        walletAddress: '0x0987654321098765432109876543210987654321',
        username: 'testuser2',
        email: 'test2@example.com'
      }
    ];

    // Insert accounts
    for (const account of accounts) {
      await upsertAccount(account.walletAddress, account.username, account.email);
      console.log(`Created/Updated account for ${account.username}`);
    }

    // Sample email preferences
    const preferences = [
      {
        email: 'test1@example.com',
        preferences: {
          steal: false,
          transfer: false,
          creates: false
        }
      },
      {
        email: 'test2@example.com',
        preferences: {
          steal: false,
          transfer: false,
          creates: false
        }
      }
    ];

    // Insert email preferences
    for (const pref of preferences) {
      await upsertEmailPreferences(pref.email, pref.preferences);
      console.log(`Created/Updated preferences for ${pref.email}`);
    }

    console.log('Account population completed successfully');
  } catch (error) {
    console.error('Error populating accounts:', error);
    throw error;
  }
}

// Run the population if this file is executed directly
if (require.main === module) {
  populateAccounts()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { populateAccounts }; 