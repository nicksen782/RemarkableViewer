#!/bin/bash

# EXAMPLE: ./deviceData/scripts/new/process_optimizeSvgPages.sh "521755a0-1330-4ad7-afd4-100c2f961b4c"

# Command arguments.
UUID=$1

# Make this directories if they do not already exist.
mkdir -p deviceData/pdf/$UUID
mkdir -p deviceData/pdf/$UUID/svg
mkdir -p deviceData/pdf/$UUID/svgThumbs

# Optimize with svgo.
# Command should look something like this: node_modules/svgo/bin/svgo --config deviceData/svgo.config.js --recursive -f deviceData/pdf/521755a0-1330-4ad7-afd4-100c2f961b4c/svg/
node_modules/svgo/bin/svgo \
--config "deviceData/svgo.config.js" \
--recursive \
--quiet \
-f "deviceData/pdf/$UUID/svg/";
