/**
 * Reset admin password utility.
 * Run on VPS: node reset-admin.js
 * This will reset the admin password to 'admin123' or create the admin user if missing.
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const sheetsService = require('./services/sheetsService');

async function resetAdmin() {
  try {
    console.log('Connecting to Google Sheets...');
    await sheetsService.ensureUsersSheet();

    const admin = await sheetsService.findUser('admin');
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash('admin123', salt);

    if (admin) {
      console.log('Admin user found at row', admin._rowIndex);
      console.log('Resetting password to: admin123');
      await sheetsService.updateUser(admin._rowIndex, { password: hashedPassword });
      console.log('Admin password reset successfully!');
    } else {
      console.log('Admin user not found. Creating...');
      await sheetsService.appendUser({
        username: 'admin',
        password: hashedPassword,
        role: 'ADMIN',
        name: 'Administrator',
        email: process.env.ADMIN_EMAIL || '',
      });
      console.log('Admin user created with password: admin123');
    }

    // List all users for debugging
    const users = await sheetsService.getAllUsers();
    console.log('\nAll users in sheet:');
    users.forEach((u) => {
      console.log(`  - ${u.username} (${u.role}) | password hash exists: ${!!u.password}`);
    });

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    console.error('\nCheck your .env file:');
    console.error('  - GOOGLE_SHEETS_ID is set');
    console.error('  - GOOGLE_SERVICE_ACCOUNT_EMAIL is set');
    console.error('  - GOOGLE_PRIVATE_KEY is properly formatted with \\n and wrapped in double quotes');
    process.exit(1);
  }
}

resetAdmin();
