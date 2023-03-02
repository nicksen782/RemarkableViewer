#!/bin/bash

# EXAMPLE: ./deviceData/scripts/process_pdfToSvgPages.sh "6647bd38-4ff5-49cc-a3bc-f89c87fb2479" "Progress.pdf"
# NOTE: This DOES rename the files in the ./svg folder. 

# Command arguments.
UUID=$1
FILENAME=$2

# Make this directories if they do not already exist.
mkdir -p deviceData/pdf/$UUID
mkdir -p deviceData/pdf/$UUID/svg
mkdir -p deviceData/pdf/$UUID/svgThumbs

# Remove existing .svg files from the directory.
for i in deviceData/pdf/$UUID/svg/*.svg; do [ -f "$i" ] || continue; rm "$i"; done

# Split the .pdf into .svg pages.
pdf2svg "deviceData/pdf/$UUID/$FILENAME" "deviceData/pdf/$UUID/svg/output-page%04d.svg" all;

###
# Rename the .svg files in the ./svg folder to match the pageId names.
###

# Get the list of .svg files in ./svg and sort them alphabetically.
SVGPAGES=($(find deviceData/pdf/$UUID/svg -type f | sort))

# Find the DocumentType record in rm_fs.json for this uuid.
RECORD=$(jq --arg uuid "$UUID" '.DocumentType[] | select(.uuid == $uuid)' < deviceData/config/rm_fs.json)
PAGES=
PAGES_ARRAY=

# Make sure that a record was found.
if [ -z "$RECORD" ]; then
    echo "Record in DocumentType having uuid: $UUID was not found"
    exit 1

# Record was found.
else
    # Break out the pages json array into a bash array.
    PAGES=$(echo "$RECORD" | jq -r '.pages[]')
    PAGES_ARRAY=($PAGES)

    # Make sure that the PAGES_ARRAY and the SVGPAGES have the same length.
    [ "${#PAGES_ARRAY[@]}" -ne "${#SVGPAGES[@]}" ] && echo "Arrays have different length" && exit 1;

    # Go through each page in the PAGES_ARRAY. Rename the .svg files to match the page id of each page.
    # These filename are expected to be in alphabetical order.
    for i in $(seq 0 $(( ${#PAGES_ARRAY[@]} - 1 )) ); do
        ORIGINALFILENAME=$(basename ${SVGPAGES[i]})
        mv "deviceData/pdf/$UUID/svg/$ORIGINALFILENAME" "deviceData/pdf/$UUID/svg/${PAGES_ARRAY[i]}.svg"
    done
fi
