import { randomUUID } from 'node:crypto';
import { migrate } from '../db/migrate.mjs';
import { localPool } from '../db/store.mjs';

// A fresh test database keeps the developer's running sandbox intact.
export async function testDatabase(t, initialize = true) {
  const admin = localPool();
  const name = 'exam_test_' + randomUUID().replaceAll('-','');
  await admin.query('CREATE DATABASE '+name+' TEMPLATE template0');
  const pool = localPool(name);
  t.after(async () => {
    await pool.end();
    try { await admin.query('DROP DATABASE '+name); }
    finally { await admin.end(); }
  });
  if (initialize) await migrate(pool);
  return pool;
}
