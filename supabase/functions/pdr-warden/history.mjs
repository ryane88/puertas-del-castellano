import {context} from './engine.mjs';
const encoder=new TextEncoder();

export function knownContext(state,world){
  const known=context(state,world);
  // Only previously visible replies and actual player input; no hidden world rows.
  known.conversation=state.log.filter(entry=>typeof entry.reply==='string').slice(-6)
    .map(entry=>({player:entry.player||'',reply:entry.reply}));
  known.recent=known.recent.filter(Boolean);
  return known;
}
export function finishExchange(state,event,player,reply,action){
  state.wardenNarration=reply;
  if(!state.log.length||state.log.at(-1).action!==action){
    state.log.push({action,text:event.text,turn:state.turns,dice:event.dice||[]});
  }
  const entry=state.log.at(-1);
  Object.assign(entry,{player,reply,kind:event.kind||'event'});
  state.log=state.log.slice(-12);
  // Keep signed requests within the existing 50KB token/60KB body limits.
  while(state.log.length>1&&encoder.encode(JSON.stringify(state.log)).byteLength>12000)state.log.shift();
  return state;
}
