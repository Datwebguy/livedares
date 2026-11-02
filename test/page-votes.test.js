const { test } = require('node:test'); const assert = require('node:assert/strict'); const express = require('express'); const { createStore } = require('../lib/store'); const { createPageVotes } = require('../lib/page-votes'); const { createClientIp } = require('../lib/client-ip'); const { mkdtempSync, rmSync, readFileSync } = require('node:fs'); const { tmpdir } = require('node:os'); const path = require('node:path');
test('HTTP page votes are private, replaceable, persistent and share queue counts with chat', async () => {
 const dir=mkdtempSync(path.join(tmpdir(),'page-votes-')), file=path.join(dir,'db'); let store=createStore(file); let time=100000, broadcasts=0;
 for(const n of ['one','two','three']) store.addChallenge({title:n,description:n,seconds:20,username:n});
 const app=express(), handlers=createPageVotes({store,clientIp:createClientIp({TRUST_PROXY:'1'}),now:()=>time,onChange:()=>broadcasts++});
 app.get('/api/my-vote',handlers.get); app.post('/api/queue/:id/vote',handlers.post); const server=app.listen(0,'127.0.0.1'); await new Promise(r=>server.once('listening',r)); const base=`http://127.0.0.1:${server.address().port}`;
 const req=(address,url,method='POST')=>fetch(base+url,{method,headers:{'x-forwarded-for':address}});
 try { const a='198.51.100.11',b='198.51.100.12';
  assert.equal((await req(a,'/api/queue/no/vote')).status,400); assert.equal((await req(a,'/api/queue/999/vote')).status,404);
  assert.equal((await req(a,'/api/queue/2/vote')).status,200); assert.equal((await req(a,'/api/queue/3/vote')).status,429); time+=1000;
  assert.equal((await req(a,'/api/queue/3/vote')).status,200); assert.equal((await req(b,'/api/queue/3/vote')).status,200);
  assert.equal((await (await req(a,'/api/my-vote','GET')).json()).challengeId,3); assert.deepEqual(store.state().queue.map(q=>q.votes),[0,2]);
  assert.equal(store.vote('page',2),true); assert.deepEqual(store.state().queue.map(q=>q.votes),[0,3]); assert.equal(broadcasts,3);
  const rows=store.db.prepare('SELECT voter FROM votes').all(); assert.equal(rows.length,3); assert.ok(rows.every(r=>!r.voter.includes(a)&&!r.voter.includes(b))); assert.equal(store.myVote(store.pageVoter(a)),3);
  await new Promise(r=>server.close(r)); store.close(); assert.equal(readFileSync(file).includes(Buffer.from(a)),false); store=createStore(file);
  assert.equal(store.myVote(store.pageVoter(a)),3); assert.deepEqual(store.state().queue.map(q=>q.votes),[0,3]);
  store.resolve('fail'); assert.equal(store.startQueued(3),null); assert.equal(store.myVote(store.pageVoter(a)),null); assert.equal(store.db.prepare('SELECT count(*) n FROM votes').get().n,0);
  store.resolve('fail'); assert.equal(store.voteForId(store.pageVoter(b),2),true); assert.equal(store.removeQueued(2),true); assert.equal(store.myVote(store.pageVoter(b)),null);
 } finally { if(server.listening) await new Promise(r=>server.close(r)); store.close(); rmSync(dir,{recursive:true,force:true}); }
});
