const sql = require('mssql');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const config = {
  server: process.env.SQL_SERVER,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options: {
    encrypt: process.env.SQL_ENCRYPT === 'true',
    trustServerCertificate: process.env.SQL_TRUST_SERVER_CERTIFICATE === 'true',
    enableArithAbort: true,
    connectionTimeout: 30000,
    requestTimeout: 60000,
  },
};

async function runSchema() {
  console.log('Reading schema.sql...');
  const schemaPath = path.join(__dirname, '..', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  // Split by GO statements
  const batches = schema
    .split(/^\s*GO\s*$/gim)
    .map((batch) => batch.trim())
    .filter((batch) => batch.length > 0);

  console.log(`Found ${batches.length} SQL batches to execute\n`);

  let pool;
  try {
    console.log('Connecting to SQL Server...');
    pool = await sql.connect(config);
    console.log('✓ Connected to SQL Server\n');

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`Executing batch ${i + 1}/${batches.length}...`);

      try {
        await pool.request().query(batch);
        console.log(`✓ Batch ${i + 1} completed\n`);
      } catch (error) {
        // Some errors are expected (like "database already exists")
        if (error.message.includes('already exists')) {
          console.log(`⚠ Batch ${i + 1}: ${error.message}\n`);
        } else {
          console.error(`✗ Batch ${i + 1} failed:`, error.message, '\n');
        }
      }
    }

    console.log('='.repeat(60));
    console.log('✓ Schema setup completed!');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('='.repeat(60));
    console.error('✗ Error:');
    console.error('='.repeat(60));
    console.error(error);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
      console.log('\nConnection closed.');
    }
  }
}

runSchema();
