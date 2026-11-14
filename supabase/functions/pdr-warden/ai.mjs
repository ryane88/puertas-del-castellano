import {PROMPT,VERSION} from './prompt.mjs';
export async function generate(mode,input,schema,env,fetcher){
  const response=await fetcher('https://api.openai.com/v1/responses',{
    method:'POST',headers:{Authorization:`Bearer ${env.OPENAI_API_KEY}`,'Content-Type':'application/json'},
    signal:AbortSignal.timeout(25000),body:JSON.stringify({
      model:env.PDR_OPENAI_MODEL?.trim()||env.OPENAI_MODEL?.trim()||'gpt-5-nano',
      instructions:PROMPT+`\nVersión: ${VERSION}. Modo: ${mode}.`,
      input:JSON.stringify(input),store:false,max_output_tokens:2048,
      text:{format:{type:'json_schema',name:mode==='INTENCIÓN'?'pdr_intent':'pdr_narration',strict:true,schema}}
    })
  });
  if(!response.ok)throw Error('OpenAI unavailable');
  const data=await response.json();
  if(data.status!=='completed'||!Array.isArray(data.output))throw Error('Incomplete OpenAI response');
  const parts=data.output.filter(x=>x.type==='message').flatMap(x=>x.content||[]);
  if(parts.length!==1||parts[0]?.type!=='output_text'||typeof parts[0].text!=='string')throw Error('OpenAI refused or returned no text');
  return JSON.parse(parts[0].text);
}
export async function intention(text,context,env,fetcher){
  const allowed=[...context.actions.map(a=>a.id),'talk','clarify'];
  const value=await generate('INTENCIÓN',{text,context},{type:'object',additionalProperties:false,
    properties:{action:{type:'string',enum:allowed}},required:['action']},env,fetcher);
  if(!value||Object.keys(value).length!==1||!allowed.includes(value.action))throw Error('Invalid action proposal');
  // Dangerous actions always require the explicit, confirmed UI button.
  return ['touch','amputate'].includes(value.action)?'clarify':value.action;
}
async function prose(mode,input,env,fetcher){
  const value=await generate(mode,input,{type:'object',additionalProperties:false,
    properties:{text:{type:'string'}},required:['text']},env,fetcher);
  if(!value||Object.keys(value).length!==1||typeof value.text!=='string'||!value.text.trim()||
    value.text.length>1800||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value.text))throw Error('Invalid narration');
  return value.text.trim();
}
export function narration(event,known,env,fetcher,player=''){
  return prose('NARRACIÓN',{event,player,context:known},env,fetcher);
}
export function conversation(player,known,clarification,env,fetcher){
  return prose('CONVERSACIÓN',{player,context:known,clarification},env,fetcher);
}
