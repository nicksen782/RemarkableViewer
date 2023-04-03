#!/bin/bash

# EXAMPLE: ./deviceData/scripts/sync_getDiskUsage.sh

# CONNECTION CHECK.
SSHALIAS=remarkableusb
STATUS=$(ssh -o BatchMode=yes -o ConnectTimeout=2 $SSHALIAS echo ok 2>&1)
if [[ $STATUS != ok ]] ; then
  echo "Could not connect to the device (SSH alias: '$SSHALIAS')."
  echo "Please check connectivity and/or SSH config."
  exit 1
fi

CMDS="df | grep /dev/mmcblk2p4";
ssh $SSHALIAS 'bash -s' <<< "$CMDS";

# SAMPLE OUTPUT (headers will not part of the output.)
# Filesystem           1K-blocks      Used Available Use% Mounted on
# /dev/mmcblk2p4         6722700   3354024   3007460  53% /home
