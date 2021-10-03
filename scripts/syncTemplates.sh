#!/bin/bash

# NOTE: Entries in ~/.ssh/config for remarkableusb and remarkablewifi need to be set. Use identity files. 

# TODO: Background templates:
# /usr/share/remarkable/templates/

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
	tolocal) 
		if [ "$1" == "tolocal" ]; then
			DEST="../DEVICE_DATA/templates/";
		fi
		;;
	*)
		echo "Argument 1 is INVALID. (Valid options: toremote, tolocal)"; exit;
esac

case $2 in
	WIFI|USB)
		if [ "$2" == "WIFI" ]; then
			SSHALIAS=remarkablewifi;
			SRC="$SSHALIAS:/usr/share/remarkable/templates/";
		elif [ $2 == "USB" ]; then
			SSHALIAS=remarkableusb;
			SRC="$SSHALIAS:/usr/share/remarkable/templates/";
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

EXCLUDES="--exclude '.cache/' --exclude 'webusb' --exclude 'templates'"
ARGS='--delete -r -v -a --stats '

# Create the command. 
CMD="time rsync $ARGS $EXCLUDES $SRC $DEST"
echo 

# Run the command.
eval $CMD
echo 

# Display what the full command was.
echo "CMD: $CMD";
