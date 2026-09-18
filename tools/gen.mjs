#!/usr/bin/env node
// ComfyUI txt2img client — SDXL 체크포인트 하나로 한 장 뽑아 PNG 로 저장한다. 외부 의존성 0 (Node 22+).
//
//   node generate.mjs --base=http://127.0.0.1:8188 --ckpt=animagine-xl-4.0.safetensors \
//        --prompt="..." --neg="..." --w=832 --h=1216 --steps=28 --cfg=5 --seed=1 --out=out.png
//
// 흐름: POST /prompt (API 형식 워크플로) → GET /history/{id} 를 폴링 → GET /view 로 이미지 받기.
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const arg = (k, d) => { const h = args.find((a) => a.startsWith(`--${k}=`)); return h ? h.slice(k.length + 3) : d; };

const BASE = (arg('base', process.env.COMFY_BASE || 'http://127.0.0.1:8188')).replace(/\/$/, '');
const ckpt = arg('ckpt', '');
const prompt = arg('prompt', '');
const neg = arg('neg', '');
const W = Number(arg('w', 832)), H = Number(arg('h', 1216));
const steps = Number(arg('steps', 28)), cfg = Number(arg('cfg', 5));
const seed = Number(arg('seed', 1));
const sampler = arg('sampler', 'euler_ancestral'), scheduler = arg('scheduler', 'normal');
const out = arg('out', 'out.png');
const timeoutMs = Number(arg('timeout', 300000));
/* img2img: --init=<png> 를 /upload/image 로 올려 LoadImage → VAEEncode 를 잠재 입력으로, --denoise(0~1, 기본 1) */
const init = arg('init', '');
const denoise = Number(arg('denoise', 1));
/* ControlNet: --cn=<models/controlnet 안의 파일명> --cnimage=<조건 그림 png> [--cnstrength] [--cnend]
 *   조건 그림도 /upload/image 로 올린다. ControlNetApplyAdvanced 는 positive·negative 를 함께 받는다. */
const cn = arg('cn', '');
const cnImage = arg('cnimage', '');
const cnStrength = Number(arg('cnstrength', 1));
const cnEnd = Number(arg('cnend', 1));
if (!ckpt || !prompt) { console.error('--ckpt 와 --prompt 는 필수다'); process.exit(1); }

/** ComfyUI «API 형식» 워크플로 — 노드 id → {class_type, inputs}. 링크는 [노드id, 출력번호]. */
const workflow = {
  1: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: ckpt } },
  2: { class_type: 'CLIPTextEncode', inputs: { clip: ['1', 1], text: prompt } },
  3: { class_type: 'CLIPTextEncode', inputs: { clip: ['1', 1], text: neg } },
  4: { class_type: 'EmptyLatentImage', inputs: { width: W, height: H, batch_size: 1 } },
  5: {
    class_type: 'KSampler',
    inputs: {
      model: ['1', 0], positive: ['2', 0], negative: ['3', 0], latent_image: ['4', 0],
      seed, steps, cfg, sampler_name: sampler, scheduler, denoise: 1,
    },
  },
  6: { class_type: 'VAEDecode', inputs: { samples: ['5', 0], vae: ['1', 2] } },
  7: { class_type: 'SaveImage', inputs: { images: ['6', 0], filename_prefix: 'gunyoung' } },
};

/** 그림 하나를 올리고 ComfyUI 가 부르는 이름을 돌려준다 */
async function upload(file) {
  const buf = fs.readFileSync(file);
  const form = new FormData();
  form.append('image', new Blob([buf], { type: 'image/png' }), path.basename(file));
  form.append('overwrite', 'true');
  const up = await fetch(`${BASE}/upload/image`, { method: 'POST', body: form });
  if (!up.ok) { console.error(`POST /upload/image ${up.status}: ${await up.text()}`); process.exit(1); }
  const uj = await up.json();
  return uj.subfolder ? `${uj.subfolder}/${uj.name}` : uj.name;
}

if (init) {
  workflow[8] = { class_type: 'LoadImage', inputs: { image: await upload(init) } };
  workflow[9] = { class_type: 'VAEEncode', inputs: { pixels: ['8', 0], vae: ['1', 2] } };
  workflow[5].inputs.latent_image = ['9', 0];
  workflow[5].inputs.denoise = denoise;
  delete workflow[4];
  console.error(`  img2img: ${path.basename(init)} → denoise ${denoise}`);
}

if (cn) {
  if (!cnImage) { console.error('--cn 을 쓰면 --cnimage 도 필요하다'); process.exit(1); }
  workflow[10] = { class_type: 'LoadImage', inputs: { image: await upload(cnImage) } };
  workflow[11] = { class_type: 'ControlNetLoader', inputs: { control_net_name: cn } };
  workflow[12] = {
    class_type: 'ControlNetApplyAdvanced',
    inputs: {
      positive: ['2', 0], negative: ['3', 0], control_net: ['11', 0], image: ['10', 0],
      strength: cnStrength, start_percent: 0, end_percent: cnEnd,
    },
  };
  workflow[5].inputs.positive = ['12', 0];
  workflow[5].inputs.negative = ['12', 1];
  console.error(`  ControlNet: ${cn} · ${path.basename(cnImage)} · 세기 ${cnStrength} · ${Math.round(cnEnd * 100)}% 까지`);
}

const clientId = 'merc-' + Math.random().toString(36).slice(2);
const res = await fetch(`${BASE}/prompt`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ prompt: workflow, client_id: clientId }),
});
if (!res.ok) { console.error(`POST /prompt ${res.status}: ${await res.text()}`); process.exit(1); }
const { prompt_id: id, node_errors } = await res.json();
if (node_errors && Object.keys(node_errors).length) { console.error('노드 오류:', JSON.stringify(node_errors, null, 2)); process.exit(1); }
console.error(`  큐에 넣음: ${id} (${W}x${H}, ${steps}단계, cfg ${cfg}, seed ${seed})`);

const t0 = Date.now();
let outputs = null;
while (Date.now() - t0 < timeoutMs) {
  await new Promise((r) => setTimeout(r, 1500));
  const h = await fetch(`${BASE}/history/${id}`);
  if (!h.ok) continue;
  const j = await h.json();
  const entry = j[id];
  if (!entry) continue;
  if (entry.status && entry.status.status_str === 'error') {
    console.error('실행 오류:', JSON.stringify(entry.status.messages || entry.status, null, 2).slice(0, 2000));
    process.exit(1);
  }
  if (entry.outputs) { outputs = entry.outputs; break; }
}
if (!outputs) { console.error(`  ${timeoutMs / 1000}초 안에 안 끝났다`); process.exit(1); }

const imgs = Object.values(outputs).flatMap((o) => o.images || []);
if (!imgs.length) { console.error('출력 이미지가 없다'); process.exit(1); }
const im = imgs[0];
const q = new URLSearchParams({ filename: im.filename, subfolder: im.subfolder || '', type: im.type || 'output' });
const v = await fetch(`${BASE}/view?${q}`);
if (!v.ok) { console.error(`GET /view ${v.status}`); process.exit(1); }
const buf = Buffer.from(await v.arrayBuffer());
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(out, buf);
console.error(`  ✓ ${out} (${(buf.length / 1024).toFixed(0)} KB, ${((Date.now() - t0) / 1000).toFixed(1)}초)`);
console.log(JSON.stringify({ id, file: out, bytes: buf.length, seed, w: W, h: H }));
