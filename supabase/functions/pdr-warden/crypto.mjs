// Web Crypto, compatible with the existing Node/HMAC browser-local save format.
const encoder=new TextEncoder();
const encode=bytes=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const decode=value=>Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
const key=secret=>crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
export async function seal(state,secret){
  const payload=encode(encoder.encode(JSON.stringify({owner:'local',state})));
  const signature=await crypto.subtle.sign('HMAC',await key(secret),encoder.encode(payload));
  return payload+'.'+encode(new Uint8Array(signature));
}
export async function unseal(token,secret){
  try{
    if(typeof token!=='string'||token.length>50000)throw Error();
    const [payload,signature,...extra]=token.split('.');
    if(extra.length||!payload||!signature||!/^[\w-]+$/.test(payload)||!/^[\w-]+$/.test(signature))throw Error();
    if(!await crypto.subtle.verify('HMAC',await key(secret),decode(signature),encoder.encode(payload)))throw Error();
    const data=JSON.parse(new TextDecoder().decode(decode(payload))),s=data.state;
    if(data.owner!=='local'||s?.version!==1||s.edition!=='cairn-2e'||s.adventure!=='tegny-v1'||
      !Number.isSafeInteger(s.revision)||s.revision<0||typeof s.nonce!=='string'||!/^[a-f0-9]{32}$/.test(s.nonce))throw Error();
    return s;
  }catch{throw new Error('Este guardado no pertenece a esta Guardiana o está dañado. No se ha modificado.');}
}
export function seedState(state){
  return {...state,nonce:Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('')};
}
export function random(){return crypto.getRandomValues(new Uint32Array(1))[0]/4294967296;}
export async function turnRandom(state,action,secret){
  const hmac=await key(secret),values=await Promise.all(Array.from({length:16},async(_,n)=>{
    const bytes=await crypto.subtle.sign('HMAC',hmac,encoder.encode(`${state.nonce}:${state.revision}:${action}:${n}`));
    return new DataView(bytes).getUint32(0,false)/4294967296;
  }));
  let index=0;return ()=>{if(index>=values.length)throw Error('Dice budget exceeded');return values[index++];};
}
