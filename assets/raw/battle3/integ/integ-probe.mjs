#!/usr/bin/env node
// integ-probe.mjs — (3차 통합) 컷신·배속·자동을 여러 seed 로 끝까지. view-check.mjs 의 Phaser 흉내를 control-check 와 같은 방식으로 빌린다.
//   node assets/raw/battle3/integ/integ-probe.mjs [--art]
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const HERE = fileURLToPath(new URL('.', import.meta.url));
const src = readFileSync(join(HERE, '..', '..', 'battle', 'view-check.mjs'), 'utf8');
const cut = src.indexOf('async function run()');
if (cut < 0) { console.error('view-check.mjs 에서 run() 을 못 찾음'); process.exit(1); }
const head = src.slice(0, cut).replace("'..', '..', '..'));", "'..', '..', '..', '..'));");
const gen = join(HERE, '_integ-probe.gen.mjs');
writeFileSync(gen, `${head}\n${readFileSync(join(HERE, 'integ-probe.body.js'), 'utf8')}\n`, 'utf8');
try { await import(pathToFileURL(gen).href); } finally { try { rmSync(gen); } catch (e) { /* 무해 */ } }
