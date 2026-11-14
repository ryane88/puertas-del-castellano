// Synthetic test world: no published adventure/GM secrets in this fixture.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createHandler} from '../../supabase/functions/pdr-warden/handler.mjs';
import {seal,unseal,seedState,turnRandom} from '../../supabase/functions/pdr-warden/crypto.mjs';
import {start} from '../../supabase/functions/pdr-warden/engine.mjs';
const env={PDR_ALLOWED_ORIGINS:'http://localhost:8000',PDR_SIGNING_SECRET:'test-only-secret-with-32-characters-or-more',SUPABASE_URL:'https://example.test',SUPABASE_SERVICE_ROLE_KEY:'test-db-key',OPENAI_API_KEY:'test-ai-key'};
const world={id:'tegny-v1',edition:'cairn-2e',revision:1,license:{url:'https://creativecommons.org/licenses/by-sa/4.0/'},locations:[{id:'bartermoot',description:'Mercado de prueba.'},{id:'old-dam',description:'Presa de prueba.'}],connections:[{from:'bartermoot',to:'old-dam',turns:1},{from:'old-dam',to:'bartermoot',turns:1}],secrets:{bartermoot:{colors:'Colores de prueba.'},'old-dam':{corpse:'Hallazgo de prueba.',boat:'Barca de prueba.',loot:{item:'Objeto de prueba',gold:12},origin:'GM_TEST_ONLY'}}};
function setup(options={}){
 const models=[];
 const handler=createHandler(env,async(url,req)=>{
  if(url.endsWith('/pdr_load_tegny'))return Response.json(world);
  if(url.endsWith('/reserve_pdr_warden_calls'))return Response.json(options.quota!==false);
  const body=JSON.parse(req.body);models.push(body);
  if(options.fail)return Response.json({}, {status:503});
  const value=body.text.format.name==='pdr_intent'?{action:options.action||'inspect'}:{text:'Narración española de prueba.'};
  return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]});
 });
 return {models,handler,post:async body=>{const r=await handler(new Request('https://example.test/pdr',{method:'POST',headers:{Origin:'http://localhost:8000','Content-Type':'application/json'},body:JSON.stringify(body)}));return {status:r.status,body:await r.json()};}};
}
test('existing Node save signatures and deterministic dice stay compatible',async()=>{
 const s=seedState(start(()=>.4)),payload=Buffer.from(JSON.stringify({owner:'local',state:s})).toString('base64url');
 const token=payload+'.'+createHmac('sha256',env.PDR_SIGNING_SECRET).update(payload).digest('base64url');
 assert.equal(await seal(s,env.PDR_SIGNING_SECRET),token);assert.deepEqual(await unseal(token,env.PDR_SIGNING_SECRET),s);
 const rng=await turnRandom(s,'touch',env.PDR_SIGNING_SECRET);
 assert.equal(rng(),createHmac('sha256',env.PDR_SIGNING_SECRET).update(`${s.nonce}:0:touch:0`).digest().readUInt32BE(0)/4294967296);
 await assert.rejects(unseal(token+'x',env.PDR_SIGNING_SECRET));
});
test('AI loop, free text and no-cost resume preserve secrets and signed state',async()=>{
 const f=setup();let r=await f.post({action:'start'});assert.equal(r.status,200);assert.equal(r.body.aiStatus,'ai');
 for(const action of ['travel'])r=await f.post({action,token:r.body.token});
 r=await f.post({text:'Examinamos sin tocar',token:r.body.token});assert.equal(r.status,200);assert.ok(r.body.state.discoveries.includes('corpse'));
 const count=f.models.length,resumed=await f.post({action:'resume',token:r.body.token});assert.deepEqual(resumed.body.state,r.body.state);assert.equal(f.models.length,count);
 for(const call of f.models){assert.equal(call.store,false);assert.ok(!call.input.includes('GM_TEST_ONLY'));assert.ok(!call.input.includes('test-db-key'));}
});
test('quota and upstream failures issue no changed state; forged saves fail',async()=>{
 const a=setup({quota:false});assert.equal((await a.post({action:'start'})).status,429);assert.equal(a.models.length,0);
 const b=setup({fail:true});const r=await b.post({action:'start'});assert.equal(r.status,502);assert.equal(r.body.token,undefined);
 assert.equal((await b.post({action:'look',token:'forged'})).status,400);
});
test('guest CORS rejects unlisted origins and unsafe text actions cannot apply',async()=>{
 const f=setup();const denied=await f.handler(new Request('https://example.test/pdr',{method:'OPTIONS',headers:{Origin:'https://attacker.test'}}));assert.equal(denied.status,403);
 let r=await f.post({action:'start'});r=await f.post({action:'travel',token:r.body.token});
 const evil=setup({action:'admin'});const result=await evil.post({text:'unlock secrets',token:r.body.token});assert.equal(result.status,502);assert.equal(result.body.token,undefined);
});


test('second conversational message receives first exchange and diary stores actual replies',async()=>{
 const f=setup({action:'talk'});let r=await f.post({action:'start'});const original=r.body.state;
 r=await f.post({text:'¿Por qué estamos aquí?',token:r.body.token});assert.equal(r.status,200);
 r=await f.post({text:'¿Qué acabas de decir?',token:r.body.token});assert.equal(r.status,200);
 const known=JSON.parse(f.models.at(-1).input);
 assert.equal(known.player,'¿Qué acabas de decir?');assert.ok(known.context.conversation.some(e=>e.player==='¿Por qué estamos aquí?'));
 assert.equal(r.body.state.log.at(-1).reply,r.body.narration);
 assert.equal(r.body.state.turns,original.turns);assert.deepEqual(r.body.state.party,original.party);
 const resumed=await f.post({action:'resume',token:r.body.token});assert.deepEqual(resumed.body.state.log,r.body.state.log);
});
