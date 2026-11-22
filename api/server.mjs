import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { localPool, withStudent } from '../db/store.mjs';

function fail(status, code) { throw Object.assign(new Error(code), {status}); }
export function createApi(db, now = () => new Date().toISOString()) {
  const challenges = new Map(), sessions = new Map();
  const route = async (method,path,body,token) => {
    const operation = method+' '+path;
    if (operation === 'POST /v1/challenges') {
      if (!['demo-a','demo-b'].includes(body.handle)) fail(422,'unknown_demo_handle');
      const challenge = randomUUID();
      challenges.set(challenge,{student:body.handle,expires:Date.now()+300000});
      return {challenge};
    }
    if (operation === 'POST /v1/sessions') {
      const entry = challenges.get(body.challenge);
      if (!entry || entry.expires < Date.now() || body.code !== '246810') fail(401,'invalid_code');
      challenges.delete(body.challenge);
      const token = randomUUID();
      sessions.set(token,{student:entry.student,expires:Date.now()+3600000});
      return {token};
    }
    const session = sessions.get(token);
    if (!session || session.expires < Date.now()) fail(401,'sign_in');
    const student = session.student;
    if (operation === 'DELETE /v1/session') { sessions.delete(token); return {signedOut:true}; }
    return withStudent(db, student, method !== 'GET', async client => {
      const rows = async (sql,...args) => (await client.query(sql,args)).rows;
      const one = async (sql,...args) => (await rows(sql,...args))[0];
      const run = (sql,...args) => client.query(sql,args);
      const result = id => rows('SELECT quality,earned,possible FROM scores WHERE attempt=$1 ORDER BY quality',id);
      async function stageState(student,stage) {
        const window = await one('SELECT opens_at,closes_at FROM stage_windows WHERE stage=$1',stage);
        const attempt = await one('SELECT id,submitted FROM attempts WHERE student=$1 AND stage=$2',student,stage);
        const time = now();
        let state = 'available';
        if (attempt?.submitted) state = 'submitted';
        else if (time >= window.closes_at.toISOString()) state = 'expired';
        else if (time < window.opens_at.toISOString()) state = 'upcoming';
        else if (stage && !await one('SELECT 1 FROM attempts WHERE student=$1 AND stage=$2 AND submitted IS NOT NULL',student,stage-1)) state = 'locked';
        else if (attempt) state = 'draft';
        return {stage,openAt:window.opens_at.toISOString(),closeAt:window.closes_at.toISOString(),state,attemptId:attempt?.id ?? null};
      }
      async function checkWindow(student,stage) {
        const {state} = await stageState(student,stage);
        if (state === 'expired' || state === 'upcoming') fail(409,'window_closed');
      }
      if (operation === 'GET /v1/me') return one('SELECT * FROM students WHERE id=$1',student);
      if (operation === 'GET /v1/schools') return rows('SELECT id,district FROM schools ORDER BY id');
      if (operation === 'PATCH /v1/me') {
        const {name,grade,school,locale} = body;
        if (Object.keys(body).some(k=>!['name','grade','school','locale'].includes(k))
            || typeof name!=='string' || !name.trim() || name.trim().length>50
            || typeof grade!=='string' || !/^(?:[1-9]|1[0-2])$/.test(grade)
            || typeof school!=='string' || !await one('SELECT id FROM schools WHERE id=$1',school)
            || !['en','te'].includes(locale)) fail(422,'invalid_profile');
        await run('UPDATE students SET name=$1,grade=$2,school=$3,locale=$4 WHERE id=$5',name.trim(),grade,school,locale,student);
        return one('SELECT * FROM students WHERE id=$1',student);
      }
      if (operation === 'GET /v1/stages') {
        const stages = [];
        for (let n=0; n<5; n++) stages.push(await stageState(student,n));
        return stages;
      }
      if (operation === 'GET /v1/qualities') return rows('SELECT q.*, (EXISTS(SELECT 1 FROM selections s WHERE s.quality=q.id AND s.student=$1))::int AS selected FROM qualities q ORDER BY q.id',student);
      if (operation === 'PUT /v1/selections') {
        const ids = body.qualities;
        if (!Array.isArray(ids) || !ids.length || ids.length>24 || ids.some(id=>typeof id!=='string') || (await rows('SELECT id FROM qualities WHERE id=ANY($1::text[])',ids)).length!==new Set(ids).size) fail(422,'invalid_qualities');
        await run('INSERT INTO selections SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING', student, ids);
        return {saved:true};
      }
      if (operation === 'GET /v1/progress') {
        const history = await rows('SELECT id,stage,submitted FROM attempts WHERE student=$1 ORDER BY stage',student);
        for (const attempt of history) attempt.scores = await result(attempt.id);
        return history;
      }
      if (operation === 'POST /v1/attempts') {
        const stage = body.stage;
        if (!Number.isInteger(stage) || stage<0 || stage>4) fail(422,'invalid_stage');
        const existing = await one('SELECT id FROM attempts WHERE student=$1 AND stage=$2',student,stage);
        if (existing) return existing;
        await checkWindow(student,stage);
        if (stage && !await one('SELECT id FROM attempts WHERE student=$1 AND stage=$2 AND submitted IS NOT NULL',student,stage-1)) fail(409,'stage_locked');
        const questions = await rows('SELECT q.id FROM questions q JOIN selections s ON s.quality=q.quality WHERE s.student=$1 ORDER BY q.id',student);
        if (!questions.length) fail(409,'choose_quality');
        const id = randomUUID();
        await run('INSERT INTO attempts(id,student,stage) VALUES ($1,$2,$3)',id,student,stage);
        for(const q of questions) await run('INSERT INTO items VALUES ($1,$2,NULL)',id,q.id);
        return {id};
      }
      const match = path.match(/^\/v1\/attempts\/([\w-]+)(?:\/(answers|submit))?$/);
      if (!match) fail(404,'missing');
      const [,id,action] = match;
      const attempt = await one('SELECT * FROM attempts WHERE id=$1 AND student=$2',id,student);
      if (!attempt) fail(404,'missing');
      if (!action && method === 'GET') return {...attempt,items:await rows('SELECT q.id,q.quality,q.en,q.te,q.options,i.choice FROM questions q JOIN items i ON i.question=q.id WHERE i.attempt=$1 ORDER BY q.id',id) ,scores:await result(id)};
      if (action === 'answers' && method === 'PUT') {
        if (attempt.submitted) fail(409,'closed');
        await checkWindow(student,attempt.stage);
        if (typeof body.question!=='string'||![0,1].includes(body.choice)||!(await run('UPDATE items SET choice=$1 WHERE attempt=$2 AND question=$3',body.choice,id,body.question)).rowCount) fail(422,'invalid_answer');
        return {saved:true};
      }
      if (action === 'submit' && method === 'POST') {
        if (!attempt.submitted) {
          await checkWindow(student,attempt.stage);
          if(await one('SELECT 1 FROM items WHERE attempt=$1 AND choice IS NULL',id)) fail(409,'incomplete');
          await run('INSERT INTO scores SELECT i.attempt,q.quality,COUNT(*) FILTER (WHERE i.choice=q.correct),COUNT(*) FROM items i JOIN questions q ON q.id=i.question WHERE i.attempt=$1 GROUP BY i.attempt,q.quality',id);
          await run('UPDATE attempts SET submitted=CURRENT_TIMESTAMP WHERE id=$1',id);
        }
        return {id,scores:await result(id)};
      }
      fail(404,'missing');
    });
  };
  return http.createServer(async(req,res)=>{
    try {
      let raw = '';
      for await(const chunk of req) { raw += chunk; if(raw.length>8192) fail(413,'too_large'); }
      let body;
      try { body = JSON.parse(raw || '{}'); } catch { fail(400,'invalid_json'); }
      if (!body || typeof body!=='object'||Array.isArray(body)) fail(422,'invalid_body');
      const data = await route(req.method,req.url,body,req.headers.authorization?.replace(/^Bearer /,''));
      res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify(data));
    } catch(error) { res.writeHead(error.status||500,{'Content-Type':'application/json'}).end(JSON.stringify({error:error.status?error.message:'internal'})); }
  });
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)
  createApi(localPool()).listen(4177,'127.0.0.1',()=>console.log('Mock API at http://127.0.0.1:4177/v1'));
