# 수정 회차: assets/battle/units2/NOTES.md 갱신(일회성)
import io, os
p = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..', 'battle', 'units2', 'NOTES.md')
s = io.open(p, encoding='utf-8').read()

def rep(old, new):
    global s
    assert old in s, old[:50]
    s = s.replace(old, new, 1)

rep(u"""   전체 후처리는 **`post_green.sh` → `post_blue.sh`** 두 개로 재현된다(→ `out/*.png` → 이 폴더로 복사).""",
u"""6. **수정 회차 후처리** — `u2fix.py`(128×160 결과 위에서: 자홍 잔여·떨어진 조각·궁병 시위·궁병 상체색·파랑 기병 attack·머리카락 점·전위 허벅지·배경색 잔여). 아래 「수정 회차」 절.
   전체 후처리는 **`post_green.sh` → `post_blue.sh` → `post_fix.sh`** 세 개로 재현된다(→ `out/*.png` → 이 폴더로 복사. 다시 돌려 24장이 바이트 단위로 같음을 확인했다).""")

rep(u"""| gen_xiahoudun | `st_gen_xiahoudun_s28` (28) | `xiahou dun, three kingdoms, eyepatch, short beard, black hair, blue armor, blue cape, ancient chinese armor, helmet, holding sword, huge sword, broadsword, dao, boots` | green → (128,227,183) | 오른쪽 보기(3/4). 칼이 가늘어 Qwen 으로 대도로 교체 |""",
u"""| gen_xiahoudun | **`fx_gen_xiahoudun_s34` (34)** — 수정 회차에서 교체 | 골격이 다르다: `chibi, big head, short legs, 1boy, solo, full body, standing, profile, from side, facing to the right, looking to the side` + `xiahou dun, three kingdoms, eyepatch, black eyepatch, short beard, stubble, black hair, mature male face, blue armor, blue cape, ancient chinese armor, blue helmet, holding sword, huge sword, broadsword, dao, curved blade, boots`, 부정에 `looking at viewer, big eyes, three quarter view, wings, feather` 추가 (`batch_fix_xhd.sh`, seed 33~40) | green → (115,205,178) | **옆모습 왼쪽 보기 → flip**. 배경 민트가 흰 바지의 그늘색 (132,152,179) 과 거리 56 → `--thr=25 --ramp=20`. 머리카락 속 반짝이 점이 배경색이라 뚫린다 → `u2fix.py fillholes`. (옛 그림 `st_gen_xiahoudun_s28` 은 1차 보고에 «오른쪽 보기(3/4)» 라 적었으나 **실제는 왼쪽 보기**였다 — 아래 실패 기록) |""")

rep(u"""| gen_xiahoudun attack | stand | 3 | Make him swing the huge saber forward in a slashing attack pose toward the right. His face stays exactly the same as in the original: the black eyepatch stays on the same eye, the eye on the left side of his face in the picture, and his uncovered blue eye stays on the right side of his face. KEEP |""",
u"""| gen_xiahoudun attack (**수정 회차, 새 그림**) | 새 stand flat (`q/u2in_gen_xiahoudun2_stand.png`) | 1 | Make him swing the huge broad sword forward in a powerful slashing attack pose toward the right, lunging forward with the blade extended in front of him. He stays in side view, profile, face turned to the right, the black eyepatch stays on his visible eye. KEEP — (s2 는 칼을 등 뒤로 감아 버림. `batch_fix_qwen.sh`) |
| (폐기) gen_xiahoudun attack 옛 그림 | 옛 stand | 3 | Make him swing the huge saber forward … the black eyepatch stays on the same eye, the eye on the left side of his face in the picture … KEEP — `q/gen_xiahoudun_attack_s3.png` 로 남아 있다 |""")

rep(u"""| `gen_xiahoudun_stand` / `attack` | 4,0–109,152 / 0,9–128,152 | 6 / 15 | 146 / 137 | 105 / 128 | 62 / 42 |""",
u"""| `gen_xiahoudun_stand` / `attack` (수정 회차 새 그림) | 19,0–119,152 / 5,12–128,152 | 9 / 20 | 143 / 132 | 100 / 123 | 63 / 47 |""")
rep(u"""- stand 의 몸 높이: 병사 129~131 · 기병 147 · 무장 142~146""",
u"""- stand 의 몸 높이: 병사 129~131 · 기병 147 · 무장 142~146(하후돈 143 — 투구 뾰족 끝이 y0 에 닿아 더 못 키운다)""")
rep(u"""- spear attack 은 창 자루 끝 8px, guanyu attack 은 4px, xiahoudun attack 은 망토 끝 1px 이 **왼쪽 변에서 잘린다**""",
u"""- spear attack 은 창 자루 끝 8px, guanyu attack 은 4px 이 **왼쪽 변에서 잘린다**. 하후돈 새 attack 은 안 잘린다(칼끝이 오른쪽 변 안에 들어오게 그림 전체를 3px 왼쪽으로 옮겼다) —""")
rep(u"""- 하후돈은 3/4 앞모습(얼굴이 화면 쪽) — 나머지는 옆모습. 안대는 그림에서 얼굴 왼쪽 눈(flipX 하면 오른쪽).""",
u"""- 하후돈(수정 회차 새 그림)은 나머지 무장과 같은 **옆모습**이고 stand·attack 둘 다 오른쪽 보기다(코·턱·투구 챙 끝이 오른쪽, 귀가 왼쪽, 장화 코 오른쪽). 안대는 보이는 쪽 눈. 칼은 푸른 날의 대도. 컷인·초상(`cutin/`, `hud/portrait_xiahoudun`)의 투구 모양과는 다르다 — 0.46배에서는 「푸른 뾰족 투구 + 푸른 망토 + 안대」 로만 읽힌다.""")

rep(u"""- 24장 전부 128×160 RGBA, 발끝 y=152, 떨어진 조각 1(4px 미만 점 제거), 알파 0 RGB 0.""",
u"""- 24장 전부 128×160 RGBA, 발끝 y=152, 알파 0 RGB 0. **떨어진 조각: 알파>0 / >64 / >128 어느 기준(8-이웃)으로도 장당 1**(`u2fix.py measure`). 1차 보고의 «조각 1» 은 알파>0 기준만 본 것이라 흐린 실로 매달린 점(bow_b_stand·gen_zhangfei_stand·gen_zhangfei_attack·cav_b_stand·bow_g_stand)을 놓쳤다.""")
rep(u"""- 자홍 잔여(H 280~335, S>0.45) 장당 0~12px(128×160 기준), 안쪽 3px 이하 구멍 0.""",
u"""- 자홍 잔여: `u2fix.py measure` 기준(H 283~332·S>0.5·V>0.35) **24장 전부 0**, 검수 기준(H 280~335·S>0.6·G<110 의 밝은 픽셀)도 0. V<0.35 의 어두운 보랏빛은 animagine 의 선 색이라 잔여로 치지 않는다. 하후돈 stand(SDXL 직접 키잉)의 민트 배경 잔여(거리<38) 0. 안쪽 3px 이하 구멍 0. (1차 값은 장당 0~14px)
- 궁병 상체(x40~85, y40~75) 초록 평균: stand (99,141,57) / attack (85,128,53) — 수정 전 attack (68,120,62).""")

rep(u"""## 실패 기록 (다음에 피할 것)
""",
u"""## 수정 회차 (검수 지적 → 고친 것)

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
""")

rep(u"""`u2post.py`(bg·key·fit·flat·unflat·shrink·measure·sheet) · `sheet.py`""",
u"""`u2post.py`(bg·key·fit·flat·unflat·shrink·measure·sheet) · `u2fix.py`(수정 회차: clean·bowstring·bowtunic·cavblue·hairdots·dwthigh·fillholes·debg·measure) · `sheet.py`""")
rep(u"""`post_green.sh` `post_blue.sh`(후처리 전체)""",
u"""`post_green.sh` `post_blue.sh` `post_fix.sh`(후처리 전체) · 수정 회차: `batch_fix_xhd.sh`(SDXL 하후돈 옆모습 seed 33~40 → `fx_gen_xiahoudun_s*.png`) `batch_fix_qwen.sh`(Qwen), `fix/`(판정 그림 `_*.png`, `old/` = 1차 결과 백업, `stage/` 시험본)""")

io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('NOTES.md 갱신')
