// Actual castle/theme, repeated submissions and diary, with isolated mock AI.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {resolve,sep} from 'node:path';
import assert from 'node:assert/strict';
import {createHandler} from '../../supabase/functions/pdr-warden/handler.mjs';
const {chromium}=await import(process.env.PDR_PLAYWRIGHT_PATH?pathToFileURL(process.env.PDR_PLAYWRIGHT_PATH).href:'playwright');
const projectRoot=resolve(fileURLToPath(new URL('../../',import.meta.url)));
const html=await readFile(projectRoot+'/index.html','utf8');
const world={id:'tegny-v1',edition:'cairn-2e',revision:1,license:{},locations:[{id:'bartermoot',description:'Mercado de prueba.'},{id:'old-dam',description:'Presa de prueba.'}],connections:[{from:'bartermoot',to:'old-dam',turns:1},{from:'old-dam',to:'bartermoot',turns:1}],secrets:{bartermoot:{colors:'Colores de prueba.'},'old-dam':{corpse:'Hallazgo de prueba.',boat:'Barca de prueba.',loot:{item:'Objeto de prueba',gold:12}}}};
const origin='http://127.0.0.1:4320',models=[],submitted=[];let fail=false;
const handler=createHandler({PDR_ALLOWED_ORIGINS:origin,PDR_SIGNING_SECRET:'dialogue-browser-secret-at-least-32-characters',SUPABASE_URL:'https://example.test',SUPABASE_SERVICE_ROLE_KEY:'mock-db',OPENAI_API_KEY:'mock-ai'},async(url,req)=>{
  if(url.endsWith('/pdr_load_tegny'))return Response.json(world);
  if(url.endsWith('/reserve_pdr_warden_calls'))return Response.json(true);
  if(fail)return Response.json({}, {status:503});
  const body=JSON.parse(req.body),input=JSON.parse(body.input);models.push(body);
  const value=body.text.format.name==='pdr_intent'?{action:input.text==='miramos aldredador'?'look':'talk'}
    :{text:`Respuesta ${models.length}: `+(input.player||input.event?.text||'Bienvenidos.')};
  return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]});
});
const edge=http.createServer(async(req,res)=>{
  const chunks=[];for await(const c of req)chunks.push(c);const bytes=Buffer.concat(chunks);
  if(bytes.length){const b=JSON.parse(bytes);if(b.text)submitted.push(b.text);}
  const r=await handler(new Request('http://127.0.0.1:4321'+req.url,{method:req.method,headers:req.headers,...(bytes.length?{body:bytes}:{})}));
  res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));
});
const castle=http.createServer(async(req,res)=>{
  try{
    const path=decodeURIComponent(new URL(req.url,origin).pathname);
    if(path==='/'){res.writeHead(200,{'Content-Type':'text/html'});return res.end(html);}
    const root=projectRoot+'/images',file=resolve(root,path.replace(/^\/images\//,''));
    if(!path.startsWith('/images/')||!file.startsWith(root+sep))throw Error();
    const bytes=await readFile(file);res.writeHead(200,{'Content-Type':'image/'+(file.endsWith('.png')?'png':'jpeg')});res.end(bytes);
  }catch{res.writeHead(404);res.end();}
});
let browser;
try{
  await new Promise(r=>edge.listen(4321,'127.0.0.1',r));await new Promise(r=>castle.listen(4320,'127.0.0.1',r));
  browser=await chromium.launch({headless:true,executablePath:process.env.PDR_CHROME_PATH});
  const page=await browser.newPage({colorScheme:'dark',viewport:{width:1100,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);await page.locator('#castle-wall').waitFor();
  await page.waitForFunction(()=>!/Cargando/.test(document.querySelector('#data-status')?.textContent||''));
  await page.evaluate(()=>{SugarCube.setup.pdrConfig.endpoint='http://127.0.0.1:4321/functions/v1/pdr-warden';});
  const enter=async()=>{await page.locator('#castle-wall').waitFor();await page.waitForFunction(()=>!/Cargando/.test(document.querySelector('#data-status')?.textContent||''));await page.keyboard.press('r');await page.locator('#enter-door').click();};
  await enter();await page.getByRole('button',{name:'Generar dos viajeros y comenzar'}).click();
  const field=page.locator('.pdr-action-input');await field.waitFor();
  function luminance(color){const rgb=color.match(/[\d.]+/g).slice(0,3).map(Number).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;});return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];}
  async function contrast(label){
    const s=await field.evaluate(e=>{const c=getComputedStyle(e),p=getComputedStyle(e,'::placeholder');return {color:c.color,fill:c.webkitTextFillColor,background:c.backgroundColor,scheme:c.colorScheme,opacity:c.opacity,placeholder:p.color};});
    const ratio=color=>{const a=luminance(color),b=luminance(s.background);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
    assert.ok(ratio(s.color)>=4.5,label+' text contrast');assert.ok(ratio(s.fill)>=4.5,label+' WebKit text contrast');
    assert.equal(s.scheme,'light');assert.equal(s.opacity,'1');if(label!=='disabled')assert.ok(ratio(s.placeholder)>=4.5,label+' placeholder contrast');
  }
  await field.fill('Texto legible sin seleccionar');await field.evaluate(e=>e.blur());await contrast('unfocused');
  await field.focus();await contrast('focused');await field.evaluate(e=>e.disabled=true);await contrast('disabled');await field.evaluate(e=>e.disabled=false);
  const say=async(text,enterKey=false)=>{
    const count=submitted.length,expected=submitted.filter(s=>s===text).length+1;await field.fill(text);
    if(enterKey)await field.press('Enter');else await page.getByRole('button',{name:'Proponer acción'}).click();
    await page.waitForFunction(({text,count})=>SugarCube.State.variables.pdr.state.log.filter(e=>e.player===text).length>=count,{text,count:expected});
    await page.waitForFunction(()=>document.querySelector('.pdr')?.getAttribute('aria-busy')==='false');
    assert.equal(submitted.length,count+1);assert.equal(submitted.at(-1),text);
  };
  await say('miramos aldredador');const first=await page.evaluate(()=>SugarCube.State.variables.pdr.state.log.at(-1).reply);
  await say('miramos aldredador',true);const second=await page.evaluate(()=>SugarCube.State.variables.pdr.state.log.at(-1).reply);assert.notEqual(first,second);
  await page.locator('.pdr-journal > summary').click();
  assert.equal(await page.locator('.pdr-journal').getByText('Vosotros: miramos aldredador',{exact:true}).count(),2);
  await page.locator('.pdr-journal').getByText('Guardiana: '+first,{exact:true}).waitFor();
  await page.locator('.pdr-journal').getByText('Guardiana: '+second,{exact:true}).waitFor();
  await say('¿Por qué estamos aquí?');await say('¿Y qué acabas de decirnos?',true);
  const latest=JSON.parse(models.at(-1).input);assert.equal(latest.player,'¿Y qué acabas de decirnos?');
  assert.ok(latest.context.conversation.some(e=>e.player==='¿Por qué estamos aquí?'));
  assert.equal(await page.locator('.pdr-journal').evaluate(e=>e.open),true);
  const saved=await page.evaluate(()=>JSON.stringify(SugarCube.State.variables.pdr.state));
  fail=true;await field.fill('Otra pregunta');await page.getByRole('button',{name:'Proponer acción'}).click();
  await page.getByText('La Guardiana no pudo responder.',{exact:false}).waitFor();
  assert.equal(await field.inputValue(),'Otra pregunta');assert.equal(await page.evaluate(()=>JSON.stringify(SugarCube.State.variables.pdr.state)),saved);
  assert.equal(await page.locator('form [role=status]').count(),1);fail=false;
  await page.getByRole('link',{name:'← Volver al castillo',exact:true}).click();await enter();
  await page.getByRole('button',{name:'Continuar expedición'}).click();await field.waitFor();
  assert.equal(await page.evaluate(()=>JSON.stringify(SugarCube.State.variables.pdr.state)),saved);
  await page.locator('.pdr-journal > summary').click();await field.fill('Texto sin seleccionar');await field.evaluate(e=>e.blur());
  await page.waitForFunction(()=>document.querySelectorAll('.passage').length===1);
  await field.scrollIntoViewIfNeeded();
  await page.screenshot({path:process.env.PDR_QA_DIR?process.env.PDR_QA_DIR+'/pdr-dialogue-desktop.png':'/tmp/pdr-dialogue-desktop.png',animations:'disabled'});
  await page.setViewportSize({width:390,height:844});await contrast('mobile unfocused');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await field.scrollIntoViewIfNeeded();
  await page.screenshot({path:process.env.PDR_QA_DIR?process.env.PDR_QA_DIR+'/pdr-dialogue-mobile.png':'/tmp/pdr-dialogue-mobile.png',animations:'disabled'});assert.deepEqual(errors,[]);
  console.log('Repeated typo phrase via click/Enter, conversational context, actual diary replies/resume, inline errors/save preservation and dark-mode contrast in all input states: PASS');
}finally{await browser?.close();await Promise.all([new Promise(r=>edge.close(r)),new Promise(r=>castle.close(r))]);}
