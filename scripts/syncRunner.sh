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
# CMD2=
SRC=
# SRC2=
DEST=
# DEST2=
SSHALIAS=
case $1 in
	tolocal) 
		if [ "$1" == "tolocal" ]; then
			DEST="../DEVICE_DATA/";
			# DEST2="../DEVICE_DATA/templates/";
		fi
		;;
	*)
		echo "Argument 1 is INVALID. (Valid options: toremote, tolocal)"; exit;
esac

case $2 in
	wifi|usb)
		if [ "$2" == "wifi" ]; then
			SSHALIAS=remarkablewifi;
			SRC="$SSHALIAS:/home/root/.local/share/remarkable/";
			# SRC2="$SSHALIAS:/usr/share/remarkable/templates/";
		elif [ $2 == "usb" ]; then
			SSHALIAS=remarkableusb;
			SRC="$SSHALIAS:/home/root/.local/share/remarkable/"
			# SRC2="$SSHALIAS:/usr/share/remarkable/templates/";
		fi
		;;
	*)
		echo "Argument 2 is INVALID (Valid options: wifi, usb)"; exit;
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
# CMD2="time rsync $ARGS          $SRC2 $DEST2"
echo 

# Run the command.
eval $CMD
# eval $CMD2
echo 

# Display what the full command was.
echo "CMD: $CMD";
# echo "CMD2: $CMD2";
