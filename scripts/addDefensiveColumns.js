import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

// SQL Server configuration
const config = {
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options: {
    encrypt: process.env.SQL_ENCRYPT === 'true',
    trustServerCertificate: process.env.SQL_TRUST_SERVER_CERTIFICATE === 'true',
    enableArithAbort: true,
  },
};

async function addDefensiveColumns() {
  let pool;

  try {
    console.log('Connecting to SQL Server...');
    pool = await sql.connect(config);
    console.log('✓ Connected successfully\n');

    // Check and add clearances_blocks_interceptions
    console.log('Checking clearances_blocks_interceptions column...');
    const cbiCheck = await pool.request().query(`
      SELECT COUNT(*) as count
      FROM sys.columns
      WHERE object_id = OBJECT_ID('dbo.players')
      AND name = 'clearances_blocks_interceptions'
    `);

    if (cbiCheck.recordset[0].count === 0) {
      await pool.request().query(`
        ALTER TABLE dbo.players ADD clearances_blocks_interceptions INT DEFAULT 0
      `);
      console.log('✓ Added clearances_blocks_interceptions column\n');
    } else {
      console.log('  clearances_blocks_interceptions column already exists\n');
    }

    // Check and add recoveries
    console.log('Checking recoveries column...');
    const recoveriesCheck = await pool.request().query(`
      SELECT COUNT(*) as count
      FROM sys.columns
      WHERE object_id = OBJECT_ID('dbo.players')
      AND name = 'recoveries'
    `);

    if (recoveriesCheck.recordset[0].count === 0) {
      await pool.request().query(`
        ALTER TABLE dbo.players ADD recoveries INT DEFAULT 0
      `);
      console.log('✓ Added recoveries column\n');
    } else {
      console.log('  recoveries column already exists\n');
    }

    // Check and add tackles
    console.log('Checking tackles column...');
    const tacklesCheck = await pool.request().query(`
      SELECT COUNT(*) as count
      FROM sys.columns
      WHERE object_id = OBJECT_ID('dbo.players')
      AND name = 'tackles'
    `);

    if (tacklesCheck.recordset[0].count === 0) {
      await pool.request().query(`
        ALTER TABLE dbo.players ADD tackles INT DEFAULT 0
      `);
      console.log('✓ Added tackles column\n');
    } else {
      console.log('  tackles column already exists\n');
    }

    // Check and add defensive_contribution
    console.log('Checking defensive_contribution column...');
    const dcCheck = await pool.request().query(`
      SELECT COUNT(*) as count
      FROM sys.columns
      WHERE object_id = OBJECT_ID('dbo.players')
      AND name = 'defensive_contribution'
    `);

    if (dcCheck.recordset[0].count === 0) {
      await pool.request().query(`
        ALTER TABLE dbo.players ADD defensive_contribution INT DEFAULT 0
      `);
      console.log('✓ Added defensive_contribution column\n');
    } else {
      console.log('  defensive_contribution column already exists\n');
    }

    console.log('✅ Migration completed successfully!');
    console.log('\nNext step: Run "node scripts/updateFPL.js" to populate the data');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
      console.log('\n✓ Database connection closed');
    }
  }
}

// Run the migration
addDefensiveColumns();
