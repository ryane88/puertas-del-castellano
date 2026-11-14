// Reuse the existing castle configuration; this room adds no browser API keys.
setup.pdrConfig = Object.assign({ backend: 'edge', creditsUrl: 'PDR-CREDITS.md' }, setup.pdrConfig || {});
/* Browser adapter: stores only PDR data. Never Wikify AI/player text. */
(() => {
  'use strict';
  const KEY='puertas.pdr.tegny.v1';
  let busy=false;
  const storySetup=()=>typeof setup!=='undefined'?setup:window.setup;
  const config=()=>storySetup()?.pdrConfig||{};
  const storyState=()=>typeof State!=='undefined'?State:window.SugarCube?.State;
  const read=()=>{
    if(storyState()?.variables?.pdr)return storyState().variables.pdr;
    try{return JSON.parse(localStorage.getItem(KEY));}catch{return null;}
  };
  const write=value=>{
    if(storyState()?.variables)storyState().variables.pdr=value;
    try{localStorage.setItem(KEY,JSON.stringify(value));return true;}catch{return false;}
  };
  function el(tag,text,parent){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(parent)parent.append(e);return e;}
  function endpoint(){
    const here=window.location;
    const staticPreview=['localhost','127.0.0.1'].includes(here.hostname)&&here.port==='8000';
    const edge=config().backend==='edge';
    const castleUrl=storySetup()?.supabase?.url;
    if(edge&&!config().endpoint&&!castleUrl)throw Error('Falta configurar la dirección de Supabase para la Guardiana.');
    const defaultEndpoint=edge?castleUrl+'/functions/v1/pdr-warden':staticPreview?`http://${here.hostname}:4319/api/pdr`:'/api/pdr';
    let url;
    try{url=new URL(config().endpoint||defaultEndpoint,here.href);}
    catch{throw Error('La dirección de la Guardiana no es válida. Abre el castillo desde http://127.0.0.1:4319/.');}
    if(!['http:','https:'].includes(url.protocol))throw Error('Abre el castillo desde un servidor local, como http://127.0.0.1:4319/, para continuar la expedición.');
    return url.href;
  }
  async function api(input){
    const url=endpoint();
    const access=await config().getAccessToken?.();
    let r;
    try{r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(access?{Authorization:`Bearer ${access}`}:{})},body:JSON.stringify(input)});}
    catch{throw Error(config().backend==='edge'?'No se pudo conectar con la Guardiana en Supabase. Inténtalo de nuevo; tu guardado se conserva.':'No se pudo conectar con la Guardiana. Comprueba que el servidor PDR del puerto 4319 está en marcha. Tu guardado se conserva.');}
    if(!r.headers.get('content-type')?.includes('application/json'))throw Error(config().backend==='edge'?'La Guardiana en Supabase no devolvió datos válidos. Tu guardado se conserva.':'El servidor del castillo no reconoce la petición de PDR. La Guardiana debe estar en marcha en el puerto 4319. Tu guardado se conserva.');
    let data;
    try{data=await r.json();}catch{throw Error('La Guardiana devolvió una respuesta incompleta. Inténtalo de nuevo; tu guardado se conserva.');}
    if(!r.ok)throw Error(data.error||'No se pudo continuar');return data;
  }
  function draw(root,data){
    const journalOpen=root.querySelector('.pdr-journal')?.open||false;
    root.replaceChildren();root.classList.add('pdr');
    el('p','PUERTA DE LOS ROLES · CAIRN 2e',root).className='pdr-eyebrow';
    el('h1',data?.state?.location==='old-dam'?'La presa vieja':'El festín de Tegny',root);
    const status=el('p','',root);status.setAttribute('role','status');
    if(!data){
      el('p','Dos viajeros, una fiesta bajo los árboles y un grito junto al río. Una primera expedición en español.',root);
      el('p','Incluye muerte, enfermedad y horror corporal. Dos trasfondos originales de PDR compatibles con Cairn 2e; no usa tablas de equipo de 1e.',root);
      const saved=read();
      if(saved)button('Continuar expedición',()=>run({action:'resume',token:saved.token}),root);
      button('Generar dos viajeros y comenzar',()=>run({action:'start'}),root);
      credits(root);return;
    }
    const s=data.state;
    el('p',`14 de Sunrise · ${s.turns} turnos de muestra · ${s.progress==='completo'?'Primera expedición completada':'Investigación en curso'}`,root).className='pdr-meta';
    if(data.mode==='scripted'||data.aiStatus==='scripted')el('p','Guardiana de muestra sin IA. Usa las acciones disponibles.',root);
    if(data.mode==='ai'||data.aiStatus==='ai')el('p','Guardiana con IA · Puedes escribir vuestra acción o elegir una opción.',root);
    if(data.aiStatus==='fallback')el('p','La IA no respondió. Se muestra la resolución del motor.',root);
    const cards=el('div',undefined,root);cards.className='pdr-party';
    for(const p of s.party){
      const card=el('section',undefined,cards);el('h2',p.name,card);
      el('p',`${p.background} · ${p.age} años`,card);
      el('p',`PG ${p.hp}/${p.maxHp} · FUE ${p.str} · DES ${p.dex} · VOL ${p.wil} · ${p.gold} monedas · ${p.condition}`,card);
      el('p',p.inventory.map(i=>i.name+(i.uses?` (${i.uses} usos)`:'')).join(' · '),card);
    }
    const story=el('section',undefined,root);story.className='pdr-story';
    el('h2','La Guardiana',story);el('p',data.narration||data.event.text,story);
    if(data.event.kind!=='conversation'&&data.narration&&data.narration!==data.event.text){const d=el('details',undefined,story);el('summary','Resolución y peligros del turno',d);el('p',data.event.text,d);d.open=true;}
    if(data.event.dice?.length)el('p','Dados: '+JSON.stringify(data.event.dice),story);
    if(s.infection)el('p',`Contagio de Olmo: ${s.infection.remaining} turnos hasta la transformación; ${s.infection.cutoff} para extirpar la mano.`,story);
    const controls=el('div',undefined,root);controls.className='pdr-actions';
    for(const a of data.actions)button(a.label,()=>{
      const dangerous=['touch','amputate'].includes(a.id);
      if(dangerous&&!window.confirm(a.label+' ¿Continuar?'))return;
      return run({token:data.token,action:a.id,confirmed:dangerous});
    },controls);
    const form=el('form',undefined,root),label=el('label',data.mode==='ai'?'¿Qué queréis hacer?':'¿Qué queréis hacer? (requiere IA activa)',form);
    const input=el('input',undefined,label);input.type='text';input.className='pdr-action-input';input.maxLength=1000;input.name='pdr-action';input.autocomplete='off';
    const submit=el('button','Proponer acción',form);submit.type='submit';
    form.onsubmit=e=>{e.preventDefault();run({token:data.token,text:input.value});};
    form.append(status);
    const journal=el('details',undefined,root);journal.className='pdr-journal';journal.open=journalOpen;
    el('summary','Diario y presagio',journal);el('p',s.omen,journal);
    s.log.forEach((e,index)=>{
      const entry=el('section',undefined,journal);entry.className='pdr-journal-entry';
      el('p',`Turno ${e.turn}`,entry).className='pdr-meta';
      if(e.player)el('p',`Vosotros: ${e.player}`,entry);
      const reply=e.reply||(index===s.log.length-1?s.wardenNarration:'');
      el('p',reply?`Guardiana: ${reply}`:`Registro anterior: ${e.text}`,entry);
    });
    button('Nueva expedición',()=>{if(window.confirm('¿Reemplazar el guardado de PDR?'))return run({action:'start'});},root);
    credits(root);
    async function run(input){await perform(input);}
    async function perform(input){
      if(busy)return;busy=true;root.setAttribute('aria-busy','true');status.textContent='La Guardiana escucha…';
      root.querySelectorAll('button,input').forEach(e=>e.disabled=true);
      try{const next=await api(input);const saved=write(next);draw(root,next);if(input.text!==undefined)root.querySelector('.pdr-action-input')?.focus({preventScroll:true});if(!saved)el('p','El navegador no pudo guardar. Mantén esta pestaña abierta.',root);}
      catch(e){status.textContent=e.message;root.querySelectorAll('button,input').forEach(e=>e.disabled=false);status.scrollIntoView({block:'nearest'});}
      finally{busy=false;root.setAttribute('aria-busy','false');}
    }
  }
  function button(text,fn,parent){const b=el('button',text,parent);b.type='button';b.onclick=fn;return b;}
  function credits(root){
    const d=el('details',undefined,root);el('summary','Créditos y licencias',d);
    el('p','The Feast of Tegny Wood, Yochai Gal. Edición: Derek B. y Yossi Krausz. Maquetación: Adam Hensley. Arte y mapa: Ari-Matti Toivonen. Cairn 2e: Yochai Gal.',d);
    el('p','Traducción parcial y adaptación interactiva por Puertas del Castellano: inicio fijo, viaje simplificado, dos trasfondos originales y objetivo de informar al mercado. Aventura adaptada y prompt: CC BY-SA 4.0. Sin aval de los autores originales.',d);
    const a=el('a','CC BY-SA 4.0',d);a.href='https://creativecommons.org/licenses/by-sa/4.0/';
    const b=el('a',' · Fuentes y cambios',d);b.href=config().creditsUrl||'/credits';
  }
  window.PDR={mount:root=>draw(root,null)};
  const macros=typeof Macro!=='undefined'?Macro:window.SugarCube?.Macro;
  if(macros)macros.add('pdr',{handler(){const root=document.createElement('div');this.output.appendChild(root);window.PDR.mount(root);}});
  const root=document.getElementById('pdr-root');if(root)window.PDR.mount(root);
})();
