#!/bin/bash
# 눈 띠용 얼굴 확대 — hi/eyes_<key>_in.png(1216×832) 을 img2img denoise 0.3 으로 다시 그려 디테일을 채운다. 같은 seed, 얼굴 태그만.
G=/c/claude/gunyoung/assets/raw/battle3/gen.sh; D=/c/claude/gunyoung/assets/raw/battle3; DEN="${1:-0.3}"
CN="multiple girls, 1boy, male, scenery, gradient background, hat, helmet"
F="close-up, face, eye focus, looking at viewer, detailed eyes, dramatic lighting, rim lighting, simple background"
$G eyes_guanyu 69 1216 832 "1girl, solo, mature female, guan yu, very long hair, black hair, sharp eyes, narrowed eyes, green eyes, cold expression, elegant, beautiful, gold hair ornament, green armor, $F, magenta background" "$CN" 5 28 "$D/hi/eyes_guanyu_in.png" $DEN
$G eyes_zhangfei 47 1216 832 "1girl, solo, mature female, zhang fei, black hair, messy hair, high ponytail, red eyes, fierce grin, fang, red spear, black armor, $F, green background" "$CN" 5 28 "$D/hi/eyes_zhangfei_in.png" $DEN
$G eyes_xiahoudun 41 1216 832 "1girl, solo, mature female, xiahou dun, eyepatch, black eyepatch, one eye covered, dark blue hair, short hair, blue eyes, cold expression, glaring, blue armor, blue cape, $F, pink background" "$CN" 5 28 "$D/hi/eyes_xiahoudun_in.png" $DEN
$G eyes_dianwei 44 1216 832 "1girl, solo, mature female, dian wei, very short hair, black hair, tomboy, yellow eyes, dark skin, stoic, expressionless, serious, black armor, $F, magenta background" "$CN" 5 28 "$D/hi/eyes_dianwei_in.png" $DEN
echo EYES_DONE
