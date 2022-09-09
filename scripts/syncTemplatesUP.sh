#!/bin/bash

# NOTE: Entries in ~/.ssh/config for remarkableusb and remarkablewifi need to be set. Use identity files. 

# USAGE: 
#   ./syncRunner.sh tolocal wifi
#   ./syncRunner.sh tolocal usb
#   ./syncRunner.sh toremote wifi
#   ./syncRunner.sh toremote usb

# MISC NOTES:
# https://newbedev.com/rsync-difference-between-size-only-and-ignore-times

# Make sure that correct arguments have been passed.
CMD=
SRC=
DEST=
SSHALIAS=

case $1 in
	WIFI|USB)
		if [ "$1" == "WIFI" ]; then
			SSHALIAS=remarkablewifi;
		elif [ $1 == "USB" ]; then
			SSHALIAS=remarkableusb;
		fi
		;;
	*)
		echo "Argument 2 is INVALID (Valid options: WIFI, USB)"; exit;
esac

# CONNECTION CHECK.
STATUS=$(ssh -o BatchMode=yes -o ConnectTimeout=2 $SSHALIAS echo ok 2>&1)
if [[ $STATUS != ok ]] ; then
  echo "Could not connect to the device (SSH alias: '$SSHALIAS'). Please check connectivity and/or SSH config."
  exit 1
fi

scp "../DEVICE_DATA/templates/P Lines small_BACKUP.png" "$SSHALIAS:/usr/share/remarkable/templates/"
scp "../DEVICE_DATA/templates/P Lines small_BACKUP.svg" "$SSHALIAS:/usr/share/remarkable/templates/"
scp "../DEVICE_DATA/templates/P Lines small.png"        "$SSHALIAS:/usr/share/remarkable/templates/"
scp "../DEVICE_DATA/templates/P Lines small.svg"        "$SSHALIAS:/usr/share/remarkable/templates/"