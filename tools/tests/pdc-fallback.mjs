import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const path=process.argv[2] || new URL('../../src/passages/castle.twee',import.meta.url);
const source=await readFile(path,'utf8');
const passage=source.split(':: SalaPoemas\n')[1].split(':: TavernRoom')[0];
const script=passage.split('<<run (async function () {')[1].split('})()>>')[0];
assert.equal(passage.match(/async function \(\)/g).length,1,'single poem loader');
const poem=id=>({id,titulo:'Poema '+id,poema:'Versos '+id,enfoque:'Tema',explicacion:'Explicación'});
async function run(mode,random=.99){
 const calls=[],view={},doc={};let leave;
 const $=selector=>selector===doc?{one:(event,fn)=>leave=fn}:{text:value=>view[selector]=value,attr:(name,value)=>view[selector+'.'+name]=value};
 await vm.runInNewContext('(async function(){'+script+'})()',{
  $,document:doc,Intl,Date,AbortController,AbortSignal,Math:Object.assign(Object.create(Math),{random:()=>random}),
  setup:{supabase:{url:'https://fixture.example',key:'public-fixture'}},console:{error(){}},
  fetch:async(url,options)=>{
   calls.push(url);assert.equal(options.headers.apikey,'public-fixture');
   const q=new URL(url).searchParams;assert.equal(q.get('publicado'),'eq.true');
   if(mode==='failure')return Response.json({}, {status:503});
   if(mode==='leave'){leave();return Response.json([poem(1)]);}
   if(q.has('fecha_publicacion'))return Response.json(mode==='daily'?[poem(18)]:[]);
   if(mode==='empty')return Response.json([]);
   if(mode==='paged')return Response.json(q.get('offset')==='0'?Array.from({length:250},(_,i)=>poem(i+1)):[poem(251)]);
   return Response.json([poem(1),poem(2),poem(3)]);
  }
 });
 return {calls,view};
}
let r=await run('daily');assert.equal(r.calls.length,1);assert.equal(r.view['#poema-title'],'Poema 18');assert.equal(r.view['#poema-image.src'],'images/poema-4.jpg');
r=await run('random');assert.equal(r.calls.length,2);assert.equal(r.view['#poema-title'],'Poema 3');assert.equal(r.view['#poema-verses'],'Versos 3');assert.equal(r.view['#poema-status'],undefined);
r=await run('random',0);assert.equal(r.view['#poema-title'],'Poema 1');
r=await run('empty');assert.match(r.view['#poema-title'],/no hay poemas/);
r=await run('failure');assert.equal(r.calls.length,1);assert.match(r.view['#poema-status'],/No se pudo/);
r=await run('leave');assert.deepEqual(r.view,{});
r=await run('paged',.9999);assert.equal(r.calls.length,3);assert.equal(r.view['#poema-title'],'Poema 251');
console.log('PASS: today-first, random fallback, text/image agreement, empty catalogue, request failure, passage cancellation, pagination, single loader.');
