import { Battle } from '/home/user/jy2910/crystal-rpg/js/sys/battle.js';
import { newChar, gainExp, gainAP } from '/home/user/jy2910/crystal-rpg/js/sys/party.js';
const [,, lv='1', foes='slime,slime', runs='200'] = process.argv;
let wins=0, turnsT=0, hpLeft=0;
for (let r=0;r<+runs;r++){
  const g = { party:(process.env.P||'leon,sera,bran').split(','), roster:{}, inv:{potion:3}, bestiary:{} };
  for (const id of g.party) g.roster[id]=newChar(id,+lv);
  const b = new Battle(g, foes.split(','));
  let n=0;
  while(!b.over && n<300){ n++;
    const {unit:u, skip, auto} = b.next();
    if (skip) continue;
    if (auto==='land'){ b.autoLand(u); continue; }
    if (u.side==='enemy'){ b.enemyAction(u); continue; }
    // simple AI: heal if someone low, else best damage ability usable
    const low = b.party.find(p=>p.alive && p.hp<p.maxhp*0.4);
    const cmds = b.commandsFor(u).filter(c=>c.usable);
    const heal = cmds.find(c=>c.ab.type==='heal' && c.ab.target!=='allyKO');
    if (low && heal) { b.act(u,{type:'ability',ab:heal.ab,target:low}); continue; }
    const dmg = cmds.filter(c=>c.ab.type==='phys'||c.ab.type==='mag');
    const t = b.foes(u).filter(x=>!x.airborne)[0];
    if (dmg.length && Math.random()<0.5) b.act(u,{type:'ability',ab:dmg[0].ab,target:t}); else b.act(u,{type:'attack',target:t});
  }
  if (b.over==='win'){wins++; hpLeft += b.party.reduce((a,p)=>a+p.hp/p.maxhp,0)/3;}
  turnsT+=b.turn;
}
console.log(`lv${lv} vs ${foes}: win ${(wins/runs*100).toFixed(0)}% avgTurns ${(turnsT/runs).toFixed(1)} avgHP ${(hpLeft/Math.max(1,wins)*100).toFixed(0)}%`);
