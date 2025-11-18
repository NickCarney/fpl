import sql from 'mssql';

let pool = null;

const config = {
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options: {
    encrypt: process.env.SQL_ENCRYPT === 'true',
    trustServerCertificate: process.env.SQL_TRUST_SERVER_CERTIFICATE === 'true',
    enableArithAbort: true,
    connectionTimeout: 30000,
    requestTimeout: 30000,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

/**
 * Get SQL Server connection pool (singleton pattern)
 * Reuses existing connection or creates new one
 */
async function getPool() {
  if (!pool) {
    try {
      pool = await sql.connect(config);
      console.log('SQL Server connection pool created');

      // Handle connection errors
      pool.on('error', (err) => {
        console.error('SQL Server pool error:', err);
        pool = null;
      });
    } catch (error) {
      console.error('Failed to create SQL Server connection pool:', error);
      throw error;
    }
  }
  return pool;
}

/**
 * Execute a SQL query with parameters
 * @param {string} query - SQL query string
 * @param {object} params - Query parameters (key-value pairs)
 * @returns {Promise<object>} Query result
 */
async function query(query, params = {}) {
  try {
    const pool = await getPool();
    const request = pool.request();

    // Add parameters to request
    Object.keys(params).forEach((key) => {
      request.input(key, params[key]);
    });

    const result = await request.query(query);
    return result;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

/**
 * Close the connection pool
 */
async function closePool() {
  if (pool) {
    await pool.close();
    pool = null;
    console.log('SQL Server connection pool closed');
  }
}

export { getPool, query, closePool, sql };
