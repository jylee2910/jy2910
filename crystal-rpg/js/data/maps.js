// ─────────────────────────────────────────────────────────────
//  필드 맵 (마을/던전). rows의 문자는 gfx/diorama.js의 TILES 범례.
//  objects: 집/가로등/우물/크리스탈 등 배경 오브젝트
//  npcs: {id, design, x, y, name, face, talk(ctx)}  — talk은 대화 스크립트(ctx API는 scenes/field.js 참고)
//  chests: {id, x, y, item, n}   saves: [{x,y}]   exits: [{x,y,to}]   boss: {x,y,enemy,flag,...}
// ─────────────────────────────────────────────────────────────
import { QUESTS } from './quests.js';

async function questNpc(ctx, qid, lines) {
  const st = ctx.q.state(qid);
  const q = QUESTS[qid];
  if (st === 'none') {
    if (!ctx.q.available(qid)) return false;
    await ctx.say(lines.offer);
    const c = await ctx.ask(['받는다', '나중에']);
    if (c === 0) { ctx.q.accept(qid); await ctx.say(lines.accept || '부탁할게요!'); }
    return true;
  }
  if (st === 'active') { const p = ctx.q.progress(qid); await ctx.say(`${lines.wait || '잘 부탁해요.'}\n(${q.name}: ${p.cur}/${p.max})`); return true; }
  if (st === 'complete') {
    await ctx.say(lines.done);
    const got = ctx.q.turnIn(qid);
    await ctx.say(`보상으로 ${got.join(', ')}을(를) 받았다!`, null);
    return true;
  }
  return false;
}

export const MAPS = {
  town: {
    name: '엘름 마을', theme: 'town', music: 'town',
    rows: [
      'TTTTTTTTTTTTTTTTTTTTTTTT',
      'Tt..hhhh....u.u..hhhh.tT',
      'T,..hhhh.........hhhh..T',
      'T...hhhh..,...,..hhhh.,T',
      'T.....::::::::::::::...T',
      'Tu.f..:....::....:..f.uT',
      'T,.........ss.........,T',
      'T..u...==========...u..T',
      'T.hhh..==========.hhhh.T',
      'T.hhh..==========.hhhh.T',
      'T.hhh..==========.hhhh.T',
      'T......==========......T',
      'T,..:.....::::.....:...T',
      'Tff.:.....ss.......:.ffT',
      'T...:.......:......:...T',
      'T,..::::::::::::::::..,T',
      'T..~~~~.........,..,...T',
      'T.,~~~~........u....,..T',
      'Tt.........:::........tT',
      'TTTTTTTTTT.:::.TTTTTTTTT',
    ],
    heights: [
      '333333333333333333333333',
      '222222222222222222222222',
      '222222222222222222222222',
      '222222222222222222222222',
      '222222222222222222222222',
      '222222222222222222222222',
      '111111111111111111111111',
      '111111111111111111111111',
      '111111111111111111111111',
      '111111111111111111111111',
      '111111111111111111111111',
      '111111111111111111111111',
      '111111111111111111111111',
      '000000000000000000000000',
      '000000000000000000000000',
      '000000000000000000000000',
      '000000000000000000000000',
      '000000000000000000000000',
      '000000000000000000000000',
      '000000000000000000000000',
    ],
    objects: [
      { type: 'house', x: 4, y: 1, w: 4, d: 3, roof: 'roofRed', sign: 0xffc060 },
      { type: 'house', x: 17, y: 1, w: 4, d: 3, roof: 'roofBlue', sign: 0x60c0ff, awning: '#3c70cc' },
      { type: 'house', x: 2, y: 8, w: 3, d: 3, roof: 'roofBlue' },
      { type: 'house', x: 18, y: 8, w: 4, d: 3, roof: 'roofRed', sign: 0xff80c0, awning: '#b4303c' },
      { type: 'bigCrystal', x: 11, y: 8, color: 0x9ab0c8 },
      { type: 'well', x: 8, y: 10 },
      { type: 'lamp', x: 6, y: 7 }, { type: 'lamp', x: 17, y: 7 }, { type: 'lamp', x: 9, y: 4 }, { type: 'lamp', x: 14, y: 4 }, { type: 'lamp', x: 13, y: 14 },
      { type: 'signpost', x: 14, y: 18 },
      { type: 'prop', kind: 'barrel', x: 8, y: 2 }, { type: 'prop', kind: 'barrel', x: 9, y: 1 },
      { type: 'prop', kind: 'crate', x: 15, y: 2, stack: true }, { type: 'prop', kind: 'sack', x: 15, y: 1 },
      { type: 'prop', kind: 'banner', x: 10, y: 6, color: '#3c5c9c' }, { type: 'prop', kind: 'banner', x: 13, y: 6, color: '#3c5c9c' },
      { type: 'prop', kind: 'stall', x: 15, y: 9, color: '#c84a3c' },
      { type: 'prop', kind: 'flowerbed', x: 9, y: 7 }, { type: 'prop', kind: 'flowerbed', x: 14, y: 7 },
      { type: 'prop', kind: 'bench', x: 10, y: 11 },
      { type: 'prop', kind: 'woodpile', x: 1, y: 7 },
      { type: 'prop', kind: 'cart', x: 18, y: 16, rot: 0.4 }, { type: 'prop', kind: 'hay', x: 20, y: 17 },
      { type: 'prop', kind: 'pot', x: 2, y: 4 }, { type: 'prop', kind: 'pot', x: 16, y: 5 },
      { type: 'prop', kind: 'crate', x: 22, y: 11 }, { type: 'prop', kind: 'barrel', x: 22, y: 12 },
    ],
    start: { x: 12, y: 18, dir: 'up' },
    exits: [{ x: 11, y: 19, to: 'world' }, { x: 12, y: 19, to: 'world' }, { x: 13, y: 19, to: 'world' }],
    npcs: [
      { id: 'innkeeper', design: 'innkeeper', name: '여관 주인 베스', x: 8, y: 3, face: 'innkeeper',
        async talk(ctx) {
          await ctx.say('어서 오세요, 「종달새 여관」입니다! 하룻밤 30G예요. 쉬어 가시겠어요?');
          if (await ctx.ask(['묵는다 (30G)', '괜찮다']) === 0) await ctx.inn(30);
          else await ctx.say('언제든 들러 주세요~');
        } },
      { id: 'merchant', design: 'merchant', name: '상인 톰', x: 16, y: 3, face: 'merchant',
        async talk(ctx) {
          if (await questNpc(ctx, 'shards', {
            offer: '수정 동굴에 갔다 온다고? 거기 「수정 조각」을 3개만 모아 줄 수 있나? 대장간 친구가 멋진 검을 벼려 줄 거야.',
            wait: '수정 조각은 동굴 박쥐나 골렘이 지니고 있다더군.',
            done: '오오, 이 투명함! 약속대로 대장간에서 막 나온 검 두 자루일세!',
          })) { if (ctx.q.state('shards') !== 'done') return; }
          await ctx.say('어서 옵쇼! 무기, 방어구, 약까지 다 있습니다요.');
          await ctx.shop();
        } },
      { id: 'elder', design: 'elder', name: '촌장 오르반', x: 5, y: 9, face: 'elder',
        async talk(ctx) {
          const f = ctx.q.state('forest'), d = ctx.q.state('dragon');
          if (f === 'none') {
            await ctx.say(['레온, 세라. 와 주었구나.', '광장의 수호 수정이 빛을 잃은 지 벌써 열흘… 그 뒤로 이끼 숲의 짐승들이 사나워졌다.', '숲 깊은 곳의 「고목의 파수꾼」이 무언가 알고 있을 게다. 부디 숲을 살펴봐 다오.']);
            ctx.q.accept('forest');
            await ctx.say('마을 남쪽 문으로 나가면 들판이다. 경비대장 브란도 힘이 되어 줄 게야. 무기는 톰의 가게에서 갖추거라.');
            return;
          }
          if (f === 'active') { await ctx.say('이끼 숲은 들판 동쪽에 있다. 무리하지 말고, 여관에서 쉬어 가며 가거라.'); return; }
          if (f === 'complete') {
            await ctx.say(['파수꾼을 진정시켰다고…? 그리고 그가 말하길, 수정을 삼킨 용이 동굴에 있다고…', '그렇다면 수호 수정의 빛을 빼앗은 건 그 용이로구나.']);
            const got = ctx.q.turnIn('forest');
            await ctx.say(`보상으로 ${got.join(', ')}을(를) 받았다!`, null);
            ctx.q.accept('dragon');
            await ctx.say('수정 동굴로 가는 길이 열렸다. 용은 수정의 힘을 두르고 있어 쉽게 쓰러지지 않을 게다. 어빌리티를 잘 갖추고 가거라.');
            return;
          }
          if (d === 'active') { await ctx.say('수정 동굴은 바람의 언덕 북쪽이다. 용의 약점을 먼저 간파하는 게 중요할 게야.'); return; }
          await ctx.say('수정이 다시 빛나고 있구나. 너희는 이 마을의 자랑이다.');
        } },
      { id: 'clerk', design: 'clerk', name: '길드 접수원 미아', x: 20, y: 11, face: 'clerk',
        async talk(ctx) {
          if (await questNpc(ctx, 'slimes', {
            offer: '모험가 길드입니다! 초원에 풀잎 슬라임이 늘어서 곤란해요. 5마리 퇴치를 부탁드려도 될까요?',
            wait: '슬라임은 마을 앞 들판에서 자주 보여요.', done: '수고하셨어요! 길드에서 드리는 보수예요.',
          })) return;
          if (await questNpc(ctx, 'wolves', {
            offer: '이번엔 숲 늑대예요. 가축을 노리는 늑대 4마리를 쫓아내 주세요. 보수로 길드 창고의 창을 드릴게요!',
            wait: '숲 늑대는 이끼 숲 근처에 나타나요.', done: '대단해요! 약속한 「폭풍창」이에요. 창을 다루는 분께 드리세요!',
          })) return;
          await ctx.say(['무기에는 저마다 어빌리티가 깃들어 있어요.', '장착하고 싸우면 숙련이 쌓이고, 다 차면 그 어빌리티를 영구히 익히게 되죠.', '익힌 어빌리티는 메뉴의 「어빌리티」에서 코스트 안에서 등록해야 써요. 조합하면 「공명」이 일어나기도 한답니다!']);
        } },
      { id: 'herbalist', design: 'herbalist', name: '약사 린', x: 7, y: 16, face: 'herbalist',
        async talk(ctx) {
          if (await questNpc(ctx, 'herbs', {
            offer: '약을 만들려면 이끼 숲의 「달빛 약초」가 3개 필요한데… 구해다 주시면 신전에서 받은 지팡이를 드릴게요.',
            wait: '달빛 약초는 숲의 보물상자나 독버섯 무리가 가지고 있어요.', done: '고마워요! 이건 「성광의 지팡이」예요. 세라에게 어울릴 거예요.',
          })) return;
          await ctx.say('독에 걸리면 해독초를 쓰세요. 「재생의 기도」로도 풀 수 있어요.');
        } },
      { id: 'kid', design: 'kid', name: '꼬마 피피', x: 12, y: 15, face: 'kid', wander: true,
        async talk(ctx) { await ctx.say(ctx.flag('forestBoss') ? '형아들이 파수꾼을 이겼대! 나도 커서 용기사 될 거야!' : '적한테는 약점이 있대! 방패 숫자가 0이 되면 「브레이크」라서 한동안 못 움직인대!'); } },
      { id: 'bran', design: 'bran', name: '경비대장 브란', x: 10, y: 18, face: 'bran', hideIf: 'joined_bran',
        async talk(ctx) {
          await ctx.say(['레온, 숲으로 간다고 들었다. 혼자 보낼 수는 없지.', '내 방패로 너희를 지키겠다. 함께 가자!']);
          ctx.recruit('bran');
          ctx.flag('joined_bran', true);
          ctx.removeNpc('bran');
        } },
      { id: 'kyle', design: 'kyle', name: '떠돌이 카일', x: 16, y: 11, face: 'kyle', hideIf: 'joined_kyle',
        async talk(ctx) {
          await ctx.say(['…수정이 빛을 잃은 마을이라. 흥미롭군.', '난 검에 마법을 싣는 마검사다. 로드로 익힌 마법을 등록해 두면, 검을 들어도 불꽃을 두를 수 있지.', '용을 쫓는다면 나도 끼워 줘.']);
          ctx.recruit('kyle');
          ctx.flag('joined_kyle', true);
          ctx.removeNpc('kyle');
          await ctx.say('(카일이 동료가 되었다! 메뉴의 「파티」에서 편성을 바꿀 수 있다.)', null);
        } },
      { id: 'rhea', design: 'rhea', name: '용기사 리아', x: 9, y: 12, face: 'rhea', showIf: 'forestBoss', hideIf: 'joined_rhea',
        async talk(ctx) {
          await ctx.say(['파수꾼을 쓰러뜨린 게 너희구나. 나는 리아, 하늘의 창을 잇는 용기사야.', '수정룡 아스테리온… 내 스승을 삼킨 용이야. 이번엔 함께 싸우게 해 줘.']);
          ctx.recruit('rhea');
          ctx.flag('joined_rhea', true);
          ctx.removeNpc('rhea');
          await ctx.say('(리아가 동료가 되었다! 「도약」은 하늘로 뛰어올라 적의 공격을 피한다.)', null);
        } },
    ],
    chests: [
      { id: 't1', x: 2, y: 14, item: 'potion', n: 2 },
      { id: 't2', x: 21, y: 2, item: 'ironSpear', n: 1 },
    ],
    saves: [],
  },

  forest: {
    name: '이끼 숲', theme: 'forest', music: 'dungeon', encounter: 'forest', rate: [14, 26],
    rows: [
      'tttttttttttttttttttttt',
      'ttttttt.,......,.ttttt',
      'tttttt,.........,ttttt',
      'tttttt.....:.....ttttt',
      'ttttttt.u..:..u.tttttt',
      'tttttttttt.s.ttttttttt',
      'ttt,.ttttt.:.ttt.,.ttt',
      'tt...,ttt..:..tt....tt',
      'tt..::::::::::::::..tt',
      'ttt.:ttttttttttttt:ttt',
      'tttts.tttt..ttttts..tt',
      'tt,.::::::::::::::::,t',
      '~~~~~~~~~~~bb~~~~~~~~~',
      'tt...::::::::::::...tt',
      'tt.o.:tttttttttt:.o.tt',
      'ttt..s.tttttttt.s..ttt',
      'tt,..:...,tt....:.,.tt',
      'tttt.::::::::::::.tttt',
      'ttttt.ttttt:tttt.ttttt',
      'tttttttttt.:.ttttttttt',
      'tttttttttt.:.ttttttttt',
      'tttttttttt.:.ttttttttt',
      'tttttttttt.:.ttttttttt',
      'tttttttttt.:.ttttttttt',
    ],
    heights: [
      '4444444444444444444444',
      '3333333333333333333333',
      '3333333333333333333333',
      '3333333333333333333333',
      '3333333333333333333333',
      '2222222222222222222222',
      '2222222222222222222222',
      '2222222222222222222222',
      '2222222222222222222222',
      '2222222222222222222222',
      '1111111111111111111111',
      '1111111111111111111111',
      '1111111111111111111111',
      '1111111111111111111111',
      '1111111111111111111111',
      '0000000000000000000000',
      '0000000000000000000000',
      '0000000000000000000000',
      '0000000000000000000000',
      '0000000000000000000000',
      '0000000000000000000000',
      '0000000000000000000000',
      '0000000000000000000000',
      '0000000000000000000000',
    ],
    objects: [
      { type: 'pointLight', x: 11, y: 3, color: 0xc0ff90, intensity: 5, range: 10, h: 3 },
      { type: 'pointLight', x: 11, y: 12, color: 0x90d0ff, intensity: 3, range: 8, h: 2 },
      { type: 'pointLight', x: 4, y: 7, color: 0xffe0a0, intensity: 2.5, range: 6, h: 2 },
      { type: 'prop', kind: 'pillar', x: 8, y: 3, broken: true }, { type: 'prop', kind: 'pillar', x: 14, y: 3 },
      { type: 'prop', kind: 'woodpile', x: 2, y: 7 }, { type: 'prop', kind: 'stoneFence', x: 7, y: 16 },
    ],
    start: { x: 11, y: 22, dir: 'up' },
    exits: [{ x: 10, y: 23, to: 'world' }, { x: 11, y: 23, to: 'world' }, { x: 12, y: 23, to: 'world' }],
    npcs: [],
    chests: [
      { id: 'f1', x: 3, y: 6, item: 'swiftBoots', n: 1 },
      { id: 'f2', x: 11, y: 10, item: 'moonHerb', n: 1 },
      { id: 'f3', x: 2, y: 16, item: 'potion', n: 3 },
      { id: 'f4', x: 19, y: 16, item: 'moonHerb', n: 1 },
      { id: 'f5', x: 19, y: 7, item: 'ironClaymore', n: 1 },
    ],
    saves: [{ x: 16, y: 7 }],
    boss: { x: 11, y: 2, enemy: 'treant', flag: 'forestBoss', theme: 'forest',
      pre: ['(거대한 고목이 몸을 일으킨다…)', '파수꾼: …수정의… 빛이… 사라졌다… 침입자… 모두… 흙으로…!'],
      post: ['파수꾼: …고맙다, 작은 자들이여. 이제야 정신이 드는구나.', '파수꾼: 수정의 빛을 삼킨 것은 동굴의 용, 아스테리온. 그 용의 기운이 숲을 미치게 했다.', '(마을로 돌아가 촌장에게 알리자. 수정 동굴로 가는 길이 열렸다!)'] },
  },

  cave: {
    name: '수정 동굴', theme: 'cave', music: 'dungeon', encounter: 'cave', rate: [13, 24],
    rows: [
      'RRRRRRRRRRRRRRRRRRRRRR',
      'RRRRRRRAAAAAAAARRRRRRR',
      'RRRRRRAAAAAAAAAARRRRRR',
      'RRRRRRAAAAAAAAAARRRRRR',
      'RRRRRRRAAAAAAAARRRRRRR',
      'RRRRRRRRRRssRRRRRRRRRR',
      'RRRCrrRRRRrrRRRRrrCRRR',
      'RRrrrrrRRRrrRRRrrrrrRR',
      'RRrrxrrrrrrrrrrrrxrrRR',
      'RRRrrRRRRRrrRRRRRrrRRR',
      'RRRrrRRCrrrrrrCRRrrRRR',
      'RRRrrRRrrrrrrrrRRrrRRR',
      'RRCrrrrrrRRRRrrrrrrCRR',
      'RRRRRRRssRRRRssRRRRRRR',
      'RRRRRRRrrrrrrrrRRRRRRR',
      'RRrrrRRRRRrrRRRRRrrrRR',
      'RRrCrrrrrrrrrrrrrrCrRR',
      'RRrrrRRRRRrrRRRRRrrrRR',
      'RRRRRRRRRRrrRRRRRRRRRR',
      'RRRRRRRRRRrrRRRRRRRRRR',
      'RRRRRRRRRRrrRRRRRRRRRR',
    ],
    heights: [
      '2222222222222222222222',
      '2222222222222222222222',
      '2222222222222222222222',
      '2222222222222222222222',
      '2222222222222222222222',
      '1111111111111111111111',
      '1111111111111111111111',
      '1111111111111111111111',
      '1111111111111111111111',
      '1111111111111111111111',
      '1111111111111111111111',
      '1111111111111111111111',
      '1111111111111111111111',
      '0000000000000000000000',
      '0000000000000000000000',
      '0000000000000000000000',
      '0000000000000000000000',
      '0000000000000000000000',
      '0000000000000000000000',
      '0000000000000000000000',
      '0000000000000000000000',
    ],
    objects: [
      { type: 'bigCrystal', x: 7, y: 2, color: 0x7ef0ff }, { type: 'bigCrystal', x: 14, y: 2, color: 0xc080ff },
      { type: 'pointLight', x: 10, y: 14, color: 0x80c0ff, intensity: 4, range: 8, h: 2 },
      { type: 'pointLight', x: 10, y: 8, color: 0xa080ff, intensity: 4, range: 8, h: 2 },
      { type: 'prop', kind: 'pillar', x: 8, y: 3 }, { type: 'prop', kind: 'pillar', x: 13, y: 3 }, { type: 'prop', kind: 'pillar', x: 7, y: 1, broken: true },
    ],
    start: { x: 10, y: 19, dir: 'up' },
    exits: [{ x: 10, y: 20, to: 'world' }, { x: 11, y: 20, to: 'world' }],
    npcs: [],
    chests: [
      { id: 'c1', x: 4, y: 6, item: 'thunderBlade', n: 1 },
      { id: 'c2', x: 17, y: 6, item: 'sageBrooch', n: 1 },
      { id: 'c3', x: 2, y: 15, item: 'holyLance', n: 1 },
      { id: 'c4', x: 19, y: 15, item: 'shadowRod', n: 1 },
      { id: 'c5', x: 3, y: 11, item: 'lifeStaff', n: 1 },
      { id: 'c6', x: 18, y: 11, item: 'hiPotion', n: 3 },
      { id: 'c7', x: 13, y: 14, item: 'feather', n: 2 },
    ],
    saves: [{ x: 16, y: 7 }],
    boss: { x: 11, y: 2, enemy: 'dragon', flag: 'dragonBoss', theme: 'boss', final: true,
      pre: ['(제단 위, 수정으로 빚은 용이 눈을 뜬다.)', '아스테리온: …작은 빛들이 여기까지 왔는가. 이 수정의 빛은 이제 나의 것이다.', '아스테리온: 메아리조차 남지 않도록, 산산이 부숴 주마!'],
      post: [] },
  },
};

// 조우 테이블 (무작위 선택)
export const ENCOUNTERS = {
  plains: [['slime', 'slime'], ['slime', 'rabbit'], ['rabbit', 'rabbit'], ['slime', 'slime', 'rabbit'], ['slime']],
  hills: [['rabbit', 'slime', 'rabbit'], ['wolf'], ['slime', 'wolf'], ['mushroom', 'rabbit']],
  forest: [['mushroom', 'wolf'], ['wolf', 'wolf'], ['mushroom', 'mushroom', 'slime'], ['mushroomP', 'mushroom'], ['wolf', 'mushroomP']],
  cavePath: [['wolf', 'bat'], ['bat', 'bat'], ['mushroomP', 'bat']],
  cave: [['bat', 'bat'], ['wisp', 'bat'], ['slimeIce', 'wisp'], ['golem'], ['bat', 'slimeIce', 'bat'], ['wisp', 'wisp']],
};
