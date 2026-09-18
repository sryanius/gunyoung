# icons/ 제작 기록 (재현용)

계약: SPEC §3 — `icons/` 11개, 64×64, 알파 PNG.
`gold food troops officer calendar cmd_domestic cmd_military cmd_personnel cmd_scheme cmd_diplomacy cmd_march`

## 결론: 경로 B(Pillow 직접 그리기) 로 통일

SDXL(A) 과 Pillow(B) 를 병행해 64px 에서 나란히 비교한 뒤 **B 를 채택**. 이유:
- 달력은 SDXL 이 반드시 숫자(글자)를 넣어 탈락, 옥새는 초록 배경과 색이 겹쳐 키잉 불가, 두루마리엔 글씨 모양 무늬.
- 창·괭이는 64px 로 줄이면 선 하나·갈고리가 됨. 투구·금괴는 예쁘지만 세트 간 조명·외곽선이 제각각.
- Pillow 판은 같은 외곽선 두께(≈2px)·2단 명암·하이라이트 규칙으로 11개가 한 세트로 읽히고, 알파가 진짜 투명.

작업 파일: `assets/raw/icons/` (스크립트·중간 결과·후보 전부 남김)

## B. Pillow 그리기 (채택)

```
PY="C:\pinokio\api\inteliweb-comfyui\app\env\Scripts\python.exe"
cd C:\claude\gunyoung\assets\raw\icons
%PY% draw_icons.py C:\claude\gunyoung\assets\raw\icons\pillow      # 11개 → pillow/{name}_256.png + pillow/{name}.png(64)
%PY% make_sheet.py pillow pillow\sheet_v4.png                       # 확인용(64 한 줄 + 3배 확대)
copy pillow\{name}.png ..\..\icons\{name}.png                        # 11개 복사
```

기법(`draw_icons.py`):
- 256×256 RGBA 에 그리고 `convert('RGBa').resize((64,64), LANCZOS)` — 프리멀티플라이드로 줄여 가장자리 검은 테 방지.
- **부품(part) 단위 외곽선**: 부품 마스크를 `GaussianBlur(8)` → 40 임계로 팽창시켜 짙은 갈색 `(38,24,16)` 을 먼저 칠하고 그 위에 밑색. 나중 부품의 외곽선이 앞 부품 위에 얹혀 겹치는 곳에 구분선이 생긴다.
- 명암: 밑색 위에 반평면/타원으로 클립한 반투명 검정(그늘) + 반투명 흰색(하이라이트). 팔레트는 파일 상단에 공용으로 고정(금·나무·쇠·붉은색·옥·청동·종이).
- 형태: 금괴=원보(배 몸통+돔), 쌀가마=자루+노끈+열린 입구의 흰 쌀, 창검=교차 창(붉은 술), 무장=관모+수염 흉상, 달력=붉은 머리띠+격자+표시일+고리 2, 괭이, 극(戟: 창날+초승달), 인장=청동 도장+인주, 두루마리=종이+축+낙관, 옥새=옥 받침+금테+거북 손잡이+붉은 인끈, 말=말머리(기사)+갈기+굴레.
- 수정 이력: v1→v2 `patch_v2.py`(돔 축소, 프레임 접촉 해소: 무장 관모/괭이 날/말·자루 여백, 옥새 아치→거북 손잡이, 극 자루 굵게), v3~v4 쌀가마 재설계(입구 위 쌀 무더기).

검증(파이썬): 11개 모두 `size=(64,64) mode=RGBA alpha extrema=(0,255)`, 네 귀 알파 0, 반투명 가장자리 픽셀 평균색이 외곽선 갈색(배경색 잔류 없음). 256 캔버스 가장자리 2px 알파 0(잘림 없음).

## A. SDXL 후보 (기록용 — 채택 안 함)

`sdxl_batch.sh` — `tools/gen.mjs --ckpt=animagine-xl-4.0.safetensors --w=1024 --h=1024 --steps=28 --cfg=5`, seed **11 / 22 / 33** (항목당 3개, 총 33장 → `raw/icons/sdxl/`, 콘택트 `sdxl_contact_all.png`).

프롬프트 틀: `masterpiece, best quality, very aesthetic, absurdres, game icon, {사물}, centered, simple background, green background, no humans, thick outline, glossy, still life, single object, front view`
부정: `lowres, worst quality, text, watermark, signature, logo, blurry, multiple objects, human, 1girl, 1boy, cropped, border, frame, hands`

| 항목 | 사물 태그 | 판정 |
|---|---|---|
| gold | gold bar, gold ingot, chinese sycee, shiny gold | 금괴 더미(여러 개). s22 무난 |
| food | rice bag, burlap sack, grain sack, rope tie | 흰 자루. s22 무난(비닐봉지 느낌) |
| troops | crossed spears, two spears, crossed weapons | s11 교차검 OK, s22·s33 3자루 |
| officer | chinese helmet, ancient armor helmet, red plume | 투구 3장 예쁘나 64px 에서 뭉개짐 |
| calendar | calendar, hanging scroll calendar, wooden board | 3장 모두 숫자 → 탈락 |
| cmd_domestic | hoe, farming hoe, wooden handle | 갈고리/빗자루+괭이(2사물)/망치 → 탈락 |
| cmd_military | spear, chinese spear, red tassel | s22 만 한 자루, 너무 가늘어 선 하나 |
| cmd_personnel | seal, red stamp seal, chinese seal, wooden stamp | 동물 무늬 떡/2사물 → 탈락 |
| cmd_scheme | scroll, paper scroll, rolled scroll, bamboo scroll | 글씨 무늬/여러 개 → 탈락 |
| cmd_diplomacy | jade seal, imperial jade seal, dragon carving, green jade | 초록 사물+초록 배경 → 키잉 불가 |
| cmd_march | horse head, war horse, black horse, bridle | 말머리 3장 양호(그러나 세트 불일치) |

키잉 후처리 `key_sdxl.py <in> <out> [허용거리 60]`: 네 귀 24px 평균을 배경색으로 잡고 색거리<60 인 픽셀 중 **가장자리와 이어진 연결성분만** 배경으로(scipy.ndimage.label — `ImageDraw.floodfill` 이 Pillow 12.3 에서 무반응이라 대체) → `MinFilter(3)` 1px 침식 → 트림 → 정사각 패딩 → RGBa Lanczos 64. 7장 시험 결과 `raw/icons/sdxl64/sheet_sdxl.png`.

Qwen-Image-Edit 는 쓰지 않았다(SDXL 3회 시도 조건 전에 B 로 결론).

## 다음 사람에게
- 아이콘 하나를 바꾸려면 `draw_icons.py` 의 해당 함수만 고치고 `draw_icons.py <출력폴더> <이름>` 으로 그 항목만 다시 그린 뒤 복사.
- 외곽선 색 `OUT` 과 팔레트를 UI(목재/옻칠/청동) 톤에 맞춰 두었으니 HUD 위에서 검은 테로 튀지 않는다. 밝은 양피지 위에서도 확인 완료(`sheet_zoom3x.png` 아래 줄).
