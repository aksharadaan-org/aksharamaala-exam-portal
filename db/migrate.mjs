import {createHash} from 'node:crypto';
import {readdir, readFile} from 'node:fs/promises';
const defaultDirectory = new URL('./migrations/',import.meta.url);

export async function migrate(pool, directory = defaultDirectory) {
  const files = (await readdir(directory)).filter(n=>n.endsWith('.sql')).sort();
  if (!files.length) throw Error('Migration directory is empty.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('assessment:migrations',0))");
    const version = await client.query('SHOW server_version_num');
    if (Math.floor(Number(version.rows[0].server_version_num)/10000)!==17) throw Error('Expected PostgreSQL 17.');
    await client.query('CREATE TABLE IF NOT EXISTS public.exam_migrations(name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
    const {rows:applied} = await client.query('SELECT name,checksum FROM public.exam_migrations ORDER BY name');
    if(applied.length>files.length) throw Error('Applied migrations are missing in this checkout.');
    const added = [];
    for(const [i,name] of files.entries()){
      if(!/^\d{4}_[a-z0-9_]+\.sql$/.test(name) || +name.slice(0,4)!==i+1) throw Error('Invalid migration sequence at '+name);
      const sql = await readFile(new URL(name,directory),'utf8');
      const hash = createHash('sha256').update(sql).digest('hex');
      if(applied[i]){
        if(applied[i].name!==name || applied[i].checksum!==hash) throw Error('Migration history differs at '+name);
        continue;
      }
      await client.query('SET LOCAL search_path = public');
      await client.query(sql);
      await client.query('INSERT INTO public.exam_migrations(name,checksum) VALUES ($1,$2)',[name,hash]);
      added.push(name);
    }
    await client.query('COMMIT');
    return added;
  } catch(error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
