#!/usr/bin/env node
// control-check.mjs — 3차(docs/BATTLE_V3.md §1·§2) 조종 선택·자동/수동·배속을 브라우저 없이 밟아 보는 헤드리스 점검 (개발용).
//
//   node assets/raw/battle3/control/control-check.mjs          2차 그림 없는 폴백 경로
//   node assets/raw/battle3/control/control-check.mjs --art    2차 그림이 다 있는 경로(무장기 아이콘 교체)
//
// Phaser 흉내는 assets/raw/battle/view-check.mjs 의 것을 그대로 빌린다 — 그 파일은 다른 갈래 소유라 고치지 않고,
// 「async function run()」 앞까지(흉내·manager·frame)를 잘라 control-check.body.js(이 점검의 run)를 이어 붙인 임시 모듈을 만들어 돌린다.
// view-check 의 흉내가 바뀌면 이 점검도 같이 따라간다.

import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const src = readFileSync(join(HERE, '..', '..', 'battle', 'view-check.mjs'), 'utf8');
const cut = src.indexOf('async function run()');
if (cut < 0) { console.error('view-check.mjs 에서 run() 을 못 찾음'); process.exit(1); }
const body = readFileSync(join(HERE, 'control-check.body.js'), 'utf8');
// view-check 는 ROOT 를 「자기 폴더에서 세 단계 위」로 잡는다 — 임시 모듈은 한 단계 더 깊으므로(battle3/control) 네 단계로 고쳐 쓴다
const head = src.slice(0, cut).replace("'..', '..', '..'));", "'..', '..', '..', '..'));");
const gen = join(HERE, '_control-check.gen.mjs');
writeFileSync(gen, `${head}\n${body}\n`, 'utf8');
try {
  await import(pathToFileURL(gen).href);
} finally {
  // run() 이 process.exit 로 끝나므로 여기엔 예외 때만 온다
  try { rmSync(gen); } catch (e) { /* 남아도 무해 */ }
}
