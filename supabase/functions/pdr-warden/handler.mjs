import {start,resolve,actions} from './engine.mjs';
import {seal,unseal,seedState,random,turnRandom} from './crypto.mjs';
import {intention,narration,conversation} from './ai.mjs';
import {VERSION} from './prompt.mjs';
import {knownContext,finishExchange} from './history.mjs';

export function createHandler(env,fetcher=fetch){
  const origins=new Set((env.PDR_ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(s=>s&&s!=='null'&&s!=='*'));
  return async request=>{
    const origin=request.headers.get('origin');
    const headers=new Headers({'Cache-Control':'no-store',Vary:'Origin','Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff'});
    const json=(status,body)=>new Response(JSON.stringify(body),{status,headers});
    if(!origin||!origins.has(origin))return json(403,{error:'Este origen no está autorizado para PDR.'});
    headers.set('Access-Control-Allow-Origin',origin);
    if(request.method==='OPTIONS'){
      headers.set('Access-Control-Allow-Methods','POST, OPTIONS');
      headers.set('Access-Control-Allow-Headers','content-type, apikey, authorization, x-client-info');
      return new Response(null,{status:204,headers});
    }
    if(request.method!=='POST')return json(405,{error:'Método no permitido.'});
    if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')return json(415,{error:'Se requiere JSON.'});
    let input;
    try{
      const chunks=[],reader=request.body?.getReader();let size=0;
      if(!reader)throw Error();
      for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
        if(size>60000){await reader.cancel();return json(413,{error:'Petición demasiado grande.'});}chunks.push(value);}
      const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
      input=JSON.parse(new TextDecoder().decode(bytes));
    }catch{return json(400,{error:'Petición no válida.'});}
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['token','action','text','confirmed'].includes(k))||
      (input.action!==undefined&&typeof input.action!=='string')||(input.confirmed!==undefined&&typeof input.confirmed!=='boolean')||
      (input.text!==undefined&&(typeof input.text!=='string'||!input.text.trim()||input.text.length>1000||input.action!==undefined))||
      (input.action==='start'&&input.token!==undefined))return json(400,{error:'Petición no válida.'});
    if(!env.PDR_SIGNING_SECRET||env.PDR_SIGNING_SECRET.length<32||!env.SUPABASE_URL)return json(503,{error:'La Guardiana aún no está configurada. Tu guardado se conserva.'});
    let dbKey,isSecret;
    try{const keys=JSON.parse(env.SUPABASE_SECRET_KEYS||'{}');isSecret=!!keys.default;dbKey=keys.default||env.SUPABASE_SERVICE_ROLE_KEY;}
    catch{return json(503,{error:'La Guardiana aún no está configurada.'});}
    if(!dbKey)return json(503,{error:'La Guardiana aún no está configurada.'});
    const dbHeaders={'Content-Type':'application/json',apikey:dbKey,...(!isSecret?{Authorization:`Bearer ${dbKey}`}:{})};
    const rpc=async(name,body={})=>{
      const r=await fetcher(env.SUPABASE_URL+'/rest/v1/rpc/'+name,{method:'POST',headers:dbHeaders,body:JSON.stringify(body),signal:AbortSignal.timeout(8000)});
      if(!r.ok)throw Error('Database unavailable');return r.json();
    };
    const isStart=input.action==='start';let old;
    if(!isStart){try{old=await unseal(input.token,env.PDR_SIGNING_SECRET);}catch(e){return json(400,{error:e.message});}}
    let world;
    try{
      world=await rpc('pdr_load_tegny');
      if(world?.id!=='tegny-v1'||world.edition!=='cairn-2e'||world.revision!==1||!Array.isArray(world.locations))throw Error();
    }catch{return json(503,{error:'No se pudo cargar la aventura. Tu guardado se conserva.'});}
    if(input.action==='resume'){
      const event=old.log.at(-1)||{text:world.locations.find(l=>l.id===old.location)?.description,dice:[],cost:0};
      return json(200,{state:old,token:input.token,actions:actions(old),event,
        narration:old.wardenNarration||event.text,aiStatus:old.wardenNarration?'ai':'legacy',mode:'ai',license:world.license,promptVersion:VERSION});
    }
    if(!env.OPENAI_API_KEY)return json(503,{error:'Falta activar la conexión de OpenAI. Tu guardado se conserva.'});
    let result,state,event,action=input.action,isConversation=false;
    // Reject invalid actions/confirmation BEFORE reserving any paid AI budget.
    if(!isStart&&input.text===undefined){
      try{result=resolve(old,action,world,await turnRandom(old,action,env.PDR_SIGNING_SECRET),input.confirmed===true);}
      catch(e){return json(400,{error:e.message});}
    }
    try{
      const allowed=await rpc('reserve_pdr_warden_calls',{p_calls:input.text!==undefined?2:1});
      if(allowed===false)return json(429,{error:'La Guardiana ha alcanzado el límite de consultas. Inténtalo más tarde; tu guardado se conserva.'});
      if(allowed!==true)throw Error();
    }catch{return json(503,{error:'No se pudo comprobar el límite de consultas. Tu guardado se conserva.'});}
    try{
      if(input.text!==undefined){
        action=await intention(input.text,knownContext(old,world),env,fetcher);
        isConversation=['talk','clarify'].includes(action);
        if(isConversation){
          state=structuredClone(old);state.revision++;
          event={text:'',dice:[],cost:0,kind:'conversation'};
          state.log.push({action,text:'',turn:state.turns,dice:[]});
          result={state,event,changes:{revision:state.revision,location:state.location,turns:state.turns,discoveries:state.discoveries,progress:state.progress}};
        }else{
          try{result=resolve(old,action,world,await turnRandom(old,action,env.PDR_SIGNING_SECRET),false);}
          catch(e){return json(400,{error:e.message});}
        }
      }
      if(isStart){state=seedState(start(random));event={text:world.locations.find(l=>l.id===state.location).description,dice:[],cost:0};}
      else{state=result.state;event=result.event;}
      const known=knownContext(state,world);
      // Only public/revealed scene context enters OpenAI. Never the world/GM rows.
      const reply=isConversation?await conversation(input.text,known,action==='clarify',env,fetcher)
        :await narration(event,known,env,fetcher,input.text||'');
      const player=input.text||(!isStart?actions(old).find(a=>a.id===action)?.label||action:'');
      finishExchange(state,event,player,reply,isStart?'start':action);
      return json(200,{...(result||{}),state,event,token:await seal(state,env.PDR_SIGNING_SECRET),
        narration:state.wardenNarration,actions:actions(state),mode:'ai',aiStatus:'ai',license:world.license,promptVersion:VERSION});
    }catch{
      // No signed state is issued on AI failure: retry the same saved turn safely.
      return json(502,{error:'La Guardiana no pudo responder. Inténtalo de nuevo; tu guardado y los dados del turno se conservan.'});
    }
  };
}
