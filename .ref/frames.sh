#!/bin/bash
# usage: frames.sh <video-id-prefix> <out-prefix> <start> <end> <step> [scale]
FM=$(cd /c/Users/dhasv/Documents/Projects/Lyricscape && node -e "console.log(require('ffmpeg-static'))")
U=/c/Users/dhasv/.claude/uploads/b6aad101-dd66-4d82-b22b-f719dda224ec
F=$(ls $U/$1*.mp4 | head -1)
OUT=/c/Users/dhasv/Documents/Projects/Lyricscape/.ref
sc=${6:-360}
i=0
for t in $(seq $3 $5 $4); do
  "$FM" -v error -y -ss $t -i "$F" -frames:v 1 -vf "scale=$sc:-1" "$OUT/$2-$(printf %04d $i).png"
  i=$((i+1))
done
