# 전투 에셋 제작 노트 (assets/battle)

BATTLE.md §5 의 12 파일. 원본·후보·스크립트는 전부 `assets/raw/battle/` (그림은 .gitignore, 스크립트·NOTES 만 저장소).
도구: ComfyUI `animagine-xl-4.0.safetensors`, `tools/gen.mjs`, 파이썬 `"C:\pinokio\api\inteliweb-comfyui\app\env\Scripts\python.exe"` (Pillow 12 + numpy + scipy).

## 공통

- 생성: `bash assets/raw/battle/gen.sh <이름> <seed> <w> <h> "<태그>" ["<추가 부정>"]` → `raw/battle/<이름>_s<seed>.png`
  - 앞머리 `masterpiece, best quality, very aesthetic, absurdres`
  - 부정 `lowres, worst quality, text, watermark, signature, logo, blurry, letters, writing, calligraphy, characters, seal, stamp, chinese text, kanji` + 항목별
  - 배치 스크립트 `batch_*.sh` 에 실제로 돌린 프롬프트가 그대로 있다.
- 후처리 `python assets/raw/battle/post.py` — `key`(단색 배경 키잉: 초록은 G 우세도, 그 외는 모서리 평균색과의 거리 `--bg=auto`, `--sat` 부분 탈색, `--flip`, `--anchor=bottom` 발밑 정렬, `--despeckle`, **수정 회차 추가** `--fillholes=N` 가장자리 미접촉 알파 0 구멍(<N px)+그 둘레 램프를 원본 RGB 로 복원 · `--close=1` 알파 closing · `--decontam` 반투명 픽셀 RGB 를 가장 가까운 불투명 색으로(프린지 제거, 알파 0 은 RGB 0) · `--gain` · **컷인 2차 추가** `--fillnear=N` 가장자리 미접촉 알파 0 구멍(<N px)+둘레 2px 를 알파 255 로 메우되 RGB 는 가장 가까운 진짜 전경색(알파 255·배경 거리≥30) — bgkeep 뒤) · `sky`(`--loop=N` 양끝 페더 루프, 선택) · `ground`(좌우 페더 루프) · `far` · `seam`(좌우 끝 겹쳐 붙여 이음새 확인) · `sheet` · `check`
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
- `post.py`, `build_far.py`, `mock.py`, `verify_cutin.py`, **컷인 2차** `batch_cutin2.sh`(xiahoudun·dianwei seed 21~24), `measure_bg.py`(분홍 배경색 측정 `bg` · 키잉 검증 `check`), `cut_xiahoudun_s21~24.png`·`cut_dianwei_s21~24.png`, `_sheet_cutin2.png` 후보 8장, `_cutin2_check.png`(어두운 배경 0.5배+얼굴 2배)·`_cutin2_zoom*.png` 판정 그림
- `*_sN.png` 생성 원본, `sky_s5_patched/up/hi/hi_patched.png` 하늘 단계별, `k_*.png`·`k_units/`·`k_fix3/`(수정 회차 병사 후보 8)·`k_units2/`(despeckle 재키잉 비교용) 키잉 후보, `_sheet_*.png` 후보 시트, `_mock*.png` 배치 목업(`_mock_fix.png` 수정 회차), `_verify_final.png`·`_sky_final_check.png`·`_units_final_tint(2).png`·`_*_seam.png`·`_cutin_fix_check.png`·`_ground_fix_*.png`·`_far_fix_*.png` 판정 그림

## 통합 회차 (재검수 must·should → 통합 담당 처리)

| 지적 | 처리 | 확인 |
|---|---|---|
| must: bow·general_left 가 왼쪽 보기 | 같은 레시피에 `--flip` 추가해 재키잉(`raw/battle/_integ_bow.png`·`_integ_gl.png` → 복사) | general_left 는 기존 파일 거울과 픽셀 차 0, bow 는 1px 배치 반올림 차뿐. 알파 폭 81/86·높이 124·발밑 y125·조각 1 유지 |
| must: guanyu 머리카락 틈에 분홍 패치 10곳(1,482px) | `--fillholes` 를 빼고 재키잉 | 배경 거리<30 불투명 픽셀 0, 반투명 평균 (45,36,26), 알파 0 RGB 0, 내부 투명 성분 23(머리카락 틈) |
| should: zhangfei 초록 패치 1곳(44px) | 원인은 fillholes 가 아니라 `--close=1` 이 2px 머리카락 틈을 메운 것. `post.py key --bgkeep=N --bgkeepskip=상자` 추가(배경색과 거리 < N 인 픽셀은 fillholes·close 뒤에도 키잉 알파 유지, 상자 안은 예외) → `--bgkeep=20` + 눈 상자 2개 | 눈 상자 두 개 알파 1.000/min 1.00 유지, 배경 거리<22 불투명 픽셀 115→70 이지만 전부 8px 이하 점(20px 이상 패치 0) |
| should: far.png 아래변 봉우리 밑동 알파 1(100여 열) | 코드에서 처리 — BattleScene 이 y 372→400 에 하늘색 안개 그라데이션 띠를 far 위·땅 아래에 깐다(far 밑변은 y 430 이라 아래 30px 은 땅 밑) | 브라우저 확인은 아직 |

실패 기록 추가: **fillholes 는 배경색과 가까운 내부 틈(머리카락 사이)도 원본 RGB 로 메우고, close=1 은 2px 틈을 배경색 그대로 메운다** → 둘 다 쓸 땐 `--bgkeep` 필수(배경색 픽셀의 키잉 알파를 마지막에 되돌린다). fill_holes 안에서만 빼면 ring 단계(`alpha<255` 성분 — 알파 0 포함)가 이웃 점 구멍을 거쳐 배경 틈을 도로 메운다.

## 컷인 2차 — 적 무장 하후돈·전위 (`cutin/xiahoudun.png`, `cutin/dianwei.png`)

관우·장비와 같은 골격: `gen.sh` 832×1216, 앞머리·부정 공통 + `batch_cutin.sh` 의 항목 부정(`multiple boys, 2boys, horse, scenery, gradient background, pattern background, text, chibi, cute, female, 1girl, hat`)에 `red armor, green armor, pink clothes` 추가. 둘 다 푸른 갑옷이라 배경은 **분홍**(`pink background`). 스크립트 `raw/battle/batch_cutin2.sh`, seed 21~24 × 2 = 8장(`_sheet_cutin2.png`).

| 파일 | 원본(seed) | 프롬프트 요지 | 후처리 |
|---|---|---|---|
| `cutin/xiahoudun.png` 832×1216 | cut_xiahoudun_s22 | `1boy, solo, mature male, xiahou dun, eyepatch, eyepatch over left eye, one eye covered, black beard, short beard, black hair, blue armor, blue robe, blue cape, ancient chinese armor, holding sword, huge weapon, large sword, curved sword, dao, upper body, dynamic pose, fierce, serious, glaring, looking at viewer, wind, dramatic, simple background, pink background, flat color background` | `post.py key cut_xiahoudun_s22.png cutin/xiahoudun.png --bg=250,6,129 --thr=60 --ramp=40 --erode=1 --despeckle=600 --bgkeep=20 --close=1 --fillnear=300 --decontam --flip` — **`--flip`**: 네 seed 중 셋(21·22·24)이 안대를 인물의 오른눈(보는 쪽 왼쪽)에 그려 s22 를 거울로 뒤집어 왼눈으로. **`--fillnear=300`**(post.py 에 추가): 칼날 가장자리의 분홍 반사선이 배경색 그대로라 거리 키잉에 2~3px 슬릿 10곳(최대 188px)이 뚫렸다 → 둘레 2px 까지 가장 가까운 전경색(칼날의 파랑/검정)으로 메움. 진짜 배경 틈(칼과 몸 사이 577·658·4741px)은 300 위라 남는다 |
| `cutin/dianwei.png` 832×1216 | cut_dianwei_s22 | `1boy, solo, mature male, dian wei, muscular, bulky, broad shoulders, large pectorals, short beard, stubble, black hair, dark armor, black armor, blue sash, blue cloth, ancient chinese armor, dual wielding, two short halberds, halberd, polearm, upper body, dynamic pose, angry, fierce, shouting, looking at viewer, dramatic, simple background, pink background, flat color background` | `post.py key cut_dianwei_s22.png cutin/dianwei.png --bg=249,30,127 --thr=60 --ramp=40 --erode=1 --despeckle=600 --bgkeep=20 --close=1 --decontam` (fillholes·fillnear 없음 — 내부 투명 13곳은 전부 머리카락 가닥 사이(15~616px)·왼팔과 몸통 사이(10895·19406px) 진짜 틈, `_cutin2_zoom_d.png`) |

- 후보 판정(`_sheet_cutin2.png`): 하후돈 s21 머리카락이 눈을 덮어 안대가 안 보임 · s22 채택(안대·푸른 갑옷과 망토·세워 든 큰 칼·짧은 검은 수염) · s23 안대가 왼눈에 바로 붙었지만 안대 밑에 붉은 점(기계눈처럼)·갈색 망토·정적인 포즈 · s24 안대·큰 곡도 호가 힘있지만 칼이 청록 참격 이펙트로 읽히고 얼굴이 작다. 전위 s21 칼 한 자루·수염 거의 없음 · s22 채택(거구 검은 갑옷·푸른 띠·등 뒤 쌍극 자루·이 드러낸 고함) · s23 극 한 자루만 보이고 덜 거구 · s24 창백한 얼굴에 송곳니(흡혈귀).
- 배경색 측정: 인물이 캔버스를 거의 다 채워(분홍 6~14%) `--bg=auto`(모서리) 는 못 쓰고(s22 모서리 평균 (63,4,79)), 전체 최빈색도 검은 갑옷 (1,2,3) 이다 → `python raw/battle/measure_bg.py bg cut_*.png` — R>150·G<110·R>B 인 픽셀만으로 8단계 최빈색 근처 평균. 생성마다 다르다: xiahoudun s21 (249,34,116) s22 (250,6,129) s23 (250,23,125) s24 (249,24,102) / dianwei s21 (238,34,128) s22 (249,30,127) s23 (253,11,143) s24 (245,29,119).
- 검증(`measure_bg.py check <keyed> r,g,b`): 둘 다 832×1216 RGBA, bbox 가 네 변 전부(트림해도 그대로), **배경 거리<30 불투명 픽셀 0**, 알파 0 RGB 0, 반투명 평균 xiahoudun (45,15,70) · dianwei (66,33,46). 눈 상자 알파 xiahoudun x368-390/y343-362, dianwei x270-295/y348-366·x372-395/y296-314 → 아래 확인값. 경계 3px 안 마젠타 기운 불투명 픽셀(머리카락 가닥 오염, ≤22px 조각) xiahoudun 179 · dianwei 273 vs 관우 133 — 같은 자릿수라 그대로 둠. 전위 입 속 붉은색은 배경과 거리 ~75 라 살아남았다(`_cutin2_check.png` 얼굴 크롭).
- 코드 쪽: 둘 다 인물이 네 변에 닿는 구도(관우와 같음) — 캔버스 폭 그대로 슬라이드. 얼굴 xiahoudun (430,380) 부근(보이는 오른눈 (378,352), 안대 (485,367)) · dianwei (340,370) 부근(눈 (281,357)·(383,306), 입 (373,413)). `_integ_check.py` BG 에 두 장의 배경색을 넣어 뒀다.

실패 기록 추가:
- **배경색과 같은 하이라이트 선**: 분홍 배경으로 뽑으면 칼날·갑옷 가장자리 반사선을 배경 분홍으로 그린다(하후돈 s22 칼날 왼쪽 가장자리 2~3px) → 거리 키잉이 슬릿으로 뚫는다. `--fillholes` 는 분홍을 되살리고 `--bgkeep` 은 원본 RGB 기준이라 도로 뚫는다 → `--fillnear=N`(bgkeep 뒤, 가까운 전경색으로 메움). N 은 진짜 배경 틈 최소 크기(여기 577) 아래로.
- `eyepatch over left eye` 는 안 먹는다(4장 중 3장이 오른눈) — 뒤집으면 된다(컷인은 방향 제약 없음). `dian wei` 태그만으론 창백한 흡혈귀 얼굴(s24)이 섞여 나온다 — seed 를 여럿 돌려 고른다.

## 컷인 3차 — 여성 무장 4명 (2026-09-19, docs/BATTLE_V3.md §3.1·§3.2)

납품: `cutin/<key>.png` ×4 **1248×1824 RGBA**(가장자리 페이드) · `cutin/<key>_eyes.png` ×4 **1024×256 RGB** · `hud/portrait_<key>.png` ×4 96×120 RGB. (전장 SD 무장 8장은 `units2/NOTES.md` 맨 아래.)
기존 남성 그림은 `assets/raw/battle/male_v2/`(cutin·cutin_orig·hud·units2)에 보관. 원본·후보·스크립트는 전부 `assets/raw/battle3/`(그림은 gitignore). 확인 시트 `raw/battle3/cutin_sheet.png`(컷인+눈 띠+초상) · `eyes_sheet.png` · `portrait_sheet.png`.

### 수위 규칙 (절대 규칙 — BATTLE_V3.md §3.1 그대로. 후보를 볼 때마다 이 순서로 걸렀다)
1. **절대선 1 — 성인 여성**: 성숙한 얼굴·7~8등신·성인 체형. 앳된 얼굴·작은 체구·큰 머리·교복이면 탈락. 프롬프트에 `mature female, tall female, adult`, 부정에 `loli, child, young girl, petite, flat chest, chibi, school uniform`(`gen.sh` 의 SAFE 에 박아 놓아 컷인 생성엔 항상 붙는다).
2. **절대선 2**: 유두·성기 노출, 비치는 옷, 성행위 암시, 찢겨 벗겨지는 옷 금지. 부정 `nsfw, explicit, nude, nipples, pussy, see-through, torn clothes, sex`. 등급 태그는 **`sensitive`**(questionable·nsfw·explicit 은 안 쓴다).
3. **허용 상한**: 비키니 아머 수준(가슴골·배·허벅지). **무장으로 읽혀야 한다** — 네 장 모두 어깨 방어구(pauldron)·팔 방어구(gauntlet)·다리/허리 방어구 + 전포·망토·허리천 + 무기가 있다. 맨살 비키니뿐인 후보는 버린다(이번 후보 50장 중엔 없었다 — `bikini armor` + `pauldrons, gauntlets, faulds/thigh armor` 를 같이 넣으면 갑옷이 붙는다).
4. 전장 SD 유닛은 노출 없이 갑옷·전포(units2/NOTES.md).
- 판정 메모: 채택 4장 전부 1·2 통과. 하후돈은 갈색 팬티스타킹(허벅지)이 있다 — 비키니 하의는 불투명하고 비치는 것은 다리뿐이라 통과로 봤다(거슬리면 hires 프롬프트에 `black pants` 로 다시). 「눈길」은 노출보다 구도(사선 무기·휘날리는 머리/망토)·눈빛·림 라이트로 뽑았다.

### 만드는 순서 (재현)
1. **후보** `raw/battle3/gen.sh <이름> <seed> 832 1216 "<태그>" "<부정>"` → `cand/`. 앞머리 `masterpiece, best quality, very aesthetic, absurdres, sensitive`. 배치: `batch_cutin1.sh`(4명 × seed 41~48) · `batch_cutin2.sh`(51~58, **폐기**) · `batch_cutin3.sh`(관우 61~70). 시트 `_sheet_c1_*.png` `_sheet_c2_*.png` `_sheet_c3_guanyu.png`.
2. **채택**: 관우 `cut_guanyu_s69`(3차) · 장비 `cut_zhangfei_s47` · 하후돈 `cut_xiahoudun_s41` · 전위 `cut_dianwei_s44`(1차). 대안: 관우 s64(얼굴이 더 곱고 망토가 크다, 언월도는 아래쪽 일부만 — `cand/hi_guanyu64_s64.png` 까지 뽑아 뒀다).
3. **배경 갈아 끼우기(장비·전위만)**: 장비는 청록 그라데이션, 전위는 옅은 분홍+흰 빛무리라 단색 키잉이 안 된다 → `cutkey.py … --comp=r,g,b` 로 거칠게 뽑아 단색 배경에 다시 얹은 그림(`k/<key>_rough_comp.png`)을 하이레즈 입력으로.
   - `cutkey.py cand/cut_zhangfei_s47.png k/zhangfei_rough.png --hue=160,200 --smin=0.45 --vmin=0.2 --thr=45 --ramp=40 --comp=30,160,150`
   - `cutkey.py cand/cut_dianwei_s44.png k/dianwei_rough.png --hue=285,345 --smin=0.04 --vmin=0.7 --thr=40 --ramp=40 --fillholes=3000 "--fgpoly=383,340;428,300;486,300;560,380;660,430;625,472;560,482;383,475" --comp=250,20,130` (어깨·쇄골의 하얗게 날아간 하이라이트가 흰 빛무리와 붙어 색으로는 못 가른다 → 다각형 강제 전경)
4. **하이레즈** `batch_hires.sh 0.35`: 입력을 Lanczos 1.5배(1248×1824)로 키워 `hi/<key>_in.png`, 같은 프롬프트·같은 seed, img2img **denoise 0.35** → `cand/hi_<key>_s<seed>.png`. 얼굴·손이 또렷해지고 구도는 그대로(`_sheet_hi.png`, `_hi_faces.png`).
5. **키잉 + 페이드** `build_cutin.sh` → `k/<key>_key.png`(페이드 전, `raw/battle/cutin_orig/` 에도 복사) → `fade3.py`(cutin_fade.py 와 같은 식, **좌 255·우 135·상 75·하 165** = 1.5배) → `cutin/<key>.png`. **옛 `raw/battle/cutin_fade.py` 는 832용 수치라 다시 돌리지 말 것.**
   - 공통 `--hue=300,350 --smin=0.5 --vmin=0.5 --thr=60 --ramp=40 --sigma=45 --despeckle=1400 --interior=200 --fillnear=60 --despill=24`, 관우 `--despillgain=0.5`, 하후돈 `--flip`(안대가 인물의 오른눈에 그려져 거울로 뒤집어 왼눈으로 — 남성판과 같은 처리), 전위 `--despillbox=640,120,960,420 --despillgain=0.45 --despillsmin=0.12`, 장비 `--hue=165,190 --solidhi=8 --thr=50`(despill 없음).
6. **눈 띠** `eyes.py crop` → `batch_eyes.sh 0.3`(얼굴 둘레를 1216×832 로 키워 img2img denoise 0.3 — 확대 1.99~2.70배라 그냥 늘리면 흐리다) → `eyes.py strip`(다시 키잉 → 어두운 무장 색 그라데이션 위 → 가운데 1024×256). 눈 사이 거리가 띠 폭의 27%(전위 24%). 하후돈은 안대 + 한쪽 눈.
7. **초상** `portraits3.py`(hud_build.py 의 portraits() 와 같은 식, 입력은 페이드 전 `k/<key>_key.png`): 눈 가운데·자를 폭 = 관우 (611,660)·445·감마 0.80 / 장비 (566,549)·400 / 하후돈 (536,454)·440 / 전위 (653,388)·345·감마 0.90. 가운데 상자 밝기 116·112·141·135. **`raw/battle2/field/hud_build.py portraits` 는 남성판 좌표(832 기준)라 다시 돌리면 초상이 깨진다.**

### 프롬프트 (공통 꼬리 `cowboy shot, dynamic pose, looking at viewer, wind, floating hair, rim lighting, dramatic lighting, simple background` + 배경색)
| key | seed | 태그(앞에 `1girl, solo, mature female, tall female, adult`) | 배경 |
|---|---|---|---|
| guanyu | 69 | `guan yu, (holding guandao:1.2), (glaive \(polearm\):1.2), large crescent blade, ornate blade, polearm, very long hair, black hair, straight hair, sharp eyes, narrowed eyes, green eyes, cold expression, elegant, beautiful, gold hair ornament, bikini armor, green armor, gold trim, green cape, pauldrons, gauntlets, faulds, cleavage, navel, midriff` | `magenta background, pink background` → (241,43,143) |
| zhangfei | 47 | `zhang fei, black hair, messy hair, high ponytail, wild hair, red eyes, fierce grin, fang, confident, toned, abs, bikini armor, red armor, black armor, black gloves, pauldrons, gauntlets, armored boots, red waist cape, cleavage, navel, midriff, holding spear, serpent spear, long spear, polearm` | `green background` → 청록 그라데이션 → 단색 (30,160,150) 으로 교체 |
| xiahoudun | 41 | `xiahou dun, eyepatch, black eyepatch, one eye covered, dark blue hair, short hair, blue eyes, cold expression, glaring, serious, bikini armor, blue armor, blue cape, pauldrons, gauntlets, faulds, thigh armor, cleavage, navel, midriff, holding sword, huge sword, dao, broadsword` | `pink background` → (242,74,179) |
| dianwei | 44 | `muscular female, abs, toned, broad shoulders, dian wei, very short hair, black hair, tomboy, yellow eyes, stoic, expressionless, serious, bikini armor, black armor, dark armor, blue sash, blue waist cloth, pauldrons, gauntlets, thigh armor, cleavage, navel, midriff, dual wielding, holding axe, two short halberds, halberd` | `pink background` → 옅은 분홍 빛무리 → 단색 (250,20,130) 으로 교체 |

항목 부정: `multiple girls, 2girls, 1boy, male, horse, scenery, gradient background, pattern background, hat, helmet, bare shoulders only, swimsuit only, beach` (+ 남의 편 갑옷색, 관우는 `crown, headdress, sword` 추가).

### 검증 (`raw/battle3/check_cutin.py` — 위치별 배경장 기준)
- 네 장 모두 1248×1824 RGBA, **배경 거리<30 불투명 픽셀 0**, 알파 0 픽셀 RGB 0(페이드 뒤에도), 불투명 조각 1, 페이드 뒤 네 변 알파 0·bbox (32,10)–(1230,1802).
- 가장자리 미접촉 투명 성분: 관우 21(머리카락 틈 239~1338px) · 장비 10 · 하후돈 1(1840) · 전위 5 — 전부 진짜 틈(200px 미만 구멍은 `--interior`·`--fillnear` 가 메웠다).
- 얼굴 확대 `k/_face_zoom.png`, 어두운/밝은 배경 합성 `k/_<key>_key.png`.
- 코드 쪽 수치(1248×1824 좌표): 두 눈 가운데 관우 (611,660) · 장비 (566,549) · 하후돈 (536,454 — 보이는 눈 (468,448), 안대 (605,460), **안대 = 인물의 왼눈**) · 전위 (653,388) → `cutin.js CUTIN_ART` 의 faceU/faceV (0.49,0.35)·(0.46,0.30)·(0.42,0.27)·(0.53,0.25) 와 맞는다(그대로 두면 된다). **(통합 2026-09-19)** 얼굴 중심 기준을 「두 눈 가운데와 입 사이」 하나로 통일해 (0.486,0.387)·(0.455,0.326)·(0.437,0.272)·(0.517,0.237) 로 다시 넣었고, 관우만 `faceIn 0.56·scale 0.92`(언월도 날이 화면 위로 잘리지 않게) — 미리보기 `python assets/raw/battle3/cutin_preview.py`, docs/HANDOFF.md §9.9. 무기: 관우 언월도 날이 머리 위(캔버스 위쪽 1/4), 장비 붉은 사모가 왼위→오른아래 사선, 하후돈 대도가 오른위→왼아래 사선(뒤집은 뒤), 전위 쌍극이 좌우 위.
- `node tools/smoke.mjs` PASS(339 ok) · `view-check.mjs --art` PASS(91 ok).

### cutkey.py (새 키잉 — 배경이 단색이 아니어도 된다)
씨앗 배경(HSV 색상대·채도·명도, 가장자리에 닿거나 1500px 이상인 덩어리만) → 씨앗만의 가우시안 평균으로 **위치별 배경색 장** → 그 장과의 거리로 알파. 옵션: `--interior=N`(바깥 투명과 안 이어진 알파<255 덩어리를 255 로 — 입술·홍조·눈가) · `--despill=N`(바깥 투명에서 N px 안의 배경 색상 기운을 탈색, `--despillgain` 으로 어둡게, `--despillbox` 상자 안은 전부) · 「확실한 전경」 규칙(색상이 배경 색상대 −20°/+5° 밖이면 알파 255, `--solidhi`) · `--fgpoly` · `--comp` · `--fillholes` · `--fillnear` · `--flip`. `<dst>_bgfield.npy` 에 배경장을 남긴다(check_cutin.py 가 읽는다).

### 실패 기록 (3차)
- **`flat color background` 를 넣으면 그림체가 통째로 납작한 셀화가 된다**(2차 51~58 전부 — 검은 먹칠 그림자, 회화풍 명암 없음). 배경만이 아니라 화풍 태그로 먹는다 → 빼고, 배경은 cutkey.py 로 해결.
- `rim lighting, dramatic lighting` 은 배경에 빛무리·그라데이션을 만든다(1차 32장 중 절반). 단색으로 나온 것(관우 s69·하후돈 s41)은 그대로, 나머지는 위 3번처럼 배경을 갈아 끼운 뒤 하이레즈.
- 관우 1차는 언월도가 안 나온다(금빛 봉·빛나는 검·이상한 초록 관) → 무기 태그를 맨 앞에 가중치로 + 부정 `crown, headdress, sword`.
- **옅은 분홍 배경은 살색과 가깝다**: 하후돈 하이레즈 배경 (242,74,179)·빛무리 (247,98,203) 와 살색 (214,185,184) 의 거리 95 → thr 60+ramp 40 이면 얼굴이 알파 210~240 이 되고 decontam 이 볼·입술·눈가를 줄무늬로 뭉갠다 → 「확실한 전경」 규칙 + `--interior`. 위쪽 색상 여유를 +20° 로 두면 분홍빛 살색(H 0~10)이 배경 색상대로 들어가 버린다 → +5°.
- despill 을 얼굴 안 점 구멍 둘레에도 걸면 입술·눈가가 회색 얼룩이 된다 → 「바깥 투명」에서만 거리를 잰다. 전위는 전체에 걸면 살 윤곽선의 붉은 기가 점선으로 죽는다 → 머리카락 상자만.
- 장비 망토 안감(청회색 H 204~210)이 청록 배경(H 177)과 가까워 너덜너덜하게 뚫렸다 → 색상대를 165~190 으로 좁히고 `--solidhi=8`.
- fade3.py: float 알파 0.x 가 uint8 로 0 이 되면서 RGB 가 남았다 → uint8 로 내린 뒤 알파 0 픽셀 RGB 0.
- 같은 옵션을 두 번 주면(공통 `$M` 뒤에 개별 값) 앞엣것이 먹었다 → cutkey.py `arg()` 는 뒤엣것을 읽는다.
- 전위 어깨의 흰 하이라이트는 하이레즈 뒤 「흰 스카프」처럼 읽힌다(원본이 하얗게 날아간 자리) — 그대로 뒀다.

### 파일 목록 (raw/battle3)
`gen.sh`(컷인용, 수위 부정 내장) · `gen_unit.sh`(SD 유닛용) · `batch_cutin1~3.sh` `batch_hires.sh` `batch_eyes.sh` `batch_units1.sh` `batch_qstand.sh` `batch_qattack.sh` `batch_qattack2.sh` · `cutkey.py` `check_cutin.py` `fade3.py` `build_cutin.sh` `eyes.py` `portraits3.py` `cutin_sheet.py` `sheet.py` `qedit.sh` `post_units.sh` `units/padflip.py` `units/anchor.py` · `cand/`(후보·하이레즈·눈 확대) `hi/`(img2img 입력) `k/`(키잉 결과·판정 그림) `units/`(cand·q·m·out) · `cutscene/` 은 연출 코드 갈래의 목업.
