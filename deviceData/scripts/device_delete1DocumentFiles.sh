#!/bin/bash

# EXAMPLE: ./deviceData/scripts/device_delete1DocumentFiles.sh "6647bd38-4ff5-49cc-a3bc-f89c87fb2479"
# 521755a0-1330-4ad7-afd4-100c2f961b4c

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

# Make sure that the UUID is valid.
if [ -z "$UUID" ] || [ ${#UUID} -ne 36 ]; then
  echo "UUID variable is not set or has an invalid length"
else
  # Run the line against the device.
  # script="find /home/root/.local/share/remarkable/xochitl/ -name \"$UUID*\" -exec rm -rf {} \;";
  script="find /home/root/.local/share/remarkable/xochitl/ -name \"$UUID*\" -exec rm -rf {} \; 2>/dev/null"
  # script="find /home/root/.local/share/remarkable/xochitl/ -name \"$UUID*\" -print;"
  ssh $SSHALIAS 'bash -s' <<< "$script";
fi

exit
