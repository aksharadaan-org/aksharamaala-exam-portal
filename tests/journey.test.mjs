import test from 'node:test';
import assert from 'node:assert/strict';
import { testDatabase } from './database.mjs';
import { createApi } from '../api/server.mjs';

test('two isolated students, five stages, retried submission and immutable results', async t => {
  const db = await testDatabase(t);
  const api = createApi(db);
  await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await new Promise(resolve=>api.close(resolve));});
  async function request(method,path,body,token,status=200) {
    const response = await fetch('http://127.0.0.1:'+api.address().port+'/v1/'+path,{
      method, headers:{Authorization:'Bearer '+token}, body:JSON.stringify(body)
    });
    assert.equal(response.status,status,method+' '+path);
    return response.json();
  }
  async function login(handle) {
    const {challenge} = await request('POST','challenges',{handle});
    return (await request('POST','sessions',{challenge,code:'246810'})).token;
  }
  const a = await login('demo-a'), b = await login('demo-b');
  assert.equal((await request('GET','qualities',undefined,a)).length,24);
  await request('PUT','selections',{qualities:['d1q1','d2q2']},a);
  await request('POST','attempts',{stage:1},a,409);
  for(let stage=0; stage<=4; stage++) {
    const {id} = await request('POST','attempts',{stage},a);
    const path = 'attempts/'+id;
    await request('GET',path,undefined,b,404);
    const {items} = await request('GET',path,undefined,a);
    assert.equal(items.length,2);
    assert.ok(items.every(q=>!('correct' in q)));
    await request('POST',path+'/submit',{},a,409);
    for(const [index,item] of items.entries())
      await request('PUT',path+'/answers',{question:item.id,choice:index},a);
    const [first,retry] = await Promise.all([request('POST',path+'/submit',{},a),request('POST',path+'/submit',{},a)]);
    assert.deepEqual(first,retry);
    assert.deepEqual(first.scores.map(s=>s.earned),[1,0]);
    assert.deepEqual(await request('POST',path+'/submit',{},a),first);
    await request('PUT',path+'/answers',{question:items[0].id,choice:1},a,409);
  }
  assert.equal((await request('GET','progress',undefined,a)).length,5);
  assert.deepEqual(await request('GET','progress',undefined,b),[]);
});

test('stage windows use inclusive open, exclusive close and submissions survive close', async t => {
  const db=await testDatabase(t);
  let clock='2026-01-01T00:00:00.000Z';
  await db.query('UPDATE exam.stage_windows SET opens_at=$1, closes_at=$2 WHERE stage=0',[clock,'2026-02-01T00:00:00.000Z']);
  const api=createApi(db,()=>clock);
  await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await new Promise(resolve=>api.close(resolve));});
  let token='';
  async function send(method,path,body,status=200) {
    const response=await fetch('http://127.0.0.1:'+api.address().port+'/v1/'+path,{method,headers:{Authorization:'Bearer '+token},body:JSON.stringify(body)});
    assert.equal(response.status,status);
    return response.json();
  }
  const {challenge}=await send('POST','challenges',{handle:'demo-a'});
  token=(await send('POST','sessions',{challenge,code:'246810'})).token;
  assert.equal((await send('GET','stages'))[0].state,'available');
  assert.equal((await send('GET','schools')).length,2);
  const profile={name:'Test learner',grade:'8',school:'lake',locale:'te'};
  await send('PATCH','me',{...profile,grade:'20'},422);
  assert.equal((await send('PATCH','me',profile)).school,'lake');
  await send('PUT','selections',{qualities:['d1q1']});
  const {id}=await send('POST','attempts',{stage:0});
  await send('PUT','attempts/'+id+'/answers',{question:'d1q1-v1',choice:0});
  clock='2026-02-01T00:00:00.000Z';
  assert.equal((await send('GET','stages'))[0].state,'expired');
  await send('POST','attempts/'+id+'/submit',{},409);
  clock='2026-01-31T23:59:59.999Z';
  await send('POST','attempts/'+id+'/submit',{});
  clock='2026-02-01T00:00:00.000Z';
  assert.equal((await send('GET','stages'))[0].state,'submitted');
  await send('POST','attempts/'+id+'/submit',{});
});
