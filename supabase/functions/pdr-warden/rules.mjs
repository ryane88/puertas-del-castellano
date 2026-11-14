// Cairn SECOND EDITION subset. Custom backgrounds are explicitly original to PDR.
export function die(sides, random = Math.random) {
  if (!Number.isInteger(sides) || sides < 2 || sides > 100) throw Error('Invalid die');
  return 1 + Math.floor(random() * sides);
}
export function save(attribute, random) {
  const roll = die(20, random);
  return { roll, target: attribute, success: roll === 1 || (roll !== 20 && roll <= attribute) };
}
export function damage(pc, amount, random) {
  const net = Math.max(0, amount - pc.armor), oldHP = pc.hp;
  pc.hp = Math.max(0, oldHP - net);
  const overflow = Math.max(0, net - oldHP);
  pc.str = Math.max(0, pc.str - overflow);
  const critical = overflow > 0 && pc.str > 0 ? save(pc.str, random) : null;
  if (pc.str === 0) pc.condition = 'muerto';
  else if (critical && !critical.success) pc.condition = 'daño crítico';
  return { net, overflow, critical, scarRequired: net > 0 && net === oldHP };
}
export const slots = pc => pc.inventory.reduce((n, i) => n + i.slots, 0);
export function addItem(pc, item) {
  if (slots(pc) + item.slots > 10) throw Error('Inventario lleno');
  pc.inventory.push(item);
  if (slots(pc) === 10) pc.hp = 0;
}
export function characters(random = Math.random) {
  const roll = n => die(n, random), stat = () => roll(6) + roll(6) + roll(6);
  return ['Guía de ribera', 'Aprendiz de herbolaria'].map((background, i) => {
    const hp = roll(6);
    return { id: i, name: ['Olmo', 'Bruna'][i], background, backgroundSource: 'PDR original, compatible con Cairn 2e',
      str: stat(), dex: stat(), wil: stat(), hp, maxHp: hp, armor: 0, age: roll(20) + roll(20) + 10,
      gold: roll(6), condition: 'bien', deprived: false,
      trait: ['Habla despacio y observa las corrientes.', 'Nunca deja una pregunta sin hacer.'][roll(2)-1],
      bond: 'Una amistad en Bartermoot espera nuestro regreso.',
      inventory: [{name:'Mochila',slots:0},{name:'Daga (d6)',slots:1},{name:'Raciones',slots:1,uses:roll(3)},
        {name:'Antorcha',slots:1,uses:3},{name:i===0?'Cuerda (25 pies)':'Guantes de trabajo',slots:i===0?1:0}]
    };
  });
}
