#!/bin/bash

# CONNECTION CHECK.
SSHALIAS=remarkableusb
STATUS=$(ssh -o BatchMode=yes -o ConnectTimeout=2 $SSHALIAS echo ok 2>&1)
if [[ $STATUS != ok ]] ; then
  echo "Could not connect to the device (SSH alias: '$SSHALIAS')."
  echo "Please check connectivity and/or SSH config."
  exit 1
fi

# VIA RSYNC: Send the custom templates up to the device templates dir. (This can overwrite files.)
rsync -r --checksum --itemize-changes \
./deviceData/custTemplates/ \
$SSHALIAS:/usr/share/remarkable/templates/ 

# VIA RSYNC: Output may look like this if there are any changes:
# <fcsT...... P Lines small.png
# <fcsT...... P Lines small.svg

# VIA SCP: Send the custom templates up to the device templates dir. (This can overwrite files.)
# for i in deviceData/custTemplates/*; do \
# [ -f "$i" ] || continue;
# scp "$i" "$SSHALIAS:/usr/share/remarkable/templates/"; \
# done

# VIA SCP: Output will likely look like something like this:
# P Lines small.png       100%   11KB 232.1KB/s   00:00
# P Lines small.svg       100% 4249     1.9MB/s   00:00

exit

# Restart the xochitl service on the Remarkable device.
echo

echo "Restarting the xochitl service on the Remarkable device:";
ssh $SSHALIAS "systemctl restart xochitl";
if [ $? -eq 0 ]; then
  echo "SUCCESS - xochitl service has been restarted.";
else
  echo "FAIL - Error on restarting xochitl service. REBOOTING DEVICE.";
  ssh $SSHALIAS "/sbin/reboot";
fi

exit;