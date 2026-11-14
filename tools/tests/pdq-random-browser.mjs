import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
const root=process.env.PDQ_PROJECT_ROOT || fileURLToPath(new URL('../../',import.meta.url)).replace(/\/$/,'');
const {chromium}=await import(process.env.PDQ_PLAYWRIGHT_PATH || 'playwright');
const html=await readFile(root+'/index.html');
const server=http.createServer((req,res)=>{res.writeHead(req.url==='/'?200:404,{'Content-Type':'text/html'});res.end(req.url==='/'?html:'');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));

const browser=await chromium.launch({timeout:15000,headless:true,executablePath:process.env.PDQ_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try {
 
 const page=await browser.newPage({colorScheme:'dark'}), errors=[], posts=[], catalogs=[];
 page.on('pageerror',e=>errors.push(e.message));
 let mode='normal', failAi=false, delayAi=false, release;
 const old={pdd:408,word:'NO JUZGAR A LA LIGERA',definition:'Escuchar antes de juzgar.'};
 const known={pdd:404,word:'EVOCAR',definition:'Recordar.'};
 const row=(pdd,word)=>({pdd,word,short_definition:'Definición de '+word,description:'Una escena de '+word});
 await page.route('https://piqrpkzahyjkoytdycdg.supabase.co/**',async route=>{
  const u=new URL(route.request().url());
  if(u.pathname.endsWith('/pdq-chat')){
   const b=route.request().postDataJSON();posts.push(b);
   if(delayAi)await new Promise(r=>release=r);
   return route.fulfill({status:failAi?502:200,json:failAi?{error:'fixture'}:{reply:'Reto de '+b.word+' · '+b.stage,advance:b.attempt>0}});
  }
  if(u.pathname.endsWith('/rooms')){
   if(u.searchParams.get('limit')==='1')return route.fulfill({json:[row(408,old.word)]});
   catalogs.push(u.toString());
   if(mode==='error')return route.fulfill({status:503,json:{}});
   if(mode==='empty')return route.fulfill({json:[row(404,'EVOCAR'),row(408,old.word)]});
   const offset=Number(u.searchParams.get('offset'));
   return route.fulfill({json:offset===0?Array.from({length:250},(_,i)=>i%2?row(404,'EVOCAR'):row(900+i,'  evocar  ')):[row(408,old.word),row(409,'CONTEMPLAR'),row(410,''),{pdd:411,word:'SIN DEFINICIÓN'}]});
  }
  return route.fulfill({json:[]});
 });
 
 await page.goto('http://127.0.0.1:'+server.address().port);
 await page.locator('#castle-wall').waitFor();
 await page.waitForFunction(()=>!/Cargando/.test(document.querySelector('#data-status')?.textContent||''));
 await page.waitForFunction(()=>SugarCube.Engine.isIdle());
 const seed=async()=>{
  await page.evaluate(({old,known})=>{
   SugarCube.storage.set('pdq-diplomas',[old,known]);
   SugarCube.State.variables.pdq={vocabulary:old,stage:3,attempts:0,history:[{role:'assistant',content:'¡Completado!'}],stageHistory:[],completed:true};
   SugarCube.Engine.play('PruebasDonQuijote');
  },{old,known});
  await page.locator('.pdq-extra:visible').waitFor({timeout:5000}).catch(async e=>{console.log(await page.locator('body').innerText(),errors);throw e;});
 };
 const idle=()=>page.waitForFunction(()=>!document.querySelector('.pdq-next').disabled);
 await seed();
 mode='error';await page.locator('.pdq-extra').click();await idle();
 assert.equal(await page.evaluate(()=>SugarCube.State.variables.pdq.vocabulary.pdd),408);
 assert.match(await page.locator('.pdq-status').textContent(),/No se pudo/);assert.equal(posts.length,0);
 mode='empty';await page.locator('.pdq-extra').click();await idle();
 assert.match(await page.locator('.pdq-status').textContent(),/todas las palabras/);assert.equal(posts.length,0);
 mode='normal';failAi=true;await page.locator('.pdq-extra').click();await idle();
 assert.equal(await page.evaluate(()=>SugarCube.State.variables.pdq.completed),true);
 assert.equal(await page.locator('.pdq-diploma-word').textContent(),old.word);
 failAi=false;delayAi=true;const before=posts.length;
 await page.locator('.pdq-extra').click();await page.waitForFunction(()=>document.querySelector('.pdq-extra').disabled);
 await page.locator('.pdq-extra').dispatchEvent('click');
 for(let i=0;!release && i<200;i++)await new Promise(r=>setTimeout(r,10));assert.ok(release,JSON.stringify({posts,catalogs,mode,status:await page.locator('.pdq-status').textContent()}));release();delayAi=false;await idle();
 assert.equal(posts.length,before+1);assert.equal(posts.at(-1).pdd,409);
 assert.equal(posts.at(-1).stage,'discover');assert.equal(posts.at(-1).attempt,0);assert.deepEqual(posts.at(-1).history,[]);
 assert.equal(await page.locator('.pdq-extra').isVisible(),false);
 assert.ok(catalogs.some(u=>u.includes('offset=250')),'selection includes later pages');
 for(let stage=0;stage<3;stage++){
  await page.locator('#pdq-message').fill('Mi respuesta');await page.locator('.pdq-answer button').click();await idle();
  if(stage<2){await page.locator('.pdq-next').click();await idle();}
 }
 assert.equal(await page.locator('.pdq-extra').isVisible(),true);
 const diary=await page.evaluate(()=>SugarCube.storage.get('pdq-diplomas'));
 assert.deepEqual(diary.map(d=>d.pdd),[409,408,404]);
 await page.evaluate(()=>SugarCube.Engine.play('Empieza'));
 await page.waitForFunction(()=>SugarCube.State.passage==='Empieza');
 await page.evaluate(()=>SugarCube.Engine.play('PruebasDonQuijote'));
 await page.locator('.pdq-extra:visible').waitFor({timeout:5000}).catch(async e=>{console.log(await page.locator('body').innerText(),errors);throw e;});
 const count=posts.length;await page.locator('.pdq-extra').click();await idle();
 assert.match(await page.locator('.pdq-status').textContent(),/todas las palabras/);assert.equal(posts.length,count);
 // Existing latest-word replay remains available.
 await page.locator('.pdq-next').click();await idle();await page.locator('.pdq-next').click();await idle();
 assert.equal(posts.at(-1).pdd,408);
 assert.equal(await page.locator('.pdq-extra').isVisible(),false);
 assert.deepEqual(errors,[]);
 console.log('PASS: unseen-word filtering by ID and normalized word, pagination, database/AI failure recovery, duplicate-click protection, three-stage completion, diary persistence, reentry, exhaustion, existing daily replay.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
