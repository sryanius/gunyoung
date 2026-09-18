# cutin_preview.py — (3차 통합) 무장 네 명의 컷신 「멈춘 장면」(t=1000ms) 합성 미리보기. 브라우저 대체(근사).
#   진짜 src/battle/cutin.js 를 Phaser 흉내 위에서 돌린 상태 덤프(cutscene/dump_frames.mjs → frames.json)를
#   Pillow 로 합성(cutscene/mock_frames.py)한 장면 중 네 명의 hold 컷을 1558×720 그대로
#   assets/raw/battle3/cutin_preview_<key>.png 로 떨군다. 얼굴 중심(CUTIN_ART.faceU/faceV)이 화면 어디에 오는지 작은 십자로 찍고,
#   그 x 에서의 패널 창 위·아래 끝과 여백을 콘솔에 찍는다 → cutin.js 의 배율·faceIn·faceU/V 를 고치고 다시 돌려 눈으로 본다.
#   아군(관우·장비)은 그림이 오른쪽, 적(하후돈·전위)은 좌우 반전해 왼쪽 — 게임과 같은 편으로 찍는다.
#   usage: python assets/raw/battle3/cutin_preview.py [W=1558]
import io, json, math, os, re, shutil, subprocess, sys
from PIL import Image, ImageDraw

try:
    sys.stdout.reconfigure(encoding='utf-8')   # 윈도 콘솔(cp949)에서 「—」·「×」 가 죽지 않게
except Exception:
    pass
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..', '..'))
CUT = os.path.join(HERE, 'cutscene')
W = int(sys.argv[1]) if len(sys.argv) > 1 else 1558
H = 720

subprocess.run(['node', os.path.join(CUT, 'dump_frames.mjs'), str(W)], check=True)
subprocess.run([sys.executable, os.path.join(CUT, 'mock_frames.py')], check=True)

src = io.open(os.path.join(ROOT, 'src', 'battle', 'cutin.js'), encoding='utf-8').read()
ART = {m.group(1): (float(m.group(2)), float(m.group(3)))
       for m in re.finditer(r"(\w+):\s*\{ color: 0x[0-9a-fA-F]+, faceU: ([\d.]+), faceV: ([\d.]+)", src)}
BAND_H = float(re.search(r"const BAND_H = ([\d.]+)", src).group(1))
TILT = float(re.search(r"const TILT_DEG = (-?[\d.]+)", src).group(1))

D = json.load(open(os.path.join(CUT, 'frames.json'), encoding='utf-8'))
SHOT = {'guanyu': 'L_1000_hold', 'zhangfei': 'Z_1000_hold', 'xiahoudun': 'R_1000_hold', 'dianwei': 'D_1000_hold'}
suffix = '' if W == 1558 else f'_{W}'
ok_all = True
for key, sid in SHOT.items():
    shot = next(s for s in D['shots'] if s['id'] == sid)
    # 본체 = 가산·tintFill 이 아닌 cutin_<key> 이미지
    art = next(o for o in shot['objs'] if o['kind'] == 'image' and o.get('key') == f'cutin_{key}' and o['blend'] == 0 and not o['tintFill'])
    u, v = ART[key]
    flip = -1 if art['flipX'] else 1
    fx = art['x'] + (u - 0.5) * art['width'] * art['scaleX'] * flip
    fy = art['y'] + (v - 0.5) * art['height'] * art['scaleY']
    m = -1 if art['flipX'] else 1                      # 적 편은 기울기 반대
    a = math.radians(TILT * m)
    cy = H / 2 + math.tan(a) * (fx - W / 2)
    win = H * BAND_H / math.cos(a)
    top, bot = cy - win / 2, cy + win / 2
    top_v, bot_v = max(0, top), min(H, bot)             # 화면 안에서 실제로 보이는 창
    # 머리 위 끝 어림: 얼굴 중심에서 그림 높이의 12% 위(정수리·머리 장식), 턱·목: 8% 아래
    dispH = art['height'] * art['scaleY']
    head_top, chin = fy - 0.12 * dispH, fy + 0.08 * dispH
    ok = head_top >= top_v - 20 and chin <= bot_v - 40 and 0 < fx < W
    ok_all &= ok
    print(f"{key:10s} {'ok ' if ok else 'BAD'} 얼굴 ({fx:6.0f},{fy:5.0f}) · 패널 창 y {top:5.0f}~{bot:5.0f}(보이는 {top_v:.0f}~{bot_v:.0f}) · 창 안 {100 * (fy - top) / win:4.1f}% · "
          f"머리 위 끝 {head_top:5.0f} · 턱 {chin:5.0f} · 그림 {art['width'] * art['scaleX']:.0f}×{dispH:.0f}px")
    im = Image.open(os.path.join(CUT, f'shot_{sid}.png')).convert('RGB')
    d = ImageDraw.Draw(im)
    d.line([(fx - 9, fy), (fx + 9, fy)], fill=(0, 255, 255), width=1)
    d.line([(fx, fy - 9), (fx, fy + 9)], fill=(0, 255, 255), width=1)
    for yy in (top_v, bot_v):                            # 얼굴 x 에서의 패널 창 끝(화면 가장자리에 눈금)
        ex = W - 1 if m > 0 else 0
        d.line([(ex - 14 * m, yy), (ex, yy)], fill=(0, 255, 255), width=3)
    out = os.path.join(HERE, f'cutin_preview_{key}{suffix}.png')
    im.save(out)
# 네 장을 한 장으로(반 크기) — 한눈에
tw, th = W // 2, H // 2
sheet = Image.new('RGB', (tw * 2, th * 2), (0, 0, 0))
for i, key in enumerate(SHOT):
    sheet.paste(Image.open(os.path.join(HERE, f'cutin_preview_{key}{suffix}.png')).resize((tw, th), Image.LANCZOS), ((i % 2) * tw, (i // 2) * th))
sheet.save(os.path.join(HERE, f'cutin_preview_sheet{suffix}.png'))
print('PASS' if ok_all else 'FAIL', '—', f'cutin_preview_<key>{suffix}.png ×4 + cutin_preview_sheet{suffix}.png')
sys.exit(0 if ok_all else 1)
