// Main menu: EQUIPMENT & ECHO, ITEMS, RECORD.
import { ECHOES, HEROES, ITEMS, SKILLS, expForLevel } from '../data/db.js';
import { audio } from '../engine/audio.js';
import { input } from '../engine/input.js';
import { el, icon, portraitURL } from './dom.js';
import { toast } from './dialogue.js';

const STAT_NAMES = [['hp', 'HP'], ['mp', 'MP'], ['atk', '물리 공격력'], ['def', '물리 방어력'], ['mag', '마법 공격력'], ['mdf', '마법 방어력'], ['spd', '속도']];
const LOCKED = 4;

export function openMenu(game, tab = 'equip') {
  return new Promise((resolve) => {
    const st = game.state;
    game.modal = true;
    const root = el('div', 'menu');
    document.getElementById('ui').appendChild(root);
    let ci = 0;
    let tabI = { equip: 0, echo: 0, item: 1, save: 2 }[tab] ?? 0;
    let sel = 0;
    const tabs = ['장비 & 에코', '아이템', '기록'];
    audio.sfx('ok');

    const echoList = () => [...st.echoes.map((id) => ({ id })), ...Array.from({ length: LOCKED }, () => ({ locked: true }))];

    const render = () => {
      const m = st.party[ci];
      const s = m.stats;
      const exp0 = expForLevel(m.level - 1), exp1 = expForLevel(m.level);
      let html = `<div class="mtitle">${tabI === 0 ? 'EQUIPMENT &amp; ECHO' : tabI === 1 ? 'ITEMS' : 'RECORD'}</div>
        <div class="gold">${icon('gil')} ${st.gold.toLocaleString()} G</div>
        <div class="tabs">${tabs.map((t, i) => `<div class="tab${i === tabI ? ' sel' : ''}" data-t="${i}">${t}</div>`).join('')}</div>`;
      if (tabI === 0) {
        const list = echoList();
        sel = Math.min(sel, list.length - 1);
        const cand = list[sel];
        let preview = null;
        if (cand && !cand.locked && cand.id !== m.echo) {
          const saved = m.echo;
          m.echo = cand.id;
          preview = m.stats;
          m.echo = saved;
        }
        const echo = m.echo ? ECHOES[m.echo] : null;
        html += `
        <div class="ch-col">
          <div class="port" style="background-image:url(${portraitURL(m.def.sprite)})"></div>
          <div class="lv">Lv.${m.level} · NEXT ${Math.max(0, exp1 - m.exp)} EXP</div>
          <div class="nmb">${m.name}</div>
          <div class="exp"><div class="bar" style="height:5px"><i class="v" style="width:${(100 * (m.exp - exp0)) / (exp1 - exp0)}%;background:linear-gradient(90deg,#c09020,#ffe070)"></i></div></div>
          <div class="hpmp">
            <div class="row" style="display:flex;justify-content:space-between"><span style="color:var(--hp)">HP</span><span>${m.hp} / ${s.hp}</span></div>
            <div class="bar hp"><i class="v" style="width:${(100 * m.hp) / s.hp}%"></i></div>
            <div class="row" style="display:flex;justify-content:space-between"><span style="color:var(--mp)">MP</span><span>${m.mp} / ${s.mp}</span></div>
            <div class="bar mp"><i class="v" style="width:${(100 * m.mp) / s.mp}%"></i></div>
          </div>
          <div class="switch">◀ ▶ 캐릭터 전환 (${ci + 1}/${st.party.length})</div>
        </div>
        <div class="stats panel">
          <div class="role">ROLE</div><div class="roleval">${m.def.role}${echo ? ` / ${echo.job}` : ''}</div>
          <div class="role">STATUS</div>
          ${STAT_NAMES.map(([k, n]) => {
            const v = s[k], pv = preview ? preview[k] : null;
            const cls = pv == null || pv === v ? '' : pv > v ? 'up' : 'dn';
            return `<div class="st"><span>${n}</span><b class="${cls}">${pv != null && pv !== v ? `${v} → ${pv}` : v}</b></div>`;
          }).join('')}
        </div>
        <div class="equip panel">
          <div class="sect">EQUIPMENT</div>
          <div class="slot"><span class="ty">武</span>${icon('attack')} ${m.def.weapon}</div>
          <div class="slot"><span class="ty">防</span>${icon('guard')} ${m.def.armor}</div>
          <div class="slot"><span class="ty">飾</span>${icon('item')} ${m.def.acc}</div>
          <div class="sect" style="margin-top:12px">ECHO</div>
          <div class="slot echo ${echo ? '' : 'empty'}">${icon('echo')} ${echo ? `${echo.name} <small style="color:var(--sub)">― ${echo.title}</small>` : '미장착'}</div>
          <div class="sect" style="margin-top:12px">ABILITY</div>
          ${m.skills.map((k) => `<div class="skl">${SKILLS[k].name}<span class="mpc">MP ${SKILLS[k].mp}</span></div>`).join('')}
          ${m.echoSkills.map((k) => `<div class="skl" style="color:#d8c4ff">◆ ${SKILLS[k].name}<span class="mpc">MP ${SKILLS[k].mp}</span></div>`).join('')}
          ${echo ? `<div class="skl" style="color:#ffe48a">★ ${echo.resonance.name}<span class="mpc">레조넌스</span></div>` : ''}
        </div>
        <div class="list panel">
          <div class="sect">ECHO LIST</div>
          <div class="cards">${list
            .map((c, i) => {
              if (c.locked) return `<div class="card locked${i === sel ? ' sel' : ''}" data-i="${i}"><div class="cn">???</div><div class="cj">미발견 에코</div></div>`;
              const e = ECHOES[c.id];
              const holder = Object.values(st.members).find((x) => x.echo === c.id);
              return `<div class="card${i === sel ? ' sel' : ''}" data-i="${i}"><div class="cimg" style="background-image:url(${portraitURL(e.portrait)})"></div><div class="cn">${e.name}</div><div class="cj">${e.job}</div><div class="cr">★ ${e.resonance.name}</div>${holder ? `<div class="eq">장착: ${holder.name}</div>` : ''}</div>`;
            })
            .join('')}</div>
        </div>
        <div class="desc panel thin">${cand?.locked ? '아직 공명하지 못한 에코. 세계 각지의 크리스탈에서 만날 수 있다.' : cand ? `${ECHOES[cand.id].title} ${ECHOES[cand.id].name} ― ${ECHOES[cand.id].lore}` : ''}</div>
        <div class="keys"><span class="k">Z</span>장착 / 해제<span class="k">◀▶</span>캐릭터<span class="k">X</span>닫기</div>`;
      } else if (tabI === 1) {
        const items = Object.keys(ITEMS);
        sel = Math.min(sel, items.length - 1);
        html += `<div class="list panel" style="left:30px;right:auto;width:560px">
          <div class="sect">ITEMS</div>
          ${items.map((k, i) => `<div class="cmd-item${i === sel ? ' sel' : ''}" data-i="${i}" style="margin-left:30px"><span class="ic">${icon('item')}</span><span>${ITEMS[k].name}</span><span class="mp">×<b>${st.items[k] || 0}</b></span></div>`).join('')}
        </div>
        <div class="stats panel" style="left:620px;width:420px">
          <div class="role">PARTY</div>
          ${st.party.map((m, i) => `<div class="st" style="${i === ci ? 'color:#fff;background:rgba(80,160,255,.2)' : ''}"><span>${m.name}</span><b>HP ${m.hp}/${m.stats.hp} · MP ${m.mp}/${m.stats.mp}</b></div>`).join('')}
          <div style="margin-top:10px;font-size:12px;color:var(--sub)">◀▶ 대상 선택 · Z 사용</div>
        </div>
        <div class="desc panel thin">${ITEMS[items[sel]].desc}</div>`;
      } else {
        html += `<div class="list panel" style="left:30px;right:auto;width:560px;bottom:auto;height:220px">
          <div class="sect">RECORD</div>
          <div class="cmd-item sel" style="margin-left:30px"><span class="ic">${icon('echo')}</span><span>현재 상태를 기록한다</span></div>
          <p style="font-size:13px;color:var(--sub);margin:16px 30px;line-height:1.7">기록은 이 브라우저에 저장됩니다. 타이틀 화면의 「이어하기」로 불러올 수 있습니다.<br>목표: ${st.objective}</p>
        </div>`;
      }
      root.innerHTML = html;
      root.querySelectorAll('.tab').forEach((t) => (t.onclick = () => ((tabI = +t.dataset.t), (sel = 0), audio.sfx('cursor'), render())));
      root.querySelectorAll('[data-i]').forEach((d) => {
        d.onclick = () => {
          const i = +d.dataset.i;
          if (i === sel) act();
          else {
            sel = i;
            audio.sfx('cursor');
            render();
          }
        };
      });
    };

    const act = () => {
      const m = st.party[ci];
      if (tabI === 0) {
        const c = echoList()[sel];
        if (!c || c.locked) return audio.sfx('buzz');
        if (m.echo === c.id) m.echo = null;
        else st.equipEcho(m.id, c.id);
        audio.sfx('chest');
      } else if (tabI === 1) {
        const k = Object.keys(ITEMS)[sel];
        const it = ITEMS[k];
        if (!st.items[k]) return audio.sfx('buzz');
        const s = m.stats;
        if (it.type === 'heal' && m.hp < s.hp) {
          m.hp = Math.min(s.hp, m.hp + it.amount);
          st.items[k]--;
          audio.sfx('heal');
        } else if (it.type === 'mp' && m.mp < s.mp) {
          m.mp = Math.min(s.mp, m.mp + it.amount);
          st.items[k]--;
          audio.sfx('heal');
        } else audio.sfx('buzz');
      } else {
        const ok = st.save();
        audio.sfx(ok ? 'chest' : 'buzz');
        toast(ok ? '<b>기록했습니다.</b>' : '기록에 실패했습니다.');
      }
      render();
    };

    const off = input.on((a) => {
      const n = tabI === 0 ? echoList().length : tabI === 1 ? Object.keys(ITEMS).length : 1;
      if (a === 'up') sel = (sel - (tabI === 0 ? 2 : 1) + n) % n;
      else if (a === 'down') sel = (sel + (tabI === 0 ? 2 : 1)) % n;
      else if (a === 'left' || a === 'right') {
        if (tabI === 0 && a === 'right' && sel % 2 === 0 && sel + 1 < n) sel++;
        else if (tabI === 0 && a === 'left' && sel % 2 === 1) sel--;
        else ci = (ci + (a === 'left' ? -1 : 1) + st.party.length) % st.party.length;
      } else if (a === 'ok') return act();
      else if (a === 'cancel' || a === 'menu') {
        off();
        audio.sfx('cancel');
        root.remove();
        game.modal = false;
        resolve();
        return;
      } else return;
      audio.sfx('cursor');
      render();
    });
    render();
  });
}
