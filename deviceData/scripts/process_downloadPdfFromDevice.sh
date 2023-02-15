#!/bin/bash

# EXAMPLE: ./deviceData/scripts/downloadPdfFromDevice.sh "6647bd38-4ff5-49cc-a3bc-f89c87fb2479" "Progress.pdf"

# CONNECTION CHECK.
SSHALIAS=remarkableusb
STATUS=$(ssh -o BatchMode=yes -o ConnectTimeout=2 $SSHALIAS echo ok 2>&1)
if [[ $STATUS != ok ]] ; then
    echo "Could not connect to the device (SSH alias: '$SSHALIAS')."
    echo "Please check connectivity and/or SSH config."
    exit 1
fi

# Command arguments.
UUID=$1
FILENAME=$2

# Make this directories if they do not already exist.
mkdir -p deviceData/pdf/$UUID
mkdir -p deviceData/pdf/$UUID/svg
mkdir -p deviceData/pdf/$UUID/svgThumbs

# Remove existing .pdf files from the directory.
for i in deviceData/pdf/$UUID/*.pdf; do [ -f "$i" ] || continue; rm "$i"; done

# Download the pdf from the device.
curl \
-s \
--compressed \
--insecure \
-o "deviceData/pdf/$UUID/$FILENAME" \
"http://10.11.99.1/download/$UUID/pdf"
