import test from 'node:test';
import assert from 'node:assert/strict';
import { withStudent } from '../db/store.mjs';
import { testDatabase } from './database.mjs';

test('PostgreSQL 17 enforces isolated rows on the API role without WHERE filters', async t => {
  const db=await testDatabase(t);
  const version=await db.query('SHOW server_version_num');
  assert.equal(Math.floor(Number(version.rows[0].server_version_num)/10000),17);
  await withStudent(db,'demo-a',true,async c=>{
    await c.query("INSERT INTO attempts(id,student,stage) VALUES ('mine','demo-a',0)");
    await c.query("INSERT INTO items VALUES ('mine','d1q1-v1',0)");
  });
  await withStudent(db,'demo-b',false,async c=>{
    assert.deepEqual((await c.query('SELECT id FROM students')).rows,[{id:'demo-b'}]);
    for(const table of ['attempts','items']) assert.equal((await c.query('SELECT * FROM '+table)).rowCount,0);
  });
  await assert.rejects(withStudent(db,'demo-b',true,c=>c.query("INSERT INTO selections VALUES ('demo-a','d1q1')")), {code:'42501'});
});
