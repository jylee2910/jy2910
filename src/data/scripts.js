// Story scripts for the prologue + Chapter 1 tutorial.
// Each script receives (ev, scene, game).
import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export const SCRIPTS = {
  // ------------------------------------------------------------- prologue
  async prologue(ev, S, G) {
    ev.music('title');
    await ev.narration(['아득한 옛날, 세계는 크리스탈의 빛으로 이어져 있었다.'], 1600);
    await ev.narration(['크리스탈은 영웅들의 기억을 품고,', '그 메아리 ―「에코」를 후세에 전했다.'], 1800);
    await ev.narration(['그리고 지금 ―', '크리스탈의 노래가, 희미해지고 있다.'], 2200);
  },

  // ------------------------------------------------------------- throne room
  async audience(ev, S, G) {
    await ev.fade(1, 10);
    S.camPos.set(0, 2.2, 10.5);
    S.camLook.set(0, 1.6, 2);
    await ev.wait(0.3);
    ev.fade(0, 1500);
    await ev.cam(V(0, 4.2, 12), V(0, 1.4, -6), 3.0);
    await ev.say('근위병', '그란벨 기사단, 비공정 부대장 카엘 님 드셨습니다!');
    ev.close();
    ev.cam(V(0, 3.6, S.daisZ + 11), V(0, 2.0, S.daisZ - 2), 5.4);
    await ev.walk(S.player, 0, S.daisZ + 3.4, 2.4);
    await ev.wait(0.3);
    await ev.say('카엘', '그란벨 기사단 비공정 부대장, 카엘. 부름을 받고 참상했습니다.', 'kael');
    await ev.cam(V(0, 3.4, S.daisZ + 6.5), V(0, 2.8, S.daisZ - 4), 1.2);
    await ev.say('국왕 레이몬드', '오오, 카엘. 먼 길 수고 많았네. 고개를 들게.', 'king');
    await ev.say('국왕 레이몬드', '요즘 들어 평원에 마물이 부쩍 늘었다는 보고가 끊이지 않네.\n게다가… 동쪽 고대 신전의 크리스탈이 빛을 잃어가고 있다는군.', 'king');
    ev.face(S.argen, 'right');
    await ev.cam(V(-1.2, 2.8, S.daisZ + 8.5), V(-1.4, 1.5, S.daisZ + 2.5), 1.0);
    await ev.say('???', '폐하. 신전 근처에서 거대한 날개 그림자를 보았다는 목격담도 있습니다.', 'argen');
    ev.face(S.player, 'left');
    await ev.say('카엘', '아르젠…! 너도 와 있었나.', 'kael', 'surprised');
    await ev.say('아르젠', '…검의 수행이란 가만히 앉아서 하는 게 아니니까.', 'argen');
    ev.face(S.player, 'up');
    ev.face(S.argen, 'up');
    await ev.cam(V(0, 3.4, S.daisZ + 7), V(0, 2.6, S.daisZ - 4), 1.0);
    await ev.say('국왕 레이몬드', '카엘, 그리고 아르젠. 그대들에게 신전 조사를 명하노라.\n크리스탈에 무슨 일이 일어났는지 확인하고 오게.', 'king');
    await ev.say('국왕 레이몬드', '카엘, 그대의 검에는 기사단의 시조 ― 성기사 아스트레아의 「에코」가 깃들어 있지.\n그 힘이 그대를 지켜 줄 걸세.', 'king');
    await ev.say('카엘', '명을 받들겠습니다!', 'kael', 'angry');
    ev.close();
    ev.sfx('chest');
    ev.toast('<b>아르젠</b>이 동료가 되었다!');
    await ev.wait(1.2);
    await ev.fade(1, 1200);
    ev.objective('동쪽의 고대 신전으로 가자');
    G.state.flags.audience = true;
    G.state.fieldPos = [0, -27];
    G.state.save();
    G.gotoField();
  },

  // ------------------------------------------------------------- field: first steps
  async field_start(ev, S, G) {
    ev.flag('field_start');
    await ev.wait(0.6);
    await ev.tutorial([
      {
        en: 'FIELD', title: '필드 이동',
        text: ['<b>방향키 / WASD</b>로 이동, <b>Shift</b>를 누른 채 이동하면 달립니다.', '왼쪽 위에는 현재 <em>목표</em>가, 오른쪽 위에는 <em>미니맵</em>이 표시됩니다. <b>M</b>키로 메뉴를 열 수 있습니다.'],
      },
      {
        en: 'SYMBOL ENCOUNTER', title: '심볼 인카운터',
        text: ['필드를 돌아다니는 마물에 닿으면 전투가 시작됩니다. 길을 막은 마물을 쓰러뜨리며 동쪽 신전으로 향하세요.'],
      },
    ]);
  },

  // ------------------------------------------------------------- imp ambush (tutorial battle 1)
  async imp_ambush(ev, S, G) {
    ev.flag('imp_ambush');
    S.control = false;
    const p = S.player.position;
    const imps = [S.spawnMonster('m_imp', p.x + 4.5, p.z + 1.2), S.spawnMonster('m_imp', p.x + 5.5, p.z - 0.6)];
    ev.sfx('encounter');
    await ev.cam(V(p.x + 1.5, p.y + 6, p.z + 13), V(p.x + 2.5, p.y + 1, p.z), 0.8);
    const ar = S.spawn('argen', p.x - 1.2, p.z + 0.8, 'left.idle');
    ar.setFlip(true);
    await ev.say('아르젠', '마물이다. …임프 두 마리군.', 'argen');
    await ev.say('카엘', '성 바로 앞까지 내려오다니. 해치우자!', 'kael', 'angry');
    ev.close();
    const r = await ev.battle('tut_imps');
    imps.forEach((m) => S.removeActor(m));
    S.removeActor(ar);
    ev.release();
    S.control = true;
    if (r === 'lose') return G.gameOver();
    ev.save();
  },

  // ------------------------------------------------------------- meeting Mira & Nell
  async meet(ev, S, G) {
    ev.flag('meet');
    S.control = false;
    const [mx, mz] = [31, 13.5];
    const mira = S.spawn('mira', mx, mz, 'down.idle');
    const nell = S.spawn('nell', mx + 1.0, mz - 0.4, 'left.idle');
    const wolves = [S.spawnMonster('m_wolf', mx - 3.5, mz + 1.5), S.spawnMonster('m_wolf', mx - 3.2, mz - 1.4), S.spawnMonster('m_imp', mx - 4.6, mz)];
    await ev.cam(V(mx - 1, S.groundAt(mx, mz) + 6, mz + 12), V(mx - 1.5, S.groundAt(mx, mz) + 1, mz), 1.2);
    await ev.say('???', '꺄악! 오, 오지 마!', 'mira', 'surprised');
    await ev.say('???', '미라, 내 뒤로! …칫, 숫자가 너무 많아!', 'nell', 'angry');
    const p = S.player.position;
    const ar = S.spawn('argen', p.x - 1, p.z + 0.6, 'down.idle');
    await ev.cam(V(p.x + 1, p.y + 6, p.z + 12), V(p.x + 2, p.y + 1, p.z - 1), 0.8);
    await ev.say('카엘', '아르젠, 간다!', 'kael', 'angry');
    ev.close();
    await Promise.all([ev.walk(S.player, mx - 2.0, mz - 0.2, 6), ev.walk(ar, mx - 2.4, mz + 1.0, 6)]);
    await ev.say('카엘', '물러서 있어! 여기는 우리가 맡지!', 'kael', 'angry');
    await ev.say('넬', '누군진 몰라도 고마워! 나도 거들게!', 'nell', 'smile');
    ev.close();
    G.state.join('mira');
    G.state.join('nell');
    const r = await ev.battle('wolves');
    wolves.forEach((m) => S.removeActor(m));
    if (r === 'lose') return G.gameOver();
    S.control = false;
    await ev.cam(V(mx - 1.5, S.groundAt(mx, mz) + 4.5, mz + 9), V(mx - 1.2, S.groundAt(mx, mz) + 1.2, mz), 1.0);
    ev.face(mira, 'left');
    await ev.say('미라', '고, 고맙습니다! 저는 미라. 신전의 크리스탈을 보러 가던 수습 백마도사예요.', 'mira', 'smile');
    await ev.say('넬', '난 넬. 떠돌이 기공사야. 이 녀석 호위를 맡았는데… 하마터면 큰일 날 뻔했네.', 'nell');
    await ev.say('카엘', '우리도 신전으로 가는 길이다. 위험하니 함께 가지.', 'kael', 'smile');
    await ev.say('미라', '정말요? 든든해요!', 'mira', 'smile');
    await ev.say('아르젠', '…발목은 잡지 마라.', 'argen');
    await ev.say('넬', '하, 누가 할 소리를!', 'nell', 'angry');
    ev.close();
    ev.sfx('chest');
    ev.toast('<b>미라</b>와 <b>넬</b>이 동료가 되었다!');
    for (const a of [mira, nell, ar]) S.removeActor(a);
    ev.objective('신전의 크리스탈을 조사하자');
    ev.release();
    S.control = true;
    ev.save();
  },

  // ------------------------------------------------------------- shrine: echoes & boss
  async shrine(ev, S, G) {
    ev.flag('shrine');
    S.control = false;
    const [cx, cz] = [38, 33];
    const gy = S.groundAt(cx, cz);
    ev.music('shrine');
    await ev.walk(S.player, cx - 1.2, cz + 3.2, 3);
    ev.face(S.player, 'up');
    const party = [S.spawn('argen', cx - 2.8, cz + 3.8, 'up.idle'), S.spawn('mira', cx + 0.4, cz + 4.0, 'up.idle'), S.spawn('nell', cx + 1.6, cz + 3.4, 'up.idle')];
    await ev.cam(V(cx - 0.5, gy + 4.5, cz + 11), V(cx, gy + 2.2, cz), 1.6);
    await ev.say('미라', '크리스탈이… 울고 있어요.', 'mira', 'sad');
    await ev.say('넬', '빛이 거의 꺼져 가는데? 이게 원래 이런 거야?', 'nell');
    ev.close();
    ev.sfx('resonance');
    S.crystalPulse = 1;
    S.fx.ray(V(cx, gy, cz), { w: 3.6, h: 16, life: 3.0, color: 0xbfe8ff, opacity: 1 });
    await ev.fade(0.85, 600, true);
    await ev.fade(0, 900, true);
    await ev.say('???', '…들리나요, 빛을 잇는 이들이여.', 'echo_saint');
    await ev.say('리리엘', '나는 리리엘. 아득한 옛날, 이 크리스탈에 기도를 바친 자.\n크리스탈의 노래가 끊기려 하고 있어요. 부디… 우리의 힘을.', 'echo_saint');
    await ev.say('볼테르', '흥. 오랜만에 깨어나 보니 꽤 쓸 만한 그릇들이 와 있군.\n좋다, 이 현자의 지혜를 빌려 주마.', 'echo_sage');
    ev.close();
    ev.sfx('chest');
    G.state.gainEcho('liriel');
    G.state.gainEcho('voltaire');
    G.state.equipEcho('mira', 'liriel');
    G.state.equipEcho('nell', 'voltaire');
    ev.toast('에코 <b>리리엘</b>, <b>볼테르</b>를 얻었다!');
    await ev.wait(1.0);
    await ev.tutorial([
      {
        en: 'ECHO', title: '에코 (전설의 영웅)',
        text: [
          '<em>에코</em>는 크리스탈에 깃든 전설 영웅의 메아리입니다. 장착하면 <b>능력치 보너스</b>와 함께 그 영웅의 <b>기술</b>을 쓸 수 있게 됩니다.',
          '전투 중에는 장착한 에코가 캐릭터 뒤에 영체로 나타납니다.',
        ],
      },
      {
        en: 'EQUIP', title: '에코 장착',
        text: [
          '메뉴(<b>M</b>)의 <em>장비 &amp; 에코</em> 화면에서 각 캐릭터에게 에코를 장착할 수 있습니다.',
          '지금은 미라에게 <b>리리엘</b>(회복 마법), 넬에게 <b>볼테르</b>(공격 마법)를 장착해 두었습니다. 직접 바꿔 봐도 좋습니다.',
        ],
      },
    ]);
    await G.openMenu('echo');
    // the boss descends
    ev.stopMusic();
    ev.sfx('encounter');
    S.shakeAmt = 0.6;
    await ev.cam(V(cx - 2, gy + 3.5, cz + 12), V(cx - 1, gy + 5, cz - 2), 1.2);
    const boss = S.spawnMonster('m_wyvern', cx - 1.5, cz - 3.0, true);
    boss.position.y = gy + 14;
    await ev.tween(1.6, (k) => (boss.position.y = gy + 14 * (1 - k * k * (3 - 2 * k))));
    S.shakeAmt = 0.8;
    ev.sfx('bighit');
    await ev.say('아르젠', '온다…! 저게 목격된 날개 그림자인가!', 'argen', 'angry');
    await ev.say('볼테르', '고룡 그림윙… 크리스탈의 빛을 먹어 치우는 마룡이다. 방심하지 마라!', 'echo_sage');
    await ev.say('카엘', '모두, 전투 준비!', 'kael', 'angry');
    ev.close();
    // give a head start on the resonance gauge for the tutorial
    for (const m of G.state.party) m.resonance = Math.max(m.resonance, m.id === 'kael' ? 70 : 40);
    G.state.healAll();
    const r = await ev.battle('boss');
    S.removeActor(boss);
    if (r === 'lose') return G.gameOver('shrine');
    S.control = false;
    ev.music('shrine');
    S.crystalPulse = 2;
    S.fx.ray(V(cx, gy, cz), { w: 5, h: 22, life: 4.0, color: 0xdff6ff, opacity: 1 });
    await ev.fade(1, 500, true);
    await ev.fade(0, 1400, true);
    await ev.cam(V(cx - 0.5, gy + 4.5, cz + 11), V(cx, gy + 2.6, cz), 1.2);
    await ev.say('미라', '크리스탈의 빛이… 돌아왔어요!', 'mira', 'smile');
    await ev.say('리리엘', '고마워요. 노래가 다시 이어졌어요. 하지만 이건 시작에 불과해요.', 'echo_saint');
    await ev.say('볼테르', '세계 곳곳의 크리스탈이 흐려지고 있다. 누군가 의도적으로 「노래」를 끊고 있는 게지.', 'echo_sage');
    await ev.say('카엘', '그렇다면… 우리가 직접 확인하러 가야겠군.', 'kael');
    await ev.say('아르젠', '…어디든 따라가 주지. 검을 휘두를 상대가 있다면.', 'argen');
    await ev.say('넬', '나도! 비공정 부대장이랑 다니면 재밌는 기계도 잔뜩 보겠지?', 'nell', 'smile');
    ev.close();
    party.forEach((a) => S.removeActor(a));
    G.state.flags.chapter1 = true;
    ev.objective('자유롭게 탐색하자 (제1장 클리어)');
    ev.save();
    await G.chapterEnd();
    ev.release();
    S.control = true;
    ev.music('field');
  },
};
