import {localPool} from './store.mjs';
import {migrate} from './migrate.mjs';
const db=localPool();
try {
  const pending=await migrate(db);
  console.log(pending.length ? 'Applied: '+pending.join(', ') : 'Database is current.');
} finally { await db.end(); }
