// 상점: 구매 / 판매. 장비는 파티원별 장착 가능 여부와 능력치 변화를 보여 준다
import { el, win, ListMenu, root, esc, toast, icon } from './ui.js';
import { iconURL, weaponIconURL } from '../art/assets.js';
import { G, addItem, flag } from '../core/state.js';
import { itemInfo } from '../data/items.js';
import { ABILITIES } from '../data/abilities.js';
import { CHARACTERS } from '../data/characters.js';
import { STAT_SHORT } from '../data/elements.js';
import * as P from '../sys/party.js';
import { sfx } from '../core/audio.js';

const STOCK = ['potion', 'ether', 'antidote', 'feather', 'bronzeSword', 'ironSpear', 'oakStaff', 'apprenticeRod', 'ironClaymore', 'knightSword', 'leather', 'mageRobe', 'chainMail', 'powerRing', 'guardCharm'];
const STOCK2 = ['hiPotion', 'stormRod', 'scaleVest', 'silkRobe', 'mithril'];

function iconFor(info) { return info.cat === 'weapon' ? weaponIconURL(info.type, info.tint) : iconURL(info.icon || (info.cat === 'armor' ? 'armor' : 'ring')); }

export function openShop(done) {
  const wrap = el('div', 'shop');
  root().appendChild(wrap);
  const top = win('shop-top', wrap);
  const list = win('shop-list', wrap);
  const detail = win('shop-detail', wrap);
  let menu = null, tab = 0, qty = 1;
  const goldHTML = () => `${icon('gold')} <span class="num">${G.s.gold} G</span>`;

  const close = () => { menu?.destroy(); tabs.destroy(); wrap.remove(); done(); };
  const tabs = new ListMenu(top, [{ label: '구매', data: 0 }, { label: '판매', data: 1 }, { label: '나가기', data: 2 }], {
    columns: 3, cls: 'tabs',
    onSelect: it => { if (it.data === 2) return close(); tab = it.data; render(); tabs.setActive(false); },
    onCancel: close,
  });
  const gold = el('div', 'shop-gold', goldHTML()); top.appendChild(gold);

  function describe(id) {
    const info = itemInfo(id);
    let h = `<div class="abn"><img class="ic" src="${iconFor(info)}"> ${esc(info.name)}</div><div class="abdesc">${esc(info.desc || '')}</div>`;
    if (info.stats) h += `<div class="from">${Object.entries(info.stats).map(([k, v]) => `${STAT_SHORT[k]} ${v > 0 ? '+' : ''}${v}`).join(' · ')}</div>`;
    if (info.cat === 'weapon') h += `<div class="from">어빌리티: ${info.abilities.map(a => `<b>${esc(ABILITIES[a].name)}</b>`).join(', ')}</div>`;
    if (['weapon', 'armor', 'acc'].includes(info.cat)) {
      const slot = P.slotOf(id);
      h += '<div class="who">' + G.s.party.concat(Object.keys(G.s.roster).filter(x => !G.s.party.includes(x))).map(cid => {
        const cs = G.s.roster[cid];
        if (!P.canEquip(cs, id)) return `<span class="w no"><img src="${iconURL('face_' + cid)}">—</span>`;
        const pv = P.previewEquip(cs, id);
        const key = slot === 'weapon' ? (info.type === 'staff' || info.type === 'rod' ? 'mag' : 'atk') : 'def';
        const d = pv.after[key] - pv.before[key];
        return `<span class="w"><img src="${iconURL('face_' + cid)}"><i class="${d > 0 ? 'up' : d < 0 ? 'dn' : ''}">${STAT_SHORT[key]}${d > 0 ? '▲' + d : d < 0 ? '▼' + -d : '='}</i></span>`;
      }).join('') + '</div>';
    }
    h += `<div class="own">보유 ${G.s.inv[id] || 0}</div>`;
    return h;
  }

  function render(focus = 0) {
    menu?.destroy();
    list.innerHTML = '';
    qty = 1;
    const stock = tab === 0 ? [...STOCK, ...(flag('forestBoss') ? STOCK2 : [])] : Object.keys(G.s.inv).filter(k => itemInfo(k).cat !== 'key');
    const price = id => { const info = itemInfo(id); return tab === 0 ? info.price : Math.max(1, Math.floor((info.price || 200) / 2)); };
    const items = stock.map(id => {
      const info = itemInfo(id);
      return { label: esc(info.name), right: `${price(id)} G`, data: id, iconURL: iconFor(info), icon: 'x', disabled: tab === 0 && G.s.gold < price(id), tapFocus: true };
    });
    list.appendChild(el('div', 'wtitle', tab === 0 ? '구매 <small>◀ ▶ 수량</small>' : '판매 <small>◀ ▶ 수량</small>'));
    if (!items.length) list.appendChild(el('div', 'empty', '팔 수 있는 것이 없다'));
    let curId = null;
    const showQty = () => {
      const id = curId; if (!id) return;
      detail.innerHTML = describe(id) + `<div class="qty">수량 <button class="qb">◀</button> <b class="num">${qty}</b> <button class="qb">▶</button> = <span class="num">${qty * price(id)} G</span></div>`;
      const [minus, plus] = detail.querySelectorAll('.qb');
      minus.onclick = e => { e.stopPropagation(); changeQty(-1); }; plus.onclick = e => { e.stopPropagation(); changeQty(1); };
    };
    const maxQty = id => tab === 0 ? Math.max(1, Math.min(99, Math.floor(G.s.gold / price(id)))) : (G.s.inv[id] || 0);
    const changeQty = d => { const id = curId; if (!id) return; qty = Math.max(1, Math.min(maxQty(id), qty + d)); sfx('cursor'); showQty(); };
    menu = new ListMenu(list, items, {
      index: focus,
      onFocus: it => { curId = it.data; qty = 1; showQty(); },
      onLR: changeQty,
      onSelect: it => {
        const id = it.data, cost = price(id) * qty;
        if (tab === 0) {
          if (G.s.gold < cost) { sfx('buzz'); return; }
          G.s.gold -= cost; addItem(id, qty); sfx('coin');
          toast(`${itemInfo(id).name} ×${qty} 구입!`);
        } else {
          if ((G.s.inv[id] || 0) < qty) { sfx('buzz'); return; }
          G.s.gold += cost; addItem(id, -qty); sfx('coin');
          toast(`${itemInfo(id).name} ×${qty} 판매 (+${cost} G)`);
        }
        gold.innerHTML = goldHTML();
        render(Math.min(menu.index, (tab === 1 ? Object.keys(G.s.inv).length : 99) - 1));
      },
      onCancel: () => { menu.destroy(); menu = null; list.innerHTML = ''; detail.innerHTML = ''; tabs.setActive(true); },
    });
    if (!items.length) menu.handler.onKey = k => { if (k === 'cancel') { sfx('cancel'); menu.destroy(); menu = null; tabs.setActive(true); } return true; };
  }
}
