#!/bin/bash
# 전장 SD 무장 stand 후보 — units2/NOTES.md 의 무장 골격(옆모습) 그대로, 1boy→1girl, 컷인과 같은 머리·옷 색. seed 71~78.
G=/c/claude/gunyoung/assets/raw/battle3/gen_unit.sh
SK="chibi, big head, short legs, 1girl, solo, full body, standing, profile, from side, facing to the right, looking to the side"
for s in 71 72 73 74 75 76 77 78; do
  $G gen_guanyu $s "$SK, guan yu, three kingdoms, very long hair, black hair, straight hair, green eyes, gold hair ornament, green armor, green robe, long green skirt, gold trim, green cape, pauldrons, gauntlets, holding polearm, guandao, crescent blade, boots, simple background, blue background" "red armor, blue armor"
  $G gen_zhangfei $s "$SK, zhang fei, three kingdoms, black hair, high ponytail, messy hair, red eyes, grin, fang, red armor, black armor, black pants, pauldrons, gauntlets, red waist cape, holding spear, red spear, long spear, polearm, armored boots, simple background, blue background" "green armor, blue armor"
  $G gen_xiahoudun $s "$SK, xiahou dun, three kingdoms, eyepatch, black eyepatch, dark blue hair, short hair, blue eyes, serious, blue armor, blue cape, pauldrons, gauntlets, armored skirt, blue pants, holding sword, huge sword, broadsword, dao, armored boots, simple background, green background" "red armor, green armor, long hair"
  $G gen_dianwei $s "$SK, dian wei, three kingdoms, very short hair, black hair, tomboy, dark skin, yellow eyes, serious, black armor, dark armor, blue sash, blue waist cloth, pauldrons, gauntlets, black pants, dual wielding, holding axe, battle axe, halberd, armored boots, simple background, green background" "red armor, green armor, long hair"
done
echo UNITS1_DONE
