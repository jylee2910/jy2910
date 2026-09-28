// 외부 스프라이트 시트로 교체하고 싶을 때 여기에 경로를 등록한다 (crystal-rpg/ 기준 상대경로).
// 시트 레이아웃은 tools/export.html에서 내보낸 생성본과 같아야 한다.
//   chars:    32x32 프레임, 행 = idle/walk/attack/cast/hurt/guard/victory/ko
//   monsters: 생성본과 같은 프레임 크기, 행 = idle/attack/cast/hurt (4열)
//   icons / tiles: 같은 픽셀 크기의 단일 이미지
// 예) chars: { leon: 'assets/leon.png' }
export const OVERRIDES = {
  chars: {},
  monsters: {},
  icons: {},
  tiles: {},
};
