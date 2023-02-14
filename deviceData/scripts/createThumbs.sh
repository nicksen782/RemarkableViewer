#!/bin/bash

# EXAMPLE: ./deviceData/scripts/createThumbs.sh png 180 210 6647bd38-4ff5-49cc-a3bc-f89c87fb2479
# EXAMPLE: ./deviceData/scripts/createThumbs.sh png 120 150 6647bd38-4ff5-49cc-a3bc-f89c87fb2479

# EXAMPLE: To redo the svgThumbs for all UUIDS in deviceData/pdf: 
# From the root of the project repository:
# for i in deviceData/pdf/*; do deviceData/scripts/createThumbs.sh png 180 210 "$(basename $i)"; done

# NORMAL OPERATION
FORMAT=$1
EXT=$1
PX_W=$2
PX_H=$3
UUID=$4

PT_W=$(echo $PX_W*0.75 | bc)
PT_H=$(echo $PX_H*0.75 | bc)
IDIR=deviceData/pdf/$UUID

echo "Arguments to createThumbs.sh: $FORMAT $EXT $PX_W $PX_H $UUID";

# Change to the document's directory so that these commands can be more relative.
cd $IDIR

# Make these directories if they do not already exist.
mkdir -p svg
mkdir -p svgThumbs

# Convert the svg files in the svg folder to smaller dimension png files in the svgThumbs folder.
# EXAMPLE COMMAND: rsvg-convert -w 135.00 -h 157.50 --format png -a svg/da22af33-0bc8-43b1-83cc-3d4becfebfc9.svg -o svgThumbs/da22af33-0bc8-43b1-83cc-3d4becfebfc9.png
for i in svg/*.svg; \
do \
    rsvg-convert \
    -w $PT_W \
    -h $PT_H \
    --format $FORMAT \
    -a \
    "$i" \
    -o "svgThumbs/$(basename $i .svg).png"; \
    \
done

# Convert the png files in the svgThumbs folder to smaller file sizes.
# EXAMPLE COMMAND: pngquant --ext .png --force 8 svgThumbs/da22af33-0bc8-43b1-83cc-3d4becfebfc9.png
for i in svgThumbs/*.png; \
do \
    pngquant --ext .png --force 8 "$i"; \
done
