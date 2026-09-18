# 군영전 목업

삼국군영전풍 게임을 **브라우저(Phaser 3)** 로 상용 게임급 화면까지 만들 수 있는지 판정하려고 만든 전략맵 한 화면짜리 목업.
게임 로직은 없고 보기·움직임·소리만 있다. 폰 **가로** 전용 — 세로 고정 폰은 첫 터치를 뗄 때 전체 화면·가로 잠금, 「홈 화면에 추가」 하면 앱처럼 뜬다.

**https://sryanius.github.io/gunyoung/**

- 실행: `node tools/serve.mjs 5176` → http://localhost:5176
- 검사: `node tools/smoke.mjs`
- 사양·에셋 계약: `docs/SPEC.md` · 상태와 다음 할 일: `docs/HANDOFF.md`
- 지도·UI·아이콘은 전부 로컬 ComfyUI(Animagine XL 4.0)로 생성. 재현 프롬프트는 `assets/*/NOTES.md`.
