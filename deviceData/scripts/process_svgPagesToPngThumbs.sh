#!/bin/bash

# EXAMPLE: ./deviceData/scripts/new/process_svgPagesToPngThumbs.sh "521755a0-1330-4ad7-afd4-100c2f961b4c" png 180 210

# EXAMPLE: To redo the svgThumbs for all UUIDS in deviceData/pdf: 
# From the root of the project repository:
# for i in deviceData/pdf/*; do deviceData/scripts/process_svgPagesToPngThumbs.sh "$(basename $i)" png 180 210; done

# NORMAL OPERATION
FORMAT=$1
EXT=$1
PX_W=$2
PX_H=$3
UUID=$4
PT_W=$(echo $PX_W*0.75 | bc)
PT_H=$(echo $PX_H*0.75 | bc)
INITIAL_DIR=deviceData/pdf/$UUID

# Make this directories if they do not already exist.
mkdir -p deviceData/pdf/$UUID
mkdir -p deviceData/pdf/$UUID/svg
mkdir -p deviceData/pdf/$UUID/svgThumbs

# Remove existing .svg files from the directory.
for i in deviceData/pdf/$UUID/svgThumbs/*.png; do [ -f "$i" ] || continue; rm "$i"; done

# Change to the document's directory so that these commands can be more relative.
cd $INITIAL_DIR

# Convert the svg files in the svg folder to smaller dimension png files in the svgThumbs folder.
# EXAMPLE COMMAND: rsvg-convert -w 135.00 -h 157.50 --format png -a svg/da22af33-0bc8-43b1-83cc-3d4becfebfc9.svg -o svgThumbs/da22af33-0bc8-43b1-83cc-3d4becfebfc9.png
for i in svg/*.svg; \
do \
    [ -f "$i" ] || continue;\
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