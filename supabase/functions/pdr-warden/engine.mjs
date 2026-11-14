import { characters, die, save, addItem, slots } from './rules.mjs';
export const VERSION = 1;
export function start(random) {
  const party = characters(random);
  return {version:VERSION,adventure:'tegny-v1',edition:'cairn-2e',revision:0,location:'bartermoot',side:'near',party,
    omen: 'El más joven soñó con peces que echaban raíces. Presagio original de PDR.',
    discoveries:[],turns:0,progress:'investigar',log:[],infection:null};
}
export function actions(s) {
  if (s.party.every(p=>p.condition==='muerto')) return [{id:'look',label:'Contemplar el final'}];
  const a = [{id:'look',label:'Observar y preguntar'}, {id:'rest',label:'Descansar y beber agua'}];
  if(s.location==='bartermoot') {
    a.push({id:'colors',label:'Preguntar por los colores'}, {id:'travel',label:'Bajar a la presa'});
    if(s.discoveries.includes('corpse') && s.progress!=='completo') a.push({id:'report',label:'Informar del cadáver y advertir del peligro'});
  } else {
    a.push({id:'travel',label:'Volver a Bartermoot'}, {id:'inspect',label:'Examinar el cadáver sin tocarlo'},
      {id:'boats',label:'Revisar las barcas'}, {id:'cross',label:'Cruzar de uno en uno con cuidado'});
    if(s.discoveries.includes('boat')) a.push({id:'row',label:'Cruzar los dos en la barca intacta'});
    if(s.discoveries.includes('corpse') && !s.discoveries.includes('loot')) a.push({id:'loot',label:'Usar cuerda y guantes para recuperar los bolsillos'});
    if(s.discoveries.includes('corpse') && !s.infection && s.party[0].condition!=='muerto') a.push({id:'touch',label:'Olmo toca el residuo con la mano desnuda (posible muerte; confirmar)'});
  }
  if(s.infection && s.infection.cutoff>0) a.push({id:'amputate',label:'Amputar la mano infectada de Olmo con su daga (pérdida permanente; confirmar)'});
  return a;
}
export function resolve(old, action, world, random, confirmed=false) {
  if(!actions(old).some(a=>a.id===action)) throw Error('Acción no disponible');
  if(['touch','amputate'].includes(action) && !confirmed) throw Error('Confirma el riesgo explícitamente');
  const s=structuredClone(old), dice=[], discovered=id=>{if(!s.discoveries.includes(id))s.discoveries.push(id);};
  let text='',cost=0;
  const loc = world.locations.find(l=>l.id===s.location);
  if(!loc) throw Error('Lugar desconocido');
  switch(action) {
    case 'look': text=loc.description; break;
    case 'colors': text=world.secrets.bartermoot.colors; discovered('colors'); break;
    case 'travel': {
      if(s.location==='old-dam' && s.side!=='near') throw Error('Primero regresa a la orilla del mercado');
      const edge=world.connections.find(c=>c.from===s.location);
      if(!edge) throw Error('Ruta no disponible');
      s.location=edge.to;cost=edge.turns;text=world.locations.find(l=>l.id===edge.to).description;break;
    }
    case 'inspect': text=world.secrets['old-dam'].corpse;discovered('corpse');cost=1;break;
    case 'boats': text=world.secrets['old-dam'].boat;discovered('boat');cost=1;break;
    case 'cross': s.side=s.side==='near'?'far':'near';text='Cruzáis por separado, esperando a que la otra persona termine. La presa resiste. No hace falta tirar dados.';cost=1;break;
    case 'row': s.side=s.side==='near'?'far':'near';text='La barca intacta os lleva a la otra orilla. Remáis sin tocar el cuerpo.';cost=1;break;
    case 'loot': {
      if(!s.party.some(p=>p.inventory.some(i=>i.name.startsWith('Cuerda'))) || !s.party.some(p=>p.inventory.some(i=>i.name==='Guantes de trabajo'))) throw Error('Necesitáis cuerda y guantes');
      const pc=s.party.find(p=>p.condition!=='muerto');
      addItem(pc,{name:world.secrets['old-dam'].loot.item,slots:1});pc.gold+=world.secrets['old-dam'].loot.gold;
      discovered('loot');text='Con cuerda y guantes recuperáis cebo de pesca y 12 monedas sin contacto directo. El cadáver queda junto a la presa.';cost=1;break;
    }
    case 'touch': {
      const result=save(s.party[0].str,random);dice.push({kind:'STR',...result});cost=1;
      if(result.success) text='Olmo resiste la exposición. El residuo sigue siendo peligroso.';
      else {s.infection={remaining:die(6,random),cutoff:die(4,random)};dice.push({kind:'contagio',...s.infection});text='La infección prende en la mano de Olmo. Solo extirparla a tiempo o una cura mágica puede salvarlo. Cada acción que consume tiempo acerca la transformación.';}
      break;
    }
    case 'amputate': s.party[0].condition='mano amputada';s.infection=null;text='La daga separa la mano infectada. Olmo vive y pierde la mano de forma permanente. Esta intervención urgente cierra el peligro de contagio en esta muestra.';cost=1;break;
    case 'rest':
      s.party.filter(p=>p.condition!=='muerto'&&!p.deprived&&slots(p)<10).forEach(p=>p.hp=p.maxHp);
      text='Descansáis y bebéis agua. Recuperáis la Protección contra Golpes; una lesión o infección no se cura así.';cost=1;break;
    case 'report': s.progress='completo';text='Advertís al mercado del cadáver y del riesgo en la presa. Los guardias apartan a los niños del sendero. Habéis terminado esta primera expedición; el misterio del bosque continúa.';break;
  }
  // New exposure starts its countdown AFTER this action, not on the same turn.
  if(s.infection && action!=='touch') {
    s.infection.remaining-=cost;s.infection.cutoff=Math.max(0,s.infection.cutoff-cost);
    if(s.infection.remaining<=0) {s.party[0].condition='muerto';s.infection=null;text+=' Olmo muere y se transforma por el contagio.';}
  }
  s.turns+=cost;s.revision++;s.log=[...s.log,{action,text,turn:s.turns,dice}].slice(-12);
  return {state:s,event:{text,dice,cost},changes:{revision:s.revision,location:s.location,turns:s.turns,discoveries:s.discoveries,progress:s.progress}};
}
export function context(s,world) {
  // No GM rows, encounter tables, undiscovered objects, or arbitrary client history.
  return {edition:s.edition,location:world.locations.find(l=>l.id===s.location),party:s.party,
    turns:s.turns,progress:s.progress,known:s.discoveries,omen:s.omen,
    recent:s.log.slice(-4).map(e=>e.text),actions:actions(s)};
}
