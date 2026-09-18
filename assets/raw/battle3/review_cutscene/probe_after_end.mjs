// 검수 프로브: 전투 종료(result) 뒤 1.5초(화면이 sim 을 더 굴리는 구간) 안에 skill 이벤트가 나오는가 + 같은 50ms 스텝 안에 skill 이 둘 이상 나오는가
import { createBattle } from '../../../../src/battle/sim.js';
import * as data from '../../../../src/battle/data.js';
let after = 0, multi = 0, total = 0, endBySkillTick = 0;
for (let seed = 1; seed <= 30; seed++) {
  const b = createBattle({ seed, left: data.ARMY_LEFT, right: data.ARMY_RIGHT, aiControlled: true });
  b.command('left', 'charge'); b.command('right', 'charge');
  let endAt = null;
  for (let t = 0; t < 200000; t += 50) {
    b.step(50);
    const evs = b.drainEvents();
    const sk = evs.filter((e) => e.type === 'skill');
    total += sk.length;
    if (sk.length > 1) multi++;
    if (endAt != null && sk.length) after += sk.length;
    if (sk.length && evs.some((e) => e.type === 'end')) endBySkillTick++;
    if (endAt == null && b.result) endAt = t;
    if (endAt != null && t > endAt + 1500) break;
  }
}
console.log({ seeds: 30, totalSkills: total, skillsWithin1500msAfterEnd: after, stepsWithMultipleSkills: multi, endInSameStepAsSkill: endBySkillTick });
