#!/bin/bash

# echo "metadata"
rsync -r --checksum --itemize-changes \
--include='*.metadata' \
--exclude='*' \
remarkableusb:/home/root/.local/share/remarkable/xochitl/ \
./deviceData/queryData/meta/metadata

# echo "content"
rsync -r --checksum --itemize-changes \
--include='*.content' \
--exclude='*' \
remarkableusb:/home/root/.local/share/remarkable/xochitl/ \
./deviceData/queryData/meta/content

# echo "thumbnails"
rsync -r --checksum --itemize-changes \
--include='*/*' \
--include='*.thumbnails/' \
--exclude='*' \
remarkableusb:/home/root/.local/share/remarkable/xochitl/ \
./deviceData/queryData/meta/thumbnails
