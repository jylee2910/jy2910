# 수정의 메아리 (crystal-rpg) — 진행 기록

HD-2D 스타일 턴제 RPG 미니 버전. three.js 디오라마 + 도트 빌보드 + 코드 생성 에셋.
이 파일만 읽고 이어서 작업할 수 있도록 유지한다.

## 실행 / 확인
- `crystal-rpg/index.html`을 정적 서버로 연다 (ES 모듈, three@0.170.0 importmap / jsdelivr).
- 에셋 미리보기·PNG 내보내기: `tools/export.html`
- 컨테이너에서는 jsdelivr가 막혀 있음 → 스크래치패드에 `npm i three@0.170.0` 후 playwright로
  `cdn.jsdelivr.net/npm/three@...` 요청을 로컬 node_modules로 route해서 스크린샷 (shot.mjs 참고용 스크립트는 스크래치패드에 있음. 없으면 새로 작성).

## 구조
```
index.html            importmap, #view(캔버스) #ui(DOM UI) #fade
css/style.css
js/art/palette.js     단일 팔레트 (모든 색은 여기 이름으로만 참조)
js/art/sprites.data.js 캐릭터 파츠(머리/몸통/다리/팔/무기/방패), 포즈, 디자인, 몬스터 도트 (데이터)
js/art/icons.data.js  UI 아이콘 도트 (데이터)
js/art/tiles.data.js  타일 텍스처 레시피 (데이터)
js/art/generate.js    데이터 → PixBuf/캔버스 생성기 (시트, 아이콘, 텍스처)
js/art/assets.js      캐시 레지스트리 + overrides.js 외부 PNG 우선 사용
js/art/overrides.js   외부 스프라이트 시트 등록 지점
js/gfx/stage.js       렌더러, 블룸, 틸트시프트, 그레이딩/비네트, 흔들림, 플래시
js/gfx/billboard.js   스프라이트 빌보드 (애니메이션, hit 프레임 콜백, 피격 플래시, 그림자)
js/gfx/diorama.js     타일맵 → 디오라마 (인스턴싱), 테마 조명, 부유 입자, 집/가로등/크리스탈, 전투 아레나
tools/export.html     생성 에셋 미리보기/PNG 저장
```

## 단계
- [x] ① 에셋 생성 구조 + 캐릭터 5종/NPC 6종/몬스터 12종/아이콘/타일, 스테이지+빌보드+디오라마 (스크린샷 확인 완료)
- [ ] ② 전투 + 어빌리티 시스템
- [ ] ③ 마을 / 월드맵 / 던전 / 퀘스트
- [ ] ④ UI 다듬기 · 밸런스 · Artifact 게시

## 메모
- 캐릭터 시트: 32x32 프레임, 행 순서 idle/walk/attack/cast/hurt/guard/victory/ko. 무기 종류별로 공격 모션(slash/thrust)이 달라 시트는 (캐릭터, 무기타입, 틴트)별 캐시.
- 캐릭터 원본은 왼쪽을, 몬스터 원본은 오른쪽을 바라봄. Billboard.flipped로 반전.
