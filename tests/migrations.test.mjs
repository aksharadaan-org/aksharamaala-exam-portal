import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, cp, rm, writeFile, appendFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {testDatabase} from './database.mjs';
import {migrate} from '../db/migrate.mjs';

test('upgrades preserve populated attempts; failed SQL and checksum drift are rejected', async t=>{
  const pool = await testDatabase(t,false);
  const dir = await mkdtemp(join(tmpdir(),'exam-migrations-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  await cp(new URL('../db/migrations/',import.meta.url),dir,{recursive:true});
  const source = pathToFileURL(dir+'/');
  await migrate(pool, source);
  await pool.query("INSERT INTO exam.attempts(id,student,stage) VALUES ('local-draft','demo-a',0)");
  await writeFile(join(dir,'0004_example.sql'),'ALTER TABLE exam.attempts ADD COLUMN note text;');
  assert.deepEqual(await migrate(pool,source),['0004_example.sql']);
  assert.deepEqual(await migrate(pool,source),[]);
  assert.equal((await pool.query("SELECT note FROM exam.attempts WHERE id='local-draft'")).rowCount,1);
  await writeFile(join(dir,'0005_bad.sql'),'CREATE TABLE exam.partial(id int); SELECT 1/0;');
  await assert.rejects(migrate(pool,source),/division by zero/);
  assert.equal((await pool.query("SELECT to_regclass('exam.partial') AS relation")).rows[0].relation,null);
  await appendFile(join(dir,'0004_example.sql'),'\n-- drift');
  await assert.rejects(migrate(pool,source),/history differs/);
});
