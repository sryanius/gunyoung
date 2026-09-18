# 전투 에셋 제작 노트 (assets/battle)

BATTLE.md §5 의 12 파일. 원본·후보·스크립트는 전부 `assets/raw/battle/` (그림은 .gitignore, 스크립트·NOTES 만 저장소).
도구: ComfyUI `animagine-xl-4.0.safetensors`, `tools/gen.mjs`, 파이썬 `"C:\pinokio\api\inteliweb-comfyui\app\env\Scripts\python.exe"` (Pillow 12 + numpy + scipy).

## 공통

- 생성: `bash assets/raw/battle/gen.sh <이름> <seed> <w> <h> "<태그>" ["<추가 부정>"]` → `raw/battle/<이름>_s<seed>.png`
  - 앞머리 `masterpiece, best quality, very aesthetic, absurdres`
  - 부정 `lowres, worst quality, text, watermark, signature, logo, blurry, letters, writing, calligraphy, characters, seal, stamp, chinese text, kanji` + 항목별
  - 배치 스크립트 `batch_*.sh` 에 실제로 돌린 프롬프트가 그대로 있다.
- 후처리 `python assets/raw/battle/post.py` — `key`(단색 배경 키잉: 초록은 G 우세도, 그 외는 모서리 평균색과의 거리 `--bg=auto`, `--sat` 부분 탈색, `--flip`, `--anchor=bottom` 발밑 정렬, `--despeckle`, **수정 회차 추가** `--fillholes=N` 가장자리 미접촉 알파 0 구멍(<N px)+그 둘레 램프를 원본 RGB 로 복원 · `--close=1` 알파 closing · `--decontam` 반투명 픽셀 RGB 를 가장 가까운 불투명 색으로(프린지 제거, 알파 0 은 RGB 0) · `--gain`) · `sky`(`--loop=N` 양끝 페더 루프, 선택) · `ground`(좌우 페더 루프) · `far` · `seam`(좌우 끝 겹쳐 붙여 이음새 확인) · `sheet` · `check`
- `build_far.py` 산 띠 조립, `mock.py` 배치 목업(sky+far+ground+병사 0.3배+컷인 — 브라우저 대체), `verify_cutin.py` 컷인 구멍·프린지·눈 상자 알파 수치 + 어두운 배경 얼굴 크롭. 판정용 그림은 `raw/battle/_*.png`.

## 항목별

| 파일 | 원본(seed) | 프롬프트 요지 | 후처리 |
|---|---|---|---|
| `sky.png` 2048×720 | sky_s5 (1216×832) → `sky_s5_hi` (img2img 1824×1248 d0.38 seed 5) | `no humans, scenery, side view, vast battlefield, open plains, dry grassland, distant mountains, sunset, pale orange sky, soft clouds, traditional chinese painting, ink wash painting, sumi-e, watercolor on paper, washed out colors, faded, wide shot, horizon` / 부정 `+ people, soldier, buildings, castle, border, frame, river, lake, sea, tree, forest, digital art, photorealistic` | **낙관 제거**(아래 실패 기록) → `post.py sky sky_s5_hi_patched.png sky.png --crop=0,443,1824,1084` (땅 경계 y400 기준으로 담채 산이 400 바로 위, 아래 1/3 은 마른 풀밭). 노을 대안: `sky_s2_hi.png` (첫 프롬프트, 짙은 주황 디지털 페인팅) — `--crop=0,520,1824,1161` |
| `far.png` 2048×360 | far_s1·s2·s3 (1536×640) | `no humans, scenery, mountain range, layered mountains, distant mountains, mist, fog, ink wash painting, sumi-e, monochrome, greyscale, simple background, white background, horizontal, wide shot` / 부정 `+ people, buildings, trees, sky, clouds, sun, moon, river, border, frame, gradient, birds` | **(수정 회차)** `build_far.py far.png far_s2.png far_s3.png far_s1.png far_s2.png:flip --scale=0.45 --y0=0 --lo=0.5 --hi=0.85 --fade=16` — 네 장(s2 는 뒤집어 한 번 더)을 0.45 배로 줄여 96px 페더로 잇고 루프 블렌드, **밝기→알파**(흰 여백 투명, 먹 = 불투명), 위 16px 페이드. 전체 알파 평균 0.14, 아래 행 0.11(첫 회차 0.56 배·hi 0.93 은 중경 산맥으로 읽혀 더 작고 옅게). `--tint=70,52,66,236,190,160` 을 주면 노을빛 실루엣(노을 sky 용) |
| `ground.png` 1024×320 | ground_s3 (1024²) | `no humans, dirt ground texture, dry grass, sparse grass, pebbles, top-down view, seamless texture, tileable, flat, full frame texture, muted colors, brown earth, ancient battlefield ground` | **(수정 회차)** `post.py ground ground_s3.png ground.png --crop=0,600,1024,900 --feather=64 --gain=1.6` (생성물이 어두워 1.6배). 첫 회차 crop y300~600 은 왼쪽의 밝은 풀 다발이 1024 주기로 반복돼 1280 뷰에 두 번 보였다 → 다발 없는 y600~900 띠(64px 블록 밝기 std 4.7·max 76, 이전 5.2·85). 이음새: `post.py seam` `raw/battle/k_ground_fix_seam.png`·2장 이어 붙인 `_ground_fix_x2.png`·3배 줌 `_ground_fix_seam_zoom.png` 에 선 없음, 이음 열 차 4.64 vs 평균 3.87 |
| `cutin/guanyu.png` 832×1216 | cut_guanyu_s12 | `1boy, solo, mature male, guan yu, long beard, black beard, long hair, green robe, green hanfu, green headband, ancient chinese armor, holding polearm, guandao, green dragon crescent blade, upper body, dynamic pose, fierce, serious, looking at viewer, wind, dramatic, simple background, pink background, flat color background` / 부정 `+ multiple boys, horse, scenery, gradient background, pattern background, chibi, cute, female, hat` | `post.py key cut_guanyu_s12.png cutin/guanyu.png --bg=249,36,108 --thr=60 --ramp=40 --erode=1 --despeckle=600 --close=1 --decontam` (**통합 회차: `--fillholes` 제거** — 머리카락 사이 배경 틈 10곳을 분홍 그대로 메웠다. 관우는 눈 문제가 없다) (분홍은 모서리가 머리카락에 가려 색을 직접 지정). **(수정 회차)** `--decontam` 으로 머리카락 가장자리 붉은 프린지 제거(반투명 픽셀 평균색 (109,55,45) → (49,39,28)), 알파 0 아래 RGB 0. 인물이 네 변에 닿아 트림해도 832×1216 그대로 |
| `cutin/zhangfei.png` 832×1216 | cut_zhangfei_s12 | `1boy, solo, mature male, zhang fei, muscular, black beard, bushy beard, wild hair, angry, shouting, open mouth, red robe, red armor, ancient chinese armor, holding polearm, serpent spear, upper body, dynamic pose, looking at viewer, dramatic, simple background, green background, flat color background` | `post.py key cut_zhangfei_s12.png cutin/zhangfei.png --bg=0,98,75 --thr=45 --ramp=40 --erode=1 --despeckle=600 --fillholes=600 --bgkeep=20 "--bgkeepskip=527,174,546,195;417,207,442,227" --close=1 --decontam` (**통합 회차: `--bgkeep=20` + 눈 상자 두 개 제외** — 원본 RGB 가 배경색과 거리 20 미만인 픽셀은 진짜 배경이라 fillholes·close 를 거쳐도 키잉 알파를 지킨다. 홍채 안에도 배경과 거리 <15 인 픽셀이 있어 색만으로는 못 갈라(15/20/25 전부 눈 상자 min 알파 0) 눈 상자는 제외한다) (배경이 짙은 초록 (0,98,75) 이라 G 우세도 대신 거리 키잉 — 민트색 칼바람 이펙트가 살아남는다). **(수정 회차)** 초록 홍채 (38,112,75) 가 배경과 거리 ~40 이라 두 눈이 뚫렸었다 → `--fillholes=600` 이 눈 2개 + 어깨 밧줄·갑옷의 점 구멍 181개를 복원, `--close=1` 로 참격 가장자리 톱니 메움. 눈 상자 x527-545/y174-194·x417-441/y207-226 알파 평균 1.000(min 1.00), 가장자리 미접촉 투명 성분 184 → 3(머리카락 틈 1182·2301·5321px) |
| `units/*.png` 96×128 | 골격 공통, seed 7 (inf·spear·general_right) / 8 (cav) / **수정 회차: bow = `u_bowc_s9`, general_left = `u_glc_s7`** (`batch_fix3.sh`) | 골격 `1boy, solo, full body, standing, from side, profile, facing to the right, ancient chinese soldier, grey armor, white clothes, grey clothes, leather armor, chibi, game sprite, flat color, simple background, green background, no shadow` 앞에 병종 태그: inf `holding sword, sword, holding shield, round shield` · spear `holding spear, long spear, polearm` · bow **`chibi, big head, short legs,` + `holding bow (weapon), bow (weapon), drawing bow, quiver, arrow`**(부정 `+ realistic proportions, tall, slender`) · cav `riding horse, horseback riding, grey horse, white horse, pale horse, holding spear, cavalry`(부정 `black horse, dark horse, brown horse`) · general_left **`chibi, big head, general, commander, ornate grey armor, helmet, red plume, grey cape, white cape, holding polearm, guandao`**(부정 `+ ghost, hood, ribbon, smoke, red cape, blue cape, dark cape, black cape, teal`) · general_right `general, ornate armor, horned helmet, cape, holding sword, sword raised` / 부정 `+ multiple boys, multiple views, from behind, from front, facing viewer, shadow, gradient background, weapon rack, scenery` | `post.py key u_<k>_s<seed>.png units/<k>.png --bg=auto --thr=40 --ramp=30 --erode=1 --despeckle=50 --sat=0.5 --fit=96,128 --pad=2 --anchor=bottom` (cav·**bow·general_left** 는 `--flip` — 원본이 왼쪽 보기. bow·general_left 는 재검수에서 왼쪽 보기로 잡혀 통합 회차에 뒤집었다). 배경이 «green» 이라 해도 실제는 청록 (10~37,140~166,126~153) → G 우세도가 약해 모서리 평균색 거리 키잉. 채도 0.5 로 낮춰 코드 tint(곱셈)가 편 색을 깨끗이 입힌다. **(수정 회차)** `--despeckle=50` 추가 — 첫 회차 bow 의 36px 떨어진 조각·2px 점이 원인; inf·spear·general_right 는 despeckle 을 넣어도 픽셀 차이 0 이라 파일 그대로, cav 도 조각 1개라 그대로 |

## 코드 쪽에 전할 수치

- 병사 스프라이트: 발밑 = 아래 변 −2px (`--anchor=bottom --pad=2`) → origin **(0.5, 0.98)**. 알파 폭: inf 66 · spear 38 · **bow 81** · cav 92 · **general_left 86** · general_right 61 (높이는 전부 124, cav 만 96 — 말이 넓어 폭 기준으로 맞춰져 다른 병종보다 작게 보인다. 코드에서 cav 는 1.15 배쯤 키워도 된다). 모두 **오른쪽 보기** — 적군은 flipX. 조각 수 전부 1(떨어진 점 없음). (통합 회차에 bow·general_left 를 `--flip` 으로 뒤집어 확인 — 8배 얼굴 크롭에서 눈·볼이 오른쪽, 활·망토가 뒤. **후처리 뒤엔 8배 얼굴 크롭으로 방향을 꼭 확인할 것**)
- 0.3 배(29×38)에서도 병종이 갈린다(방패 원 / 세로 창+깃 / 활 곡선+큰 머리 / 말 / 투구 깃+펄럭이는 밝은 망토 / 뿔 투구+어두운 망토) — `raw/battle/_units_final_tint2.png` 가 땅색 위에 초록·파랑 tint 로 0.3·0.45 배를 얹은 판정 그림(수정 회차). 무장은 병사와 같은 키(128)라 **무장은 0.42~0.45 배**로 키워야 폴백(44×60 vs 24×34) 비율이 난다.
- 병사 평균 밝기 inf 125 · spear 159 · bow 128 · cav 174 · **general_left 155** · general_right 122, HSV 채도 평균 0.06~0.23 — tint 가 전신에 먹는다. general_right 만 망토가 어두워 tint 가 덜 보인다(평균 밝기 122 지만 픽셀 30% 가 밝기 80 미만·평균 40 — 망토) — 깃발/링으로 편 표시 병행 권장.
- far.png: 위 16px 부터 알파 0, 아래 변(y 359) 행 평균 알파 0.11, 전체 평균 0.14 — 아래 변을 땅 경계 **y=400** 에 맞추면(`setOrigin(0,1)` at y 400) 산 밑이 안개로 sky 에 녹는다. 가로 루프 됨(2048 주기, 이음 열 차 3.39 vs 평균 3.17). 그래도 짙으면 코드에서 alpha 0.7.
- ground.png: 320 = 720−400 이라 y 400 에 tileSprite 로 깔면 딱 맞는다. 가로 루프 됨(1024 주기). 평균색 (82,62,46).
- sky.png: 위 (241,212,168) 담황, y 400 언저리에 담채 산·안개, 아래 1/3 마른 풀밭. **가로 루프가 아니다**(왼끝 평균 (212,188,159) vs 오른끝 (237,212,179)) — tileSprite 로 깔지 말고 image 로 `scale = max(1, viewW/2048)`, 패럴랙스 계수 ≤ (2048·scale − viewW)/(3200 − viewW). 루프가 꼭 필요하면 `post.py sky sky_s5_hi_patched.png sky.png --crop=0,443,1824,1084 --loop=384` (`raw/battle/k_sky_loop384.png`, 384px 크로스페이드 자리에 산 고스트가 안개처럼 옅게 남는다 — 128 은 톤 단차가 보여 탈락). 노을 버전이 필요하면 `sky_s2_hi` 레시피(위 표) + far `--tint`.
- 컷인: 인물이 캔버스 네 변에 닿는 구도(관우 왼쪽에 옷자락·머리카락, 장비 오른쪽 위 머리카락). 오른쪽에서 왼쪽으로 슬라이드할 때 캔버스 폭 그대로 쓰면 되고, 얼굴은 관우 (600,300)·장비 (560,220) 부근(원본 좌표).

## 실패 기록 (다음에 피할 것)

- **낙관·서명**: 수묵 프롬프트(`ink wash, sumi-e, traditional chinese painting`) 는 부정에 `seal, stamp, calligraphy, chinese text, kanji` 를 넣어도 오른쪽 위에 낙관+서명을 박는다(sky_s5·s6, 그리고 s5 를 img2img 한 하이레즈에서도 **같은 자리**에 다시). 하늘이 균일한 자리라 왼쪽 같은 높이 슬랩(70×130)을 붙이고 경계 1.2px 블러로 지웠다(`batch_sky5.sh` 앞 파이썬, `sky_s5_hi_patched.png`). 낙관 아래 작은 획까지 y 500 까지 덮어야 했다 — 모서리 원본 해상도(`_sky_final_check.png`)로 재확인할 것.
- far 를 1536×640 한 장에서 잘라 1.4배 키우면 봉우리 두 개가 화면을 채운다 → 세 장을 0.56 배로 줄여 이어 붙여야 「먼 산 띠」가 된다.
- ground `light brown, dusty, daylight`(s4·s5) 는 밋밋한 모래, `yellowed grass tufts`(s6) 는 대각선 풀 결, `gravel`(s7) 은 암석 지층 → 어둡지만 질감 있는 s3 를 gain 으로 밝히는 편이 낫다.
- 병사: `flowing cape, big silhouette` 를 넣으면 두건 쓴 유령 같은 형상(general_left s7·s8) → `commander, helmet, red plume, tall` 로. `riding horse` 는 말이 검게 나와 tint 가 안 먹는다 → `grey horse, white horse, pale horse` + 부정 `black horse`. `facing to the right` 는 반쯤만 먹는다(cav·general_left 일부 왼쪽) — 뒤집으면 된다.
- 컷인: `pink background` 는 인물(머리카락·옷자락)이 모서리를 덮어 `--bg=auto` 가 못 잰다 → 색을 직접 지정. `green background` 는 (0,98,75) 짙은 초록으로 나온다.
- 컷인 키잉 뒤 600px 미만 조각 65/40개(머리카락 끝·튄 잉크) → `--despeckle=600`.
- **거리 키잉은 배경색과 가까운 내부 색을 뚫는다**: 장비의 초록 홍채 (38,112,75) 가 배경 (0,98,75) 와 거리 ~40 이라 thr=45 에 걸려 두 눈이 구멍이 됐다(첫 회차 검수에서 must). `--fillholes=600` (가장자리 미접촉 알파 0 성분 <600px + 그 성분을 품은 반투명 성분까지 255) 로 해결 — 구멍만 채우면 램프 테두리가 남아 상자 알파 평균이 0.86 에 그친다. 다음부터 배경색은 인물의 눈·장식과 겹치지 않는 색으로(초록 옷 인물엔 분홍, 초록 눈 인물엔 파랑/분홍).
- 분홍 배경 인물의 머리카락 가장자리에 1px 붉은 프린지 → `--decontam`(반투명 픽셀 RGB 를 가장 가까운 불투명 픽셀 색으로). `--erode=2` 는 가는 머리카락이 사라져 안 씀.
- 병사 프롬프트에 `chibi` 가 골격 뒤에 있으면 bow 처럼 사실 비율이 튀어나온다 → 앞머리에 `chibi, big head, short legs` + 부정 `realistic proportions, tall, slender`. 망토 색은 `long cape` 만 두면 어두운 청록·장미색이 나온다 → `grey cape, white cape` + 부정 `red cape, blue cape, dark cape, black cape, teal`.
- ground 는 밝은 풀 다발이 한 군데 있으면 1024 주기 반복이 그대로 읽힌다 → 다발 없는 띠를 자르고 64px 블록 밝기 std/max 로 평평한 후보를 고른다.
- sky 양끝 128px 페더 루프는 톤 단차가 보인다(왼·오른 끝 밝기 차 25) — 루프가 필요하면 384px 이상.

## 수정 회차 내역 (검수 지적 → 처리)

| 지적 | 처리 | 확인 |
|---|---|---|
| must: 장비 두 눈 홍채가 키잉으로 뚫림 | `post.py key --fillholes=600` 추가(가장자리 미접촉 알파 0 성분 <600px 복원 + 둘레 램프까지), 재실행 | `verify_cutin.py`: 눈 상자 두 개 알파 평균 1.000·min 1.00, 얼굴 크롭 어두운 배경 위 눈 초록 (`_cutin_fix_check.png`) |
| 장비 밧줄·갑옷 점 구멍 184개, 참격 가장자리 톱니 | 위 fillholes(181개 복원) + `--close=1` | 가장자리 미접촉 투명 성분 3개(머리카락 틈 1182/2301/5321px) |
| 관우 머리카락 붉은 프린지 | `--decontam`(+ 알파 0 RGB 0) | 반투명 픽셀 평균색 (109,55,45) → (49,39,28), 알파 0 RGB max 0 |
| bow 사실 비율·떨어진 조각 | `batch_fix3.sh` 로 `chibi, big head` 앞세워 seed 7~10 재생성 → s9 채택, `--despeckle=50` | `_sheet_fix3k.png`·`_units_final_tint2.png`: 치비 골격, 0.3배에서 활 곡선 구분, 조각 1 |
| general_left 어두운 망토(밝기 85·채도 0.28) | `grey cape, white cape` 로 seed 7~10 재생성 → s7 채택 | 밝기 155·채도 0.17, 0.3배 tint 초록/파랑 뚜렷, 오른쪽 보기 |
| ground 풀 다발 반복 | crop y300~600 → y600~900 | 블록 std 5.2→4.7·max 85→76, 이음새 없음(`_ground_fix_x2.png`·`_ground_fix_seam_zoom.png`) |
| sky 비루프 | 계약 밖 — 파일 유지, 코드 지침 + `--loop` 레시피(384) 를 NOTES 에 | `k_sky_loop384_seam.png` |
| far 중경 산맥 | `build_far.py --scale=0.45 --hi=0.85` 네 장 | 알파 평균 0.20→0.14, `_far_fix_new.png` vs `_far_fix_old.png` |

## 파일 목록 (raw/battle)

- `gen.sh` 래퍼, `batch_bg.sh`(sky 1~4·far 1~3·ground 1~3), `batch_sky2.sh`(sky 5·6 + s2 하이레즈), `batch_sky5.sh`(s5 하이레즈), `batch_units.sh`(6종 × seed 7·8), `batch_fix1.sh`(general_left 7~9 · ground 4·5), `batch_fix2.sh`(ground 6·7), cav 회색 말은 인라인(`u_cavgrey_s8·s9`), `batch_fix3.sh`(수정 회차: bowc·glc seed 7~10)
- `post.py`, `build_far.py`, `mock.py`, `verify_cutin.py`
- `*_sN.png` 생성 원본, `sky_s5_patched/up/hi/hi_patched.png` 하늘 단계별, `k_*.png`·`k_units/`·`k_fix3/`(수정 회차 병사 후보 8)·`k_units2/`(despeckle 재키잉 비교용) 키잉 후보, `_sheet_*.png` 후보 시트, `_mock*.png` 배치 목업(`_mock_fix.png` 수정 회차), `_verify_final.png`·`_sky_final_check.png`·`_units_final_tint(2).png`·`_*_seam.png`·`_cutin_fix_check.png`·`_ground_fix_*.png`·`_far_fix_*.png` 판정 그림

## 통합 회차 (재검수 must·should → 통합 담당 처리)

| 지적 | 처리 | 확인 |
|---|---|---|
| must: bow·general_left 가 왼쪽 보기 | 같은 레시피에 `--flip` 추가해 재키잉(`raw/battle/_integ_bow.png`·`_integ_gl.png` → 복사) | general_left 는 기존 파일 거울과 픽셀 차 0, bow 는 1px 배치 반올림 차뿐. 알파 폭 81/86·높이 124·발밑 y125·조각 1 유지 |
| must: guanyu 머리카락 틈에 분홍 패치 10곳(1,482px) | `--fillholes` 를 빼고 재키잉 | 배경 거리<30 불투명 픽셀 0, 반투명 평균 (45,36,26), 알파 0 RGB 0, 내부 투명 성분 23(머리카락 틈) |
| should: zhangfei 초록 패치 1곳(44px) | 원인은 fillholes 가 아니라 `--close=1` 이 2px 머리카락 틈을 메운 것. `post.py key --bgkeep=N --bgkeepskip=상자` 추가(배경색과 거리 < N 인 픽셀은 fillholes·close 뒤에도 키잉 알파 유지, 상자 안은 예외) → `--bgkeep=20` + 눈 상자 2개 | 눈 상자 두 개 알파 1.000/min 1.00 유지, 배경 거리<22 불투명 픽셀 115→70 이지만 전부 8px 이하 점(20px 이상 패치 0) |
| should: far.png 아래변 봉우리 밑동 알파 1(100여 열) | 코드에서 처리 — BattleScene 이 y 372→400 에 하늘색 안개 그라데이션 띠를 far 위·땅 아래에 깐다(far 밑변은 y 430 이라 아래 30px 은 땅 밑) | 브라우저 확인은 아직 |

실패 기록 추가: **fillholes 는 배경색과 가까운 내부 틈(머리카락 사이)도 원본 RGB 로 메우고, close=1 은 2px 틈을 배경색 그대로 메운다** → 둘 다 쓸 땐 `--bgkeep` 필수(배경색 픽셀의 키잉 알파를 마지막에 되돌린다). fill_holes 안에서만 빼면 ring 단계(`alpha<255` 성분 — 알파 0 포함)가 이웃 점 구멍을 거쳐 배경 틈을 도로 메운다.
