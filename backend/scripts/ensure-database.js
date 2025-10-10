const { Client } = require('pg');

async function ensureDatabase() {
  const host = process.env.DB_HOST || 'localhost';
  const port = Number(process.env.DB_PORT || 5432);
  const user = process.env.DB_USERNAME || 'postgres';
  const password = process.env.DB_PASSWORD || 'postgres';
  const database = process.env.DB_NAME || 'cctv_layout';

  const client = new Client({
    host,
    port,
    user,
    password,
    database: 'postgres'
  });

  await client.connect();

  try {
    const result = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);
    if (result.rowCount === 0) {
      const escapedName = database.replace(/"/g, '""');
      await client.query(`CREATE DATABASE "${escapedName}" ENCODING 'UTF8'`);
      console.log(`[ensure-database] Created database ${database}.`);
    }
  } finally {
    await client.end();
  }
}

ensureDatabase()
  .then(() => {
    console.log('[ensure-database] Database check complete.');
  })
  .catch((error) => {
    console.error('[ensure-database] Failed to ensure database:', error);
    process.exit(1);
  });
