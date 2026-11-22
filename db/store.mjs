import pg from 'pg';

// These credentials belong to the disposable loopback-only Docker development instance.
export function localPool(database = 'assessment') {
  return new pg.Pool({
    host: '127.0.0.1', port: 55432, database,
    user: 'exam_owner', password: 'local_exam_only', ssl: false,
    connectionTimeoutMillis: 5000
  });
}

export async function withStudent(pool, student, write, work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE exam_runtime');
    await client.query('SET LOCAL search_path = exam, pg_catalog');
    await client.query("SELECT set_config('exam.student', $1, true)", [student]);
    // Serialize starts, answer saves and submissions for a learner across API instances.
    if (write) await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [student]);
    const response = await work(client);
    await client.query('COMMIT');
    return response;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
