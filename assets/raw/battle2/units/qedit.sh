#!/bin/bash
# Qwen 지시 편집 래퍼. usage: qedit.sh <입력.png> <출력.png> <seed> "<영어 지시문>"
# edit.py 는 출력 폴더에 edit_gguf_NNNNN_.png 로 떨군다 → 「saved:」 줄에서 경로를 받아 원하는 이름으로 옮긴다.
IN="$1"; OUT="$2"; SEED="$3"; PROMPT="$4"
PY="/c/pinokio/api/inteliweb-comfyui/app/env/Scripts/python.exe"
TMP="/c/claude/gunyoung/assets/raw/battle2/units/q/_tmp_$$"; mkdir -p "$TMP"
T0=$(date +%s)
LOG=$(PYTHONIOENCODING=utf-8 "$PY" /c/claude/image-edit/edit.py -i "$IN" -p "$PROMPT" --turbo -s "$SEED" -o "$TMP" 2>&1)
F=$(echo "$LOG" | grep '^saved:' | head -1 | sed 's/^saved: //' | tr -d '\r')
if [ -n "$F" ] && [ -f "$F" ]; then mv "$F" "$OUT"; echo "OK $(basename "$OUT") seed=$SEED $(( $(date +%s) - T0 ))s"; else echo "FAIL $(basename "$OUT"): $LOG" | tail -5; fi
rm -rf "$TMP"
