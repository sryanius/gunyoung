// 목업용: sim 을 N초 굴려 유닛 위치를 JSON 으로 (연출 코드 담당의 Pillow 목업 _code_mock.py 입력)
import { createBattle } from '../../../src/battle/sim.js';
import { ARMY_LEFT, ARMY_RIGHT } from '../../../src/battle/data.js';
import { writeFileSync } from 'node:fs';
const secs = Number(process.argv[2] || 20);
const b = createBattle({ seed: 1, left: ARMY_LEFT, right: ARMY_RIGHT });
b.command('left', 'charge'); b.command('right', 'charge');
const deaths = [];
for (let i = 0; i < secs * 60; i++) { b.step(16.667); for (const e of b.drainEvents()) if (e.type === 'death') deaths.push({ x: e.x, y: e.y, id: e.id }); }
const units = b.units.filter((u) => u.state !== 'gone' && u.state !== 'dead').map((u) => ({ id: u.id, x: u.x, y: u.y, kind: u.kind, side: u.side, facing: u.facing, state: u.state, attackT: u.attackT, key: u.key, name: u.name, generalId: u.generalId }));
writeFileSync(new URL('./_code_units.json', import.meta.url), JSON.stringify({ units, deaths, player: b.playerOf('left').id }));
console.log('units', units.length, 'deaths', deaths.length);
