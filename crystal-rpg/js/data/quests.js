// 퀘스트 데이터. type: 'kill'(target 처치 count회) | 'collect'(item count개) | 'flag'(flag가 켜지면 완료)
// requires: 선행 퀘스트 id (완료 보고 후 수주 가능)
export const QUESTS = {
  forest: { name: '숲의 주인', giver: '촌장 오르반', main: true, type: 'flag', flag: 'forestBoss',
    desc: '마을의 수정이 흐려진 뒤로 이끼 숲이 거칠어졌다. 숲 깊은 곳의 "고목의 파수꾼"을 진정시키자.',
    reward: { gold: 300, items: { hiPotion: 2 } } },
  slimes: { name: '슬라임 퇴치', giver: '길드 접수원 미아', type: 'kill', target: 'slime', count: 5,
    desc: '마을 주변 초원에 풀잎 슬라임이 늘었다. 5마리를 퇴치하자.',
    reward: { gold: 120, items: { potion: 3, apprenticeRod: 1 } } },
  herbs: { name: '달빛 약초', giver: '약사 린', type: 'collect', item: 'moonHerb', count: 3, consume: true,
    desc: '이끼 숲에서 자라는 달빛 약초 3개를 가져다 주자. 독버섯 무리가 지니고 있기도 하다.',
    reward: { gold: 150, items: { lightStaff: 1, ether: 2 } } },
  wolves: { name: '늑대 사냥', giver: '길드 접수원 미아', type: 'kill', target: 'wolf', count: 4, requires: 'slimes',
    desc: '숲 늑대가 가축을 노린다. 4마리를 쫓아내자.',
    reward: { gold: 200, items: { galeSpear: 1 } } },
  shards: { name: '수정 조각 모으기', giver: '상인 톰', type: 'collect', item: 'crystalShard', count: 3, consume: true, requires: 'forest',
    desc: '수정 동굴의 박쥐와 골렘이 지닌 수정 조각 3개를 모아 오자. 대장간에서 좋은 것을 만들어 준다고 한다.',
    reward: { gold: 100, items: { flameTongue: 1, frostBlade: 1 } } },
  dragon: { name: '수정의 메아리', giver: '촌장 오르반', main: true, type: 'flag', flag: 'dragonBoss', requires: 'forest',
    desc: '수정 동굴 가장 깊은 곳, 수정을 삼킨 용 "아스테리온"을 쓰러뜨리고 마을의 수정을 되찾자.',
    reward: {} },
};
for (const [id, q] of Object.entries(QUESTS)) q.id = id;
