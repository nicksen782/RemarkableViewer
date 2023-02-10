#!/bin/bash

# Sync down the .metadata files. 
rsync -r --checksum --itemize-changes \
--include='*.metadata' \
--exclude='*' \
remarkableusb:/home/root/.local/share/remarkable/xochitl/ \
./deviceData/queryData/meta/metadata

# Sync down the .content files. 
rsync -r --checksum --itemize-changes \
--include='*.content' \
--exclude='*' \
remarkableusb:/home/root/.local/share/remarkable/xochitl/ \
./deviceData/queryData/meta/content

# Sync down the *.thumbnails dirs/files. 
rsync -r --checksum --itemize-changes \
--include='*/*' \
--include='*.thumbnails/' \
--exclude='*' \
remarkableusb:/home/root/.local/share/remarkable/xochitl/ \
./deviceData/queryData/meta/thumbnails
