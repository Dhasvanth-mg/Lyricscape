#!/bin/bash
# usage: sheet.sh prefix cols rows scale
FM=$(cd /c/Users/dhasv/Documents/Projects/Lyricscape && node -e "console.log(require('ffmpeg-static'))")
"$FM" -v error -y -framerate 1 -i "$1-%02d.png" -frames:v 1 -vf "scale=$4:-1,tile=$2x$3" "$1-sheet.png"
