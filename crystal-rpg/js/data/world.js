// 월드맵: 노드(타일 좌표) + 경로. 경로를 지날 때 enc 테이블에서 chance 확률로 전투
export const WORLD = {
  size: [30, 22],
  nodes: {
    town: { name: '엘름 마을', x: 6, y: 14, kind: 'town', enter: 'town', desc: '수호 수정이 있는 작은 마을. 상점·여관·길드가 있다.' },
    hill: { name: '바람의 언덕', x: 14, y: 11, kind: 'hill', desc: '세 갈래 길이 만나는 언덕. 풍차가 느긋하게 돈다.' },
    forest: { name: '이끼 숲', x: 23, y: 14, kind: 'forest', enter: 'forest', desc: '오래된 고목이 지키는 깊은 숲. 가장 안쪽에 파수꾼이 있다.' },
    cave: { name: '수정 동굴', x: 17, y: 4, kind: 'cave', enter: 'cave', lock: 'forestBoss', lockText: '동굴 입구를 수정 덩굴이 막고 있다… (이끼 숲의 파수꾼을 먼저 진정시키자)', desc: '빛나는 수정이 가득한 동굴. 가장 깊은 곳에 용이 잠들어 있다.' },
  },
  routes: [
    { a: 'town', b: 'hill', enc: 'plains', chance: 0.55 },
    { a: 'hill', b: 'forest', enc: 'hills', chance: 0.6 },
    { a: 'hill', b: 'cave', enc: 'cavePath', chance: 0.6 },
  ],
};
