#!/bin/bash

# CONNECTION CHECK.
SSHALIAS=remarkableusb
STATUS=$(ssh -o BatchMode=yes -o ConnectTimeout=2 $SSHALIAS echo ok 2>&1)
if [[ $STATUS != ok ]] ; then
  echo "Could not connect to the device (SSH alias: '$SSHALIAS')."
  echo "Please check connectivity and/or SSH config."
  exit 1
fi

# Sync down the .metadata files. 
rsync -r --checksum --itemize-changes --delete \
--include='*.metadata' \
--exclude='*' \
$SSHALIAS:/home/root/.local/share/remarkable/xochitl/ \
./deviceData/queryData/meta/metadata

# Sync down the .content files. 
rsync -r --checksum --itemize-changes --delete \
--include='*.content' \
--exclude='*' \
$SSHALIAS:/home/root/.local/share/remarkable/xochitl/ \
./deviceData/queryData/meta/content

# Sync down the *.thumbnails dirs/files. 
rsync -r --checksum --itemize-changes --delete \
--include='*/*' \
--include='*.thumbnails/' \
--exclude='*' \
$SSHALIAS:/home/root/.local/share/remarkable/xochitl/ \
./deviceData/queryData/meta/thumbnails
