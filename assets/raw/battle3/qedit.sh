#!/bin/bash
# Qwen 지시 편집 래퍼(battle2/units/qedit.sh 와 같다, 임시 폴더만 battle3). usage: qedit.sh <입력.png> <출력.png> <seed> "<영어 지시문>"
IN="$1"; OUT="$2"; SEED="$3"; PROMPT="$4"
PY="/c/pinokio/api/inteliweb-comfyui/app/env/Scripts/python.exe"
TMP="/c/claude/gunyoung/assets/raw/battle3/units/q/_tmp_$$"; mkdir -p "$TMP"
T0=$(date +%s)
LOG=$(PYTHONIOENCODING=utf-8 "$PY" /c/claude/image-edit/edit.py -i "$IN" -p "$PROMPT" --turbo -s "$SEED" -o "$TMP" 2>&1)
F=$(echo "$LOG" | grep '^saved:' | head -1 | sed 's/^saved: //' | tr -d '\r')
if [ -n "$F" ] && [ -f "$F" ]; then mv "$F" "$OUT"; echo "OK $(basename "$OUT") seed=$SEED $(( $(date +%s) - T0 ))s"; else echo "FAIL $(basename "$OUT"): $LOG" | tail -5; fi
rm -rf "$TMP"
