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
js/gfx/fx.js          파티클(픽셀/글로우), 베기 궤적, 원소 마법, 마법진, 순간 조명
js/core/clock.js      씬 시간(히트스톱/슬로모션), wait/tween 프라미스
js/core/input.js      키 매핑 + UI 핸들러 스택 (최상단 모달이 키 소비)
js/core/audio.js      WebAudio 효과음(sfx 이름) + BGM 시퀀서(SONGS)
js/core/state.js      G.s 게임 상태, 아이템/플래그/처치 기록, localStorage 저장(try/catch)
js/data/*.js          elements / abilities(+SYNERGIES) / items / characters / enemies (데이터만 추가하면 확장)
js/sys/party.js       스탯·장비·어빌리티(무기 부여/습득/등록/코스트/공명)·AP·EXP
js/sys/battle.js      전투 모델(CT 턴, 데미지, 약점/실드/BREAK, 반격/수호/도약/마법검, 보스 페이즈) → 이벤트 배열
js/scenes/battle.js   전투 연출(돌진/시전/히트스톱/흔들림/넉백/팝업/브레이크/막타 슬로모션/페이즈 컷신/결과)
js/ui/ui.js           창/ListMenu(손가락 커서)/대화창/선택지/배너/토스트/페이드
js/ui/battleui.js     턴 순서, 파티 상태, 커맨드·어빌리티·아이템 메뉴, 대상 선택(키/탭), 적 약점 태그
js/data/maps.js       마을/이끼 숲/수정 동굴 타일맵, NPC 대화 스크립트(talk(ctx)), 상자, 세이브 수정, 보스, 조우 테이블
js/data/world.js      월드맵 노드/경로/인카운터 확률
js/data/quests.js     퀘스트 (kill/collect/flag), sys/quests.js 진행·보고·보상
js/scenes/title.js    타이틀(새 게임/이어하기), 엔딩, 게임오버
js/scenes/field.js    그리드 이동(키 연속/탭 BFS), 추종 동료, 대화 ctx API, 상자, 세이브 수정(회복+저장), 인카운터, 보스 이벤트, 가림 디더링
js/scenes/world.js    월드맵 디오라마(절차 생성) + 노드 선택 이동 + 경로 인카운터(전투 후 이어서 이동)
js/ui/mainmenu.js     파티/장비/어빌리티(코스트·숙련·등록·공명)/아이템/퀘스트/저장/설정
js/ui/shop.js         구매/판매(수량, 파티원별 장착 가능·능력치 변화)
tools/export.html     생성 에셋 미리보기/PNG 저장
```

## 디버그
- window.__app (씬 등), window.__G (G.s 상태). 예: __G.s.loc={scene:'field',map:'cave',x:10,y:19,dir:'up'}; __app.startGame(false)

## 어빌리티 시스템 요약
- 활성 어빌리티 = 고유(innate) ∪ 장착 무기 어빌리티(무기 부여, 코스트 없음) ∪ 등록(set, 코스트 ≤ 3+Lv/2)
- 전투 AP → 장착 무기의 미습득 어빌리티 전부에 적립 → 다 차면 영구 습득(learned) + 여유 있으면 자동 등록
- 패시브 mods 종류와 효과 스키마는 data/abilities.js 상단 주석 참고. 공명(SYNERGIES)은 needs 전부 활성 시 mods 추가
- 적: weak/resist/absorb, shield. 약점 적중마다 실드 -1(+mods) → 0이면 BREAK(다음 턴 스킵, 피해 ×1.6)
- 밸런스 시뮬레이터: 스크래치패드 sim.mjs (node로 Battle 모델만 돌림)

## 단계
- [x] ① 에셋 생성 구조 + 캐릭터 5종/NPC 6종/몬스터 12종/아이콘/타일, 스테이지+빌보드+디오라마 (스크린샷 확인 완료)
- [x] ② 전투 + 어빌리티 시스템 (?test=battle&foes=slime,wolf&theme=field&lv=5&party=leon,sera,bran 으로 단독 테스트)
- [x] ③ 마을 / 월드맵 / 던전 / 퀘스트 (타이틀·필드·월드·메뉴·상점·여관·엔딩·게임오버)
- [x] ④ UI 다듬기 · 밸런스 · Artifact 게시 — https://claude.ai/artifact/SX8PqG21SWgtqLGh869bvp
  - 게시 방법: index.html에서 doctype/html/head/body 태그를 뺀 페이지 + js/·css/ 파일을 files로 함께 게시 (같은 URL로 재게시)
  - 검증: 스크립트로 새 게임→대화→상자→인카운터→월드 이동 전투→상점→숲 보스→수정룡 페이즈→엔딩까지 오류 없이 통과

## v2 그래픽 개편 (2차 요청: 멈춤 수정 + 스팀급 그래픽)
- 멈춤 원인 수정: 철벽/도발(guard 애니에 hit 프레임 없음)로 전투 대기 영구 정지 → Billboard가 대기 콜백을 절대 버리지 않게.
  메인 루프 try/catch, 씬 진입 시 compileAsync 선컴파일, DOM에서 사라진 메뉴 핸들러 자동 정리(input.prune).
- stage.js: 틸트시프트 → 깊이 텍스처 기반 DOF(SceneDofPass, 앞/뒤 흐림), 스플릿톤 그레이딩, 그레인. stage.focusOn(pos)로 초점.
- diorama.js v2: maps에 heights(숫자 문자열, 1단계=0.5) → 병합 지형 메시(절벽 옆면, 정점 AO, 자연 모서리 흔들림),
  계단 타일 's'(±1단계 연결, dio.canMove), 스플랫 지면 셰이더(풀/흙/모래/꽃 도트 경계 혼합), 흔들리는 풀·꽃·나무(WIND),
  활엽수 'T'/침엽수 't'/덤불 'u'/바위 'o', 소품(type:'prop', kind: barrel crate sack pot bench cart banner hay woodpile stall flowerbed stoneFence pillar),
  집 v2(기초/골조/창/덧문/화분/차양/굴뚝 연기), 구름·먼 산·종유석·빛줄기, 물 노멀맵 셰이더.
- 캐릭터 v2: js/art/chars2.data.js (48px, 머리/몸통/다리/팔/흔들림 파츠, 셀아웃 외곽선). generate.js composeChar2/makeCharSheet2.
  확인 페이지: tools/char-lab.html, tools/mon-lab.html
- 몬스터: EPX(Scale2x)로 2배 고해상도 + 셀아웃. 수정룡은 스크래치 스크립트(도형+자동 셰이딩)로 만든 네이티브 원본(MONSTER_SHAPES.dragon2).
- 맵 재설계: 마을(3단 테라스+계단+광장 노점), 이끼 숲(4단 오르막), 수정 동굴(3단), 월드맵(북쪽 산악 높이, 해안 절벽), 전투 아레나(뒤쪽 고지대).

## v3 캐릭터·연출·조작 개편 (3차 요청)
- 캐릭터: 도트 시트 대신 **3D 리그 → 도트 스프라이트** 파이프라인 (js/gfx/rig.js).
  성인 비율 툰 셰이딩 모델을 캐릭터마다 작은 렌더 타깃에 매 프레임 렌더 → 외곽선/내부선 패스 → 빌보드. 1px = 1/50 유닛(PX).
  키프레임 관절 애니(HUMAN_ANIMS: idle walk attack_slash attack_thrust cast hurt guard victory ko jump dive + skill_heavy skill_spin),
  스프링 보조 동작(망토·머리카락·스카프), 얼굴 도트 데칼, 방향(yaw) 회전, 휘두르기 잔상(smear).
  - js/gfx/heroes.js: 영웅 5명 + NPC 정의(HERO_DEFS), 머리 스타일(HAIR), 망토/치마/견갑, 3D 무기(makeWeapon)
  - js/gfx/monsters.js: 몬스터 리그(슬라임/서리 슬라임/뿔토끼/버섯/환각버섯/늑대/수정 박쥐/불꽃 정령/수정 골렘/고목의 파수꾼/수정룡·2페이즈).
    sq(찌그러짐) 채널, makeMonster(design).morph(design)로 페이즈 변신. 리그가 없는 디자인은 기존 도트 시트로 자동 대체.
  - js/gfx/actors.js: makeActor(리그 있으면 리그, 없으면 도트 시트), faceDir, portraitURL(id, 'face'|'bust'|'cut') — UI 얼굴 아이콘도 리그에서 렌더
  - 확인 페이지: tools/rig-lab.html?ids=leon,dragon&a=idle:0,attack:0.4
- 기술 연출: 컷인(상반신 초상+기술명 띠, .cutin), 기 모으기, 돌진 잔상(fx.ghost = 렌더 타깃 프레임 복사),
  도약 내려찍기/회전 베기 모션, 큰 베기(bigSlash/crossSlash)·집중선(streaks)·충격파(shock/ringV),
  원소별: 화염 기둥(flameBurst), 얼음 결정 솟구침→파쇄(shards), 회오리(tornado), 빛의 창(lightBlades), 암흑 구체(voidOrb), 이중 낙뢰.
  카메라가 시전자→대상으로 따라가며, 마지막 적 처치 시 슬로모션+줌(afterDeaths).
- 대상 선택: 대상 목록 창(아이콘+HP) + 발밑 링/머리 위 화살표(적=빨강, 아군=초록) + 비대상 어둡게 + 선택 대상 금색 외곽선 맥동.
  상태창 줄을 탭해도 아군 선택. **아이템이 첫 번째 캐릭터에게만 들어가던 버그 수정.**
- 필드 조작: 칸 단위 → **자유 이동**(대각선, 몸통 사각형 충돌, 모서리 미끄러짐 보정, 계단 높이 부드럽게).
  동료는 리더 자취를 따라감. 모바일: 화면 드래그 = 가상 조이스틱, 짧은 탭 = 그곳으로 이동/조사.
  🔍 버튼으로 줌 3단계(js/core/view.js, localStorage 기억). 세로 화면 기본값은 한 단계 줌아웃. 월드맵도 같은 설정을 따름.
- 테스트 URL: ?test=field&map=forest&x=5&y=17 (필드 단독), ?test=battle&foes=dragon&party=kyle,leon,rhea&lv=30&theme=cave

> 4차 요청(그래픽 전면 재작성·월드맵 자유 이동·상호작용 표시)은 새 채팅에서 진행: HANDOFF.md 참고

## 다음에 할 만한 것 (선택)
- 실기기(휴대폰) 성능 확인: 리그 캐릭터는 매 프레임 개별 렌더 타깃을 그림(전투 최대 7개). 느리면 화면 밖/정지 리그는 격프레임 렌더, pixelRatio/그림자 맵/블룸 해상도 하향
- 월드맵 노드·상점 NPC 등 남은 도트 요소도 리그화 가능 (HERO_DEFS에 정의 추가)
- 밸런스는 시뮬레이터(단순 AI) 기준: 파수꾼 Lv6 승률≈98%, 수정룡 Lv13 승률≈62%. 실제 플레이 후 ENEMY_DMG·보스 HP 조정
- 콘텐츠 추가는 data/*.js만 수정: 무기(items.js)→어빌리티(abilities.js)→공명(SYNERGIES)→적(enemies.js)→조우 테이블(maps.js)

## 메모
- (v1/v2 도트 시트는 리그가 없는 디자인의 대체용으로 유지)
- 캐릭터 시트: 32x32 프레임, 행 순서 idle/walk/attack/cast/hurt/guard/victory/ko. 무기 종류별로 공격 모션(slash/thrust)이 달라 시트는 (캐릭터, 무기타입, 틴트)별 캐시.
- 캐릭터 원본은 왼쪽을, 몬스터 원본은 오른쪽을 바라봄. Billboard.flipped로 반전.
