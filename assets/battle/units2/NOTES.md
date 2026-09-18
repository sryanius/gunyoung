# 유닛 그림 2차 제작 노트 (assets/battle/units2)

BATTLE_ART.md §1 의 24장: 병사 4종(inf·spear·bow·cav) × 2편(g 초록 / b 파랑) × 2자세(stand / attack) = 16 + 무장 4명(gen_guanyu·gen_zhangfei·gen_xiahoudun·gen_dianwei) × 2자세 = 8.
전부 **128×160 RGBA, 오른쪽 보기, 발끝 y=152**(origin 0.5·0.95), 알파 0 픽셀 RGB 0. 편 색은 그림 자체에 있다(tint 금지). 적군은 flipX.
원본·후보·스크립트는 `assets/raw/battle2/units/` (그림은 .gitignore, 스크립트만 저장소). 전체 시트 `assets/raw/battle2/units_sheet.png`(4×6, 2배, 흰 선 = y152).

도구: ComfyUI `animagine-xl-4.0`(SDXL, `tools/gen.mjs`) → Qwen-Image-Edit(`C:\claude\image-edit\edit.py --turbo`, 한 장 17~30초) → 파이썬 `"C:\pinokio\api\inteliweb-comfyui\app\env\Scripts\python.exe"`(Pillow·numpy·scipy).

## 만드는 순서 (재현)

1. **SDXL stand** — `gen.sh <이름> <seed> <w> <h> "<태그>" "<부정>"` (앞머리·공통 부정은 `assets/raw/battle/gen.sh` 와 같다). 배치: `batch_stand1~4.sh`.
2. **키잉·정렬** — `u2post.py key`(테두리 링 중앙값 배경색과의 거리 키잉 → 1px 침식 → despeckle 300 → decontam, 왼쪽 보기는 `--flip`) → `u2post.py fit --h=<몸 높이>`(머리끝~발끝을 재서 축소, 발끝 y152, 발 무게중심 x 를 가운데로. premultiplied Lanczos + 약한 unsharp 60%).
3. **Qwen 편집 입력** — `u2post.py flat`: 128×160 배치 그대로를 2.8배로 그린 **383×448 자홍(255,0,255) 단색 배경**. 383:448 = 944:1104 — edit.py 의 `FluxKontextImageScale` 이 고르는 해상도와 같은 비율이라 그림이 안 늘어난다(결과는 944×1104 = 입력의 2.4643배, 128×160 의 6.9배).
4. **Qwen 편집** — `qedit.sh <입력> <출력> <seed> "<지시문>"`. 배치: `batch_qwen_fix.sh`(stand 고치기) → `batch_attack1.sh`(attack) → `batch_blue1.sh`·`batch_blue2.sh`(파랑).
5. **편집 결과 키잉·정렬** — `u2post.py unflat`: 기본은 **배치 유지**(배율 160/1104 고정, 발끝만 y152 로 재정렬 — stand 와 같은 크기), `--refit` 은 새 stand(머리끝~발끝 다시 재기), `--same=<초록.json>` 은 파랑(초록 bbox 의 자리·크기에 그대로 맞춤), `--degreen` 남은 초록→파랑, `--fillnear=250`(기본) 자홍 반사광 점 구멍 메움.
6. **수정 회차 후처리** — `u2fix.py`(128×160 결과 위에서: 자홍 잔여·떨어진 조각·궁병 시위·궁병 상체색·파랑 기병 attack·머리카락 점·전위 허벅지·배경색 잔여). 아래 「수정 회차」 절.
   전체 후처리는 **`post_green.sh` → `post_blue.sh` → `post_fix.sh`** 세 개로 재현된다(→ `out/*.png` → 이 폴더로 복사. 다시 돌려 24장이 바이트 단위로 같음을 확인했다).

## SDXL 프롬프트

골격(전부 공통): `chibi, 1boy, solo, full body, standing, from side, facing to the right, <유닛 태그>, simple background, <배경색> background` — 무장은 `chibi, big head, short legs, 1boy, …` (아래 실패 기록).
공통 부정(+ gen.sh 기본): `multiple boys, 2boys, multiple views, from behind, from front, facing viewer, gradient background, pattern background, weapon rack, scenery, 1girl, female, silhouette, faceless, shadow, border, frame, plume, aura, fire, magic, debris` (무장은 `+ realistic proportions, tall, slender`, debris 없음).

| 유닛 | 채택 원본 (seed) | 유닛 태그 | 배경 | 비고 |
|---|---|---|---|---|
| inf | `s3_inf_s27` (27) 832×1216 | `ancient chinese soldier, three kingdoms, green armor, green clothes, green tunic, iron helmet, leather armor, holding sword, dao, holding shield, round wooden shield, boots` | blue → 실제 (102,197,196) | 왼쪽 보기 → flip |
| spear | `s3_spear_s25` (25) | `… green scale armor, scale armor, green clothes, green tunic, iron helmet, holding spear, long spear, polearm, boots` | (8,162,183) | flip |
| bow | `s3_bow_s23` (23) — **당긴 자세라 attack 의 원본** | `ancient chinese archer, three kingdoms, green clothes, green tunic, green headband, light clothes, holding bow (weapon), drawing bow, aiming, arrow (projectile), quiver, boots` | (13,186,224) | 오른쪽 보기. 활이 머리 위로 몸 절반만큼 솟아 Qwen 으로 짧은 활로 교체 |
| cav | `s3_cav_s22` (22) 1024×1024 | `ancient chinese cavalry, three kingdoms, riding horse, horseback riding, brown horse, green armor, green clothes, iron helmet, holding spear, boots` | (47,155,194) | flip. 창이 말보다 길어 Qwen 으로 짧게 |
| gen_guanyu | `st_gen_guanyu_s25` (25) | `guan yu, three kingdoms, very long beard, black beard, long hair, green robe, green hanfu, green hat, gold trim, holding polearm, guandao, crescent blade, boots` | blue (83,185,202) | flip |
| gen_zhangfei | `st_gen_zhangfei_s27` (27) | `zhang fei, three kingdoms, bushy beard, black beard, wild hair, angry, red armor, black clothes, ancient chinese armor, holding polearm, serpent spear, long spear, boots` | blue (100,183,208) | flip. 관 위 흰 뿔은 Qwen 으로 제거(뿔 때문에 몸이 138px 로 줄었다) |
| gen_xiahoudun | **`fx_gen_xiahoudun_s34` (34)** — 수정 회차에서 교체 | 골격이 다르다: `chibi, big head, short legs, 1boy, solo, full body, standing, profile, from side, facing to the right, looking to the side` + `xiahou dun, three kingdoms, eyepatch, black eyepatch, short beard, stubble, black hair, mature male face, blue armor, blue cape, ancient chinese armor, blue helmet, holding sword, huge sword, broadsword, dao, curved blade, boots`, 부정에 `looking at viewer, big eyes, three quarter view, wings, feather` 추가 (`batch_fix_xhd.sh`, seed 33~40) | green → (115,205,178) | **옆모습 왼쪽 보기 → flip**. 배경 민트가 흰 바지의 그늘색 (132,152,179) 과 거리 56 → `--thr=25 --ramp=20`. 머리카락 속 반짝이 점이 배경색이라 뚫린다 → `u2fix.py fillholes`. (옛 그림 `st_gen_xiahoudun_s28` 은 1차 보고에 «오른쪽 보기(3/4)» 라 적었으나 **실제는 왼쪽 보기**였다 — 아래 실패 기록) |
| gen_dianwei | `st_gen_dianwei_s26` (26) | `dian wei, three kingdoms, bald, stubble, thick eyebrows, bulky, broad shoulders, dark armor, black armor, blue sash, blue waist cloth, dual wielding, holding axe, battle axe, boots` | green → (179,233,211) | flip. 배경이 옅은 민트라 살색과 거리 68 → `--thr=25 --ramp=25` (나머지는 40/30) |

seed 계열 21~31, 같은 골격·같은 cfg 5·steps 28·euler_ancestral. 후보 시트: `_stand1_*.png`(21~23) `_stand2_*.png`(24~27, big head) `_stand3_*.png`(병사 21~26) `_stand4.png`(28~31) `_stand5.png`(bow·cav 27~32) `_picks1/2.png`.

## Qwen 지시문 (채택분)

공통 꼬리 KEEP = «Keep the outfit, colors and style exactly the same. Keep the same character size and position, feet on the same spot. Keep the plain magenta background.»

| 결과 | 입력 | seed | 지시문 |
|---|---|---|---|
| bow attack(짧은 활) | s3_bow_s23 flat | 1 | Replace the long bow with a small short bow, about half as tall, so that the bow does not reach above his head. He is still drawing the bowstring with an arrow, aiming to the right. + Keep the character, outfit, colors and art style exactly the same. Keep the plain magenta background. |
| cav stand(짧은 창) | s3_cav_s22 flat | 1 | Make the spear much shorter: a short spear held in his hand, pointing forward and slightly upward. The spear tip must not extend past the horse's head and the spear end must not extend past the horse's tail. Keep the horse, the rider, … |
| gen_zhangfei stand | flat | 1 | Remove the tall white horn from the top of his hat. Keep everything else exactly the same. |
| gen_xiahoudun stand | flat | 1 | Replace his thin sword with a huge broad-bladed curved saber, held in the same hand with the blade pointing down and forward. … |
| inf attack | inf stand | 1 | Make him swing the sword forward in an attack pose, slashing toward the right with the sword extended in front of him, shield still on his back. KEEP |
| spear attack | spear stand | 1 | Make him thrust the spear forward to the right in an attack pose, lunging with both hands on the spear, the spear held level and pointing to the right. KEEP |
| **bow stand** | bow attack | 2 | Make him stop aiming and stand at ease, still in side view, profile, body and face turned to the right. He holds the short bow upright in his front hand with the arm lowered in front of him, the bowstring not drawn, and his other arm hangs down at his side. KEEP |
| cav attack | cav stand | 1 | Make the rider stab with the spear in an attack pose: he raises the spear overhead and thrusts it forward and downward to the right, the spear tip pointing toward the front of the horse. Keep the horse the same. KEEP |
| gen_guanyu attack | stand | 1 | Make him swing the crescent blade polearm forward in a powerful slashing attack pose toward the right, the golden blade in front of him. KEEP |
| gen_zhangfei attack | stand | 1 | Make him thrust the spear forward to the right in a fierce attack pose, shouting with his mouth open. KEEP |
| gen_xiahoudun attack (**수정 회차, 새 그림**) | 새 stand flat (`q/u2in_gen_xiahoudun2_stand.png`) | 1 | Make him swing the huge broad sword forward in a powerful slashing attack pose toward the right, lunging forward with the blade extended in front of him. He stays in side view, profile, face turned to the right, the black eyepatch stays on his visible eye. KEEP — (s2 는 칼을 등 뒤로 감아 버림. `batch_fix_qwen.sh`) |
| (폐기) gen_xiahoudun attack 옛 그림 | 옛 stand | 3 | Make him swing the huge saber forward … the black eyepatch stays on the same eye, the eye on the left side of his face in the picture … KEEP — `q/gen_xiahoudun_attack_s3.png` 로 남아 있다 |
| gen_dianwei attack | stand | 1 | Make him swing both axes forward in an attack pose toward the right, one axe slashing forward and the other raised. KEEP |
| inf_b stand · bow_b stand/attack | 초록 그림 | 1 | Change the green armor and cloth to royal blue. (bow: the green tunic and the green headscarf) + Keep everything else exactly the same: same pose, same face, same weapons, same size and position, same plain magenta background. |
| inf_b attack · spear_b stand/attack | 초록 그림 | 2 | Recolor every green part to royal blue: the green robe(scale armor, skirt), the green sleeves, the green trousers and the green boots all become royal blue. No green may remain anywhere in the image. + 위 꼬리 |
| cav_b stand (s4) / attack (s2) | 초록 그림 | 4 / 2 | Recolor every green part to royal blue: the rider's green helmet, the rider's green armor, green sleeves, green trousers and green boots, and the green saddle cloth all become royal blue. The horse stays brown and the plume stays golden. No green may remain … |

파랑 attack 은 계약대로 **초록 attack 에서 색만** 바꿨다(자세를 다시 만들지 않음). bow 는 SDXL 이 당긴 자세를 줘서 **attack → stand** 방향으로 편집했다.

## 코드 쪽에 전할 수치 (128×160 좌표)

| 파일(g = b 동일) | 알파 bbox | 머리끝 y | 몸 높이 | 폭 | 발 무게중심 x |
|---|---|---|---|---|---|
| `inf_*_stand` | 30,21–128,152 | 23 | 129 | 98 | 60 |
| `inf_*_attack` | 11,33–128,152 | 34 | 118 | 117 | 45 |
| `spear_*_stand` | 1,7–117,152 | 22 | 130 | 116 | 63 |
| `spear_*_attack` | 0,31–128,152 | 44 | 108 | 128 | 43 |
| `bow_*_stand` | 22,19–104,152 | 21 | 131 | 82 | 60 |
| `bow_*_attack` | 34,8–119,152 | 22 | 130 | 85 | 63 |
| `cav_*_stand` | 0,3–128,152 | 5 | 147 | 128 | 63 |
| `cav_*_attack` | 12,2–128,152 | 4 | 148 | 116 | 60 |
| `gen_guanyu_stand` / `attack` | 12,0–126,152 / 0,5–128,152 | 10 / 16 | 142 / 136 | 114 / 128 | 64 / 49 |
| `gen_zhangfei_stand` / `attack` | 10,0–128,152 / 0,10–128,152 | 8 / 17 | 144 / 135 | 118 / 128 | 53 / 46 |
| `gen_xiahoudun_stand` / `attack` (수정 회차 새 그림) | 19,0–119,152 / 5,12–128,152 | 9 / 20 | 143 / 132 | 100 / 123 | 63 / 47 |
| `gen_dianwei_stand` / `attack` | 28,5–123,152 / 12,11–128,152 | 6 / 12 | 146 / 140 | 95 / 116 | 64 / 56 |

- stand 의 몸 높이: 병사 129~131 · 기병 147 · 무장 142~146(하후돈 143 — 투구 뾰족 끝이 y0 에 닿아 더 못 키운다) (계약 125~135 / 145~155 / 140~150). 「머리끝」은 위에서부터 불투명 폭이 bbox 높이의 9% 를 처음 넘는 행 — 창끝·투구 침·관우 관 끝처럼 가는 것은 머리로 안 쳤다.
- **attack 은 stand 와 같은 배율**이다(머리끝~발끝을 다시 재지 않았다) — 찌르기·베기로 몸을 낮춰서 머리끝이 6~22px 내려간다(창병이 가장 깊다). 교체만 해도 「숙이며 내지르는」 움직임이 난다.
- attack 은 무기가 앞으로 뻗어 오른쪽 변에 닿고, 몸통은 stand 보다 **7~15px 뒤**에 있다(그림 px — 0.36배면 3~5px). 코드의 공격 전진 8px 이 이를 덮고도 앞으로 나간다. 더 붙이고 싶으면 attack 텍스처일 때 x 오프셋 +4px(화면 px) 정도.
- spear attack 은 창 자루 끝 8px, guanyu attack 은 4px 이 **왼쪽 변에서 잘린다**(무기 날 쪽을 살리려고 뒤쪽을 잘랐다). 자루라 티가 안 난다. 하후돈 새 attack 은 안 잘린다(칼끝이 오른쪽 변 안에 들어오게 그림 전체를 3px 왼쪽으로 옮겼다).
- zhangfei stand 는 사모가 오른쪽 변에 닿아 발 중심이 x 53 (가운데에서 −11px), inf stand 는 x 60. 그림자 타원이 0.46배에서 5px 쯤 앞에 놓인다 — 거슬리면 무장별 x 보정.
- 파랑은 초록의 bbox 에 맞춰 넣어 **픽셀 단위로 같은 자리**다(표의 수치가 g = b).
- 하후돈(수정 회차 새 그림)은 나머지 무장과 같은 **옆모습**이고 stand·attack 둘 다 오른쪽 보기다(코·턱·투구 챙 끝이 오른쪽, 귀가 왼쪽, 장화 코 오른쪽). 안대는 보이는 쪽 눈. 칼은 푸른 날의 대도. 컷인·초상(`cutin/`, `hud/portrait_xiahoudun`)의 투구 모양과는 다르다 — 0.46배에서는 「푸른 뾰족 투구 + 푸른 망토 + 안대」 로만 읽힌다.
- 게임 배율 확인: `assets/raw/battle2/units/_mock_scale.png`(ground.png 위에 병사 0.414배 = 0.36×줌 1.15, 무장 0.53배, 적은 flipX — 2배 확대 저장). 방패+칼 / 세로 창+비늘 / 두건+활 / 말 / 무장 넷이 갈리고 초록·파랑이 한눈에 갈린다.

## 검증 수치 (`u2post.py measure`, 일회성 스크립트)

- 24장 전부 128×160 RGBA, 발끝 y=152, 알파 0 RGB 0. **떨어진 조각: 알파>0 / >64 / >128 어느 기준(8-이웃)으로도 장당 1**(`u2fix.py measure`). 1차 보고의 «조각 1» 은 알파>0 기준만 본 것이라 흐린 실로 매달린 점(bow_b_stand·gen_zhangfei_stand·gen_zhangfei_attack·cav_b_stand·bow_g_stand)을 놓쳤다.
- 초록 편 불투명 픽셀 중 초록(H 65~175) 20~40% · 파랑 0~11%(투구 강철빛) / 파랑 편 초록 0~1% · 파랑(H 200~260) 18~60%. 기병은 말이 넓어 편 색 비율이 낮지만(18~22%) 투구·갑옷·안장 덮개가 전부 편 색.
- 자홍 잔여: `u2fix.py measure` 기준(H 283~332·S>0.5·V>0.35) **24장 전부 0**, 검수 기준(H 280~335·S>0.6·G<110 의 밝은 픽셀)도 0. V<0.35 의 어두운 보랏빛은 animagine 의 선 색이라 잔여로 치지 않는다. 하후돈 stand(SDXL 직접 키잉)의 민트 배경 잔여(거리<38) 0. 안쪽 3px 이하 구멍 0. (1차 값은 장당 0~14px)
- 궁병 상체(x40~85, y40~75) 초록 평균: stand (99,141,57) / attack (85,128,53) — 수정 전 attack (68,120,62).
- `node tools/smoke.mjs` PASS(u2_ 24키 크기·알파).

## 수정 회차 (검수 지적 → 고친 것)

| 파일 | 지적 | 고친 방법 |
|---|---|---|
| `gen_xiahoudun_stand` (must) | **왼쪽 보기**였다(attack 은 오른쪽 보기 → 교체 때마다 방향이 뒤집힘). 하후돈만 3/4·모에 눈이라 세트에서 튐 | 먼저 검수 제안대로 attack → stand Qwen 편집을 해 봤으나(`q/gen_xiahoudun_stand_from_attack_s1·s2.png`) s1 은 안대가 사라지고 s2 는 **안대가 반대 눈**으로 갔다. → SDXL 로 옆모습 하후돈을 새로 뽑아(`fx_gen_xiahoudun_s34`, flip) **stand·attack 둘 다 교체**. 8배 머리 크롭으로 코·턱·챙 끝 오른쪽 / 귀 왼쪽 / 장화 코 오른쪽 / 안대 = 보이는 눈을 두 장 모두 확인(`raw/battle2/units/fix/_xhd2_head.png`, `_xhd_final.png`) |
| `gen_xiahoudun_attack` | 위와 같이 교체 | 새 stand 에서 Qwen s1(지시문은 위 표) → `unflat`(배치 유지) |
| `gen_zhangfei_stand` 외 | 자홍 잔여(머리카락 끝·어깨 3px, 사모 날 보랏빛), 하후돈 투구 분홍 점 | `u2fix.py clean`: 자홍(H 283~332·S>0.5·V>0.35) → 가장 가까운 비자홍 색, 옅은 보라(S 0.25~0.5)는 채도 0.3배(자홍 점이 실제로 있는 그림에서만). 24장에 돌려 bow 4장·cav_b_stand·cav_g_stand·gen_dianwei_attack·gen_zhangfei_stand·spear_b_attack 의 1~14px 이 바뀌었다 |
| `bow_g_attack` | 상체가 stand(연두)보다 짙은 청록 + 청록 속자락 → 교체 때 색 깜빡임 | `u2fix.py bowtunic`: 상체(y38~80)의 H 135~190·V 0.2~0.55 → H 104·S 0.55·V×1.35(stand 의 그늘 초록), 뒤쪽 청록 속자락(H 175~215) → 흰 속자락. bow_b_attack 의 옷 색은 그대로(둘 다 로열블루) |
| `bow_g_stand` `bow_b_stand` | 시위가 몸 위에서만 2px 띠로 남고 몸 밖은 키잉에 지워짐, 떨어진 부스러기 | `u2fix.py bowstring`: 같은 자리(y84 알파 135 · y85 알파 70, 색 236,232,222)에 활 양 끝(x 24~100)까지 선을 이어 그림 — Qwen 원본도 시위가 몸 앞을 지나 양 끝을 잇는다. 부스러기는 선에 흡수 + `clean` |
| `cav_b_attack` | Qwen 색 바꾸기가 안장 덮개 금 자수를 지움 | `u2fix.py cavblue`: **초록 attack 을 색상 이동만** 해서 다시 만듦(H 65~175 → 225 근처, S×1.1, V×1.27 — cav_b_stand 의 V 분포 .34/.66/.94 에 맞춤). 자수·자리 그대로, 파랑 21%·초록 0% |
| `gen_dianwei_attack` | 허벅지에 찢어진 듯한 살색 조각 | `u2fix.py dwthigh`: 상자(x44~82, y106~126) 안 살색 + 붙은 흰 하이라이트 133px → 갑옷색 (58,56,74)×명도 |
| `gen_guanyu_stand` `attack` | 머리카락 속 초록 점 | `u2fix.py hairdots`: 8px 이하 초록 성분 중 둘레 2px 의 80% 가 어두운 것 → 이웃 머리카락색 |
| `gen_zhangfei_attack` `cav_b_stand` 등 | 흐린 실로 매달린 1~4px 조각 | `clean` 의 despeck(알파>128·>64 기준 8px 미만 성분 제거) |
| 그대로 둔 것 | 전위 stand 의 가는 막대 무기, 기병 stand↔attack 의 창날 앞뒤 | 검수도 «그대로 둬도 된다» — 게임 배율에서 안 보임 |

1차와 바이트 단위로 같은 파일(안 건드림): `inf_*` 4장, `spear_g_*` 2장, `spear_b_stand`, `cav_g_attack`, `gen_dianwei_stand`. 1차 결과 24장은 `raw/battle2/units/fix/old/` 에 백업.

## 실패 기록 (다음에 피할 것)

- **방향은 무기가 아니라 얼굴·발로 판정한다.** 3/4 앞모습은 특히 헷갈린다 — 옛 하후돈 `st_gen_xiahoudun_s28` 은 칼을 오른쪽 뒤로 끌고 있어 «오른쪽 보기» 로 적고 flip 을 안 했는데, 투구 앞장식·입·턱이 왼쪽, 귀·목가리개가 오른쪽, 장화 코가 왼쪽인 **왼쪽 보기**였다. Qwen attack 은 지시문 «toward the right» 때문에 오른쪽 보기로 나와 stand↔attack 이 서로 반대 방향이 됐다. → 채택 전에 8배 머리 크롭으로 (1) 코·턱이 향한 쪽 (2) 귀가 있는 쪽(= 뒤) (3) 투구 앞장식·챙 (4) 장화 코 네 가지를 확인한다. stand 와 attack 을 나란히 놓고 같은 방향인지도 본다.
- 3/4 앞모습 + 안대는 Qwen 자세 편집에서 **안대가 사라지거나 반대 눈으로 간다**(attack→stand s1·s2 둘 다 실패, 1차의 stand→attack 도 3번 만에 성공). 옆모습이면 보이는 눈이 하나뿐이라 이 문제가 없다 — 무장은 처음부터 옆모습으로 뽑는다(`profile, from side` + 부정 `looking at viewer, big eyes, three quarter view`). 그래도 8장 중 3장은 머리만 크게 잘려 나온다(s33·s37·s38).
- 흰 옷의 푸른 그늘색은 민트/청록 배경과 가깝다(거리 56) → thr 40 이면 바지가 반투명해진다. 자홍 배경 미리보기(`preview.py`)로 확인하고 thr 을 25 로.
- 머리카락 반짝이·하이라이트가 배경색과 같으면 구멍이 나고, 그대로 flat 에 넣으면 Qwen 입력에 자홍 점으로 찍힌다 → `u2fix.py fillholes` 를 fit·flat 전에.
- 떨어진 조각은 알파>0 만 세면 안 잡힌다(알파 10~20 의 흐린 실이 본체와 이어 준다) → 알파>64·>128 기준으로도 센다.
- Qwen 색 바꾸기는 자잘한 무늬(안장 자수)를 지운다 → 무늬가 있는 그림은 후처리 색상 이동(`cavblue`)이 낫다: 자리·무늬가 그대로고 Qwen 파랑과 V 분포만 맞추면 구분이 안 된다.

- `game sprite, flat color, flat color background, no shadow` 를 넣으면 벡터풍 납작 그림 + **얼굴까지 검은 실루엣**(`_try1.png`). → 빼고 `chibi` + 명암 있는 기본 그림체로. `thick outline, cel shading, game sprite` 는 스티커 테두리(흰 외곽선)가 붙는다(`_try2.png`).
- `green plume` 은 머리보다 큰 **초록 불꽃 깃**이 된다(1차). → plume 을 빼고 부정에 `plume, aura, fire, magic`. 그래도 기병은 금빛 깃이 붙었는데 편 색이 아니라 그대로 뒀다.
- 이름 있는 무장(`guan yu` `dian wei` + `mature male, muscular`)은 `chibi` 를 무시하고 8등신으로 나온다(1차). → `chibi, big head, short legs` 를 앞세우고 `mature male, muscular` 를 빼고 부정에 `realistic proportions, tall, slender`. 반대로 병사에 `big head, short legs` 를 넣으면 2등신 투구 덩어리(2차) → 병사는 `chibi` 만. 결과 병사 3~3.5등신 · 무장 3등신.
- `facing to the right` 는 절반만 먹는다(8장 중 6장 왼쪽 보기) — flip 으로 해결. `blue background` 는 청록 (8~102,155~197,183~224), `green background` 는 민트 (128~179,227~233,183~211) 로 나온다. 옅은 민트는 살색과 거리 68 이라 thr 을 25 로 내려야 대머리가 안 뚫린다.
- 배경 장식: seed 21 계열은 왼쪽에 회문 띠, s23·s25 는 받침대·풀밭, s25(inf 2차)는 파편이 흩날린다 → 부정 `border, frame, debris` + 다른 seed.
- **긴 무기는 128×160 에 몸 높이를 못 맞추게 한다**: 활이 머리 위로 솟으면 위가, 기병 창이 말보다 길면 폭이 넘쳐 몸이 101px·117px 로 줄었다. SDXL 태그(`short bow`, `short spear, spear pointing up`)로는 안 줄고(`_stand5.png`) Qwen «Replace the long bow with a small short bow …» / «Make the spear much shorter …» 가 한 번에 됐다.
- 기병 창을 «앞으로 돌려라» 하면 Qwen 이 **창을 한 자루 더** 그린다(cav_fix_s2·s4·s5). 어깨에 멘 s1 을 stand 로 쓰고 attack 에서 앞으로 찌르게 했다.
- bow stand 첫 지시(«stand relaxed and lower the bow») 는 **정면을 보고 선다** → «still in side view, profile, body and face turned to the right» 를 못박는다.
- 하후돈 attack 은 고개가 돌면서 **안대가 반대쪽 눈으로** 간다(s1·s2) → «the eyepatch stays on … the eye on the left side of his face in the picture» 로 s3 에서 맞음.
- 색 바꾸기 «Change the green armor and cloth to blue» 는 **장화·바지·연두 소매를 초록으로 남긴다**(inf attack·spear·cav). 부위를 다 짚고 «No green may remain anywhere» 를 붙이면 대부분 되고, 기병의 연두 소매·허벅지는 seed 4장 모두 남아 후처리 `--degreen`(H 65~175·짙은 청록 160~192 → H 222, V×0.85)으로 마저 돌렸다.
- **Qwen 색 바꾸기는 그림을 2~3% 키운다**(발끝이 y154 로 내려갔다) → 초록과 같은 변환을 쓰면 안 되고 초록 bbox 자리·크기에 맞춘다(`unflat --same`).
- 자홍 배경을 Qwen 이 투구·갑옷에 **반사광 점**으로 찍어 거리 키잉에 점 구멍이 난다(하후돈 투구 7곳) → `--fillnear=250`(944×1104 에서 250px 미만 = 128×160 에서 5px 미만 구멍을 가까운 전경색으로).
- edit.py 는 `FluxKontextImageScale` 로 입력을 ~1MP 선호 해상도에 **비율 무시하고** 맞춘다(코드상 — 큰 입력과 시간 비교는 안 해 봤다. 448 입력으로 한 장 17~30초). 128:160(0.8) 그대로 넣으면 944×1104(0.855)로 7% 늘어나므로 입력 비율을 383:448 로 맞춰 넣었다.

## 파일 목록 (raw/battle2/units)

- `gen.sh` SDXL 래퍼 · `qedit.sh` Qwen 래퍼 · `u2post.py`(bg·key·fit·flat·unflat·shrink·measure·sheet) · `u2fix.py`(수정 회차: clean·bowstring·bowtunic·cavblue·hairdots·dwthigh·fillholes·debg·measure) · `sheet.py` 후보 시트 · `preview.py` 어두운/자홍 배경 미리보기
- `batch_try1·2.sh`(그림체 고르기) `batch_stand1~4.sh`(SDXL) `batch_qwen_fix.sh` `batch_attack1.sh` `batch_blue1·2.sh`(Qwen) `post_green.sh` `post_blue.sh` `post_fix.sh`(후처리 전체) · 수정 회차: `batch_fix_xhd.sh`(SDXL 하후돈 옆모습 seed 33~40 → `fx_gen_xiahoudun_s*.png`) `batch_fix_qwen.sh`(Qwen), `fix/`(판정 그림 `_*.png`, `old/` = 1차 결과 백업, `stage/` 시험본)
- `s3_*`·`st_*`·`s4_*`·`t1_*`·`t2_*` SDXL 원본, `m/` 키잉 마스터, `q/` Qwen 입력(`u2in_*`)·결과(`*_sN.png`), `out/` 128×160 결과(+ `.json` 배치 기록), `_*.png` 판정 그림(`_sheet_a/b/c.png` 3배 시트, `_mock_scale.png` 게임 배율 목업, `_xhd_green.png` 구멍 확인)

## 통합 회차 (2026-09-19) — 그림은 그대로, 코드가 맞춘 것

- 24장 전수 실측(`assets/raw/battle2/_integ_measure.py`): 전부 128×160 RGBA, 알파>32 bbox 아래 = y152, 알파>128 바닥도 y152 → origin (0.5, 0.95) 그대로.
- **`BattleScene.U2_ANCHOR`** [stand, attack] = 그림에서 「몸 중심 열」(128px 기준): inf 62/50 · spear 62/47 · bow 61/64 · cav 64/64 · guanyu 72/66 · zhangfei 57/51 · xiahoudun 66/52 · dianwei 75/60. 코드는 이 열이 `u.x`(그림자·발밑 링) 위에 오게 스프라이트를 민다 — attack 은 앞발이 stand 자리에 남고 뒷발이 뒤로 뻗는 자세라 몸통이 8~15px 뒤에 있어, 가운데(64) 기준으로만 두면 교체 순간 몸이 뒤로 튀었다. 재는 법: `_integ_feet.py`(아래 7행의 발 덩어리 + y60~125 몸통 무게중심) → 기준선 시트 `_integ_anchor_sheet.png` 로 눈 보정(전위 stand 는 뒤로 든 도끼 때문에 무게중심 71 보다 몸이 앞 — 75). **그림을 다시 뽑으면 이 표도 다시 재라**(smoke 는 표에 키가 있는지만 본다).
- 배율: 병사·기병 0.36(47·54px), 무장 0.46 → **0.5**(72px) — `assets/raw/battle2/preview.png` 에서 무장이 난전에 묻혀서.

## 3차 — 여성 무장 8장 (2026-09-19, docs/BATTLE_V3.md §3.2)

`gen_<guanyu|zhangfei|xiahoudun|dianwei>_<stand|attack>.png` 8장을 여성으로 교체(병사 16장은 그대로). 규격 그대로: 128×160 RGBA·오른쪽 보기·발끝 y152·stand 몸 높이 145~146. 기존 남성 8장은 `assets/raw/battle/male_v2/units2/`. 작업 폴더 `assets/raw/battle3/units/`(cand·q·m·out), 시트 `assets/raw/battle3/units_sheet.png`(3배), 게임 배율 목업 `units/_mock_scale.png`, 기준선 시트 `units/_anchor_sheet.png`.
**수위**: 전장 유닛은 SD 등신(치비)이라 **노출 없이 갑옷·전포**(BATTLE_V3.md §3.1). `gen_unit.sh` 부정에 `nsfw, explicit, nude, nipples, see-through, torn clothes, sex, cleavage, midriff, navel, bikini, swimsuit, bare legs, underwear, panties, school uniform` 이 박혀 있고 등급 태그는 `general`. 8장 모두 긴 옷·전신 갑옷.

### 순서 (위 「만드는 순서」와 같다 — 다른 점만)
1. **SDXL stand** `raw/battle3/batch_units1.sh`(seed 71~78 × 4명, 832×1216). 골격 `chibi, big head, short legs, 1girl, solo, full body, standing, profile, from side, facing to the right, looking to the side` + 아래 태그 + `simple background, <색> background`. 부정은 units2 공통 + `helmet, hat`(컷인·초상이 맨머리라 — 2차의 「하후돈 고깔 투구 ≠ 초상」 should 해소) + 위 수위 부정.
2. **오른쪽 보기로 + 덧대기** `units/padflip.py <src> q/in_<key>_stand.png --flip`: 채택 네 장이 전부 왼쪽 보기라 뒤집고, 좌우에 배경색을 덧대 1040×1216(= 383:448). 잘린 무기(하후돈 칼·전위 도끼)를 Qwen 이 이어 그릴 자리도 된다.
3. **Qwen stand 고치기** `batch_qstand.sh 1` → `q/gen_<key>_stand_s1.png`(944×1104). 관우만 한 번 더(아래).
4. `post_units.sh` — stand 키잉(`u2post.py key`, 관우 thr 22·나머지 40) → `fit --h=146` → (`flat`) → attack `unflat`(배치 유지) → `u2fix.py clean` → units2/ 로 복사. 다시 돌려 8장이 바이트 단위로 같음을 확인.
5. **Qwen attack** `batch_qattack.sh 1`(장비 채택) · `batch_qattack2.sh`(seed 2·3: 관우 s2 · 하후돈 s3 · 전위 s3 채택).

| 유닛 | SDXL 채택 | 유닛 태그 | 배경 | Qwen stand 지시(꼬리 = Keep the character, face, hair, outfit, colors, size, position and chibi art style exactly the same. Keep the plain flat background.) |
|---|---|---|---|---|
| gen_guanyu | `gen_guanyu_s74` | `guan yu, three kingdoms, very long hair, black hair, straight hair, green eyes, gold hair ornament, green armor, green robe, long green skirt, gold trim, green cape, pauldrons, gauntlets, holding polearm, guandao, crescent blade, boots` | blue → (135,202,196) | s1: Remove the golden crescent ring floating above her head. Replace her thin golden staff with a guandao: a polearm with a dark green shaft and a large silver crescent blade with gold fittings at its top end, held upright … → 날이 머리 위로 솟아 몸이 135px 로 줄었다 → **stand3 s1**(s1 결과에 다시): Tilt the polearm forward: she holds the single guandao diagonally in front of her with both hands, the shaft end near her feet and the crescent blade pointing forward to the right at the height of her face. The blade must not be higher than the top of her head. There is only one weapon in the image. |
| gen_zhangfei | `gen_zhangfei_s73` | `zhang fei, three kingdoms, black hair, high ponytail, messy hair, red eyes, grin, fang, red armor, black armor, black pants, pauldrons, gauntlets, red waist cape, holding spear, red spear, long spear, polearm, armored boots` | blue → (66,95,138) | Make her stand firmly with both feet flat on the ground, legs straight, body and face still in side view turned to the right. She holds the black spear with the red spearhead diagonally in front of her, the spearhead pointing forward and up but not higher than the top of her head. (원본은 뛰는 자세) |
| gen_xiahoudun | `gen_xiahoudun_s75` | `xiahou dun, three kingdoms, eyepatch, black eyepatch, dark blue hair, short hair, blue eyes, serious, blue armor, blue cape, pauldrons, gauntlets, armored skirt, blue pants, holding sword, huge sword, broadsword, dao, armored boots` | green → (126,214,196) | Make the huge broad sword shorter so that the entire blade is visible inside the image and the sword tip does not touch the image edge. She holds the sword with the blade pointing down and backward. The black eyepatch stays on the same eye. |
| gen_dianwei | `gen_dianwei_s72` | `dian wei, three kingdoms, very short hair, black hair, tomboy, dark skin, yellow eyes, serious, black armor, dark armor, blue sash, blue waist cloth, pauldrons, gauntlets, black pants, dual wielding, holding axe, battle axe, halberd, armored boots` | green → (108,183,186) | Complete the axe that is cut off at the image edge so that both axes are fully visible inside the image. She holds one axe in each hand, blades down. |

attack 지시문(꼬리 KEEP 은 위 표와 같다): 관우 s2 «… powerful slashing attack pose toward the right, the crescent blade in front of her on the right side. **The blade stays plain silver-white metal with no pink or purple reflection.** Her body and face stay turned to the right.» · 장비 s1 «thrust the spear forward to the right in a fierce attack pose, lunging with both hands on the spear, the spear held level and pointing to the right, shouting with her mouth open. She stays in side view, face turned to the right.» · 하후돈 s3 «… she lunges to the right and the sword blade points forward to the right side of the image, extended in front of her face. **The sword must not point to the left.** … the black eyepatch stays on her visible eye.» · 전위 s3 «… she holds one axe in each hand, the front axe slashing forward to the right and the other axe raised above her head behind her. **Both axes must be visible.** …»

### 수치 (128×160 좌표, `u2post.py measure` · `u2fix.py measure`)
| 파일 | 알파 bbox | 머리끝 y | 몸 높이 | 폭 | 발 중심 x |
|---|---|---|---|---|---|
| `gen_guanyu_stand` / `attack` | 1,4–128,152 / 0,17–128,152 | 6 / 18 | 146 / 134 | 127 / 128 | 54 / 48 |
| `gen_zhangfei_stand` / `attack` | 0,3–120,152 / 0,15–128,152 | 6 / 18 | 146 / 134 | 120 / 128 | 69 / 47 |
| `gen_xiahoudun_stand` / `attack` | 2,5–110,152 / 0,28–128,152 | 7 / 29 | 145 / 123 | 108 / 128 | 62 / 48 |
| `gen_dianwei_stand` / `attack` | 7,4–113,152 / 6,8–118,152 | 7 / 10 | 145 / 142 | 106 / 112 | 64 / 54 |

- 8장 전부 발끝 y152·알파 0 RGB 0·자홍 잔여 0·조각(알파>0/>64) 1. 방향: 8장 모두 코·턱이 오른쪽, 귀·뒷머리(장비 포니테일·하후돈 망토·관우 긴 머리)가 왼쪽, 장화 코 오른쪽(`units_sheet.png` 3배로 확인). 하후돈 안대는 stand·attack 둘 다 「보이는 쪽 눈」.
- attack 에서 장비 9px·관우 4px·하후돈 4px 이 **왼쪽 변에서 잘린다**(창 자루 끝·언월도 자루 끝·망토 끝 — 2차와 같은 처리).
- 하후돈 attack 은 깊이 숙여 머리끝이 22px 내려간다(2차 남성판은 11px).
- **`BattleScene.U2_ANCHOR` 를 다시 맞춰야 한다**(그림이 바뀌면 다시 재라던 표. art 갈래는 src 를 못 고친다 → 통합 담당): `units/anchor.py` 로 몸통 띠(y100~130) 가장 긴 구간 가운데를 재고 기준선 시트(`_anchor_sheet.png`)로 눈 보정한 값 — `gen_guanyu: [60, 56], gen_zhangfei: [60, 48], gen_xiahoudun: [60, 50], gen_dianwei: [53, 49]` (지금 값 [72,66]·[57,51]·[66,52]·[75,60] 은 남성판 기준이라 관우·전위가 발밑 링에서 12~22px(화면 6~11px) 앞으로 비껴 선다).
  - **(통합 2026-09-19) 실제로 넣은 값은 `[68,61]·[62,49]·[67,51]·[53,50]`** — 위 제안은 관우의 바닥까지 끄는 머리, 하후돈의 망토·뒤로 든 대도가 「가장 긴 불투명 구간」에 붙어 stand 가 8px 뒤로 쏠려 있었다. 8px 격자 시트(`assets/raw/battle3/units/_integ_grid_0·1.png`)로 몸통·두 발을 읽고 색으로 확인(관우 녹색 옷 y70~120 평균 열 66.7, 하후돈 다리 y132~150 가운데 67.5). 장비·전위는 제안과 ±2. docs/HANDOFF.md §9.9.

### 실패 기록 (3차)
- 관우 «held upright» 은 날이 머리 위로 솟아 fit 이 몸을 135px 로 줄인다. «Make the polearm shorter …» 는 **땅에 무기를 한 자루 더** 그린다(stand2 s1·s2) → «Tilt the polearm forward … There is only one weapon in the image.» 로 해결. 대신 얼굴이 3/4 로 돌았다(오른쪽 보기는 유지, attack 도 같은 3/4).
- 자홍 배경에서 Qwen 이 은빛 날을 **자홍 그라데이션**으로 칠한다(관우 attack s1 — 키잉에 뚫린다) → «The blade stays plain silver-white metal with no pink or purple reflection.»
- 하후돈 attack s1 은 칼을 등 뒤(왼쪽)로 뻗는다 → «The sword must not point to the left.» s2 는 안대가 눈 그늘처럼 뭉개졌고 s3 채택.
- 전위 attack s1 은 도끼 한 자루가 사라진다 → «one axe in each hand … Both axes must be visible.»
- 은빛 날은 청록 배경과 거리 55 → stand 키잉 thr 40 이면 날이 반투명(갈색으로 비친다) → 관우만 `--thr=22 --ramp=18`.
- `dian wei + very short hair + tomboy` 치비는 소년처럼 읽힌다(컷인·초상과 머리·피부·갑옷·쌍도끼가 같아 같은 인물로는 읽힌다) — 거슬리면 Qwen 으로 속눈썹·귀걸이를 더한다.
