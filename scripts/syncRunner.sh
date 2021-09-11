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
case $1 in
	tolocal|toremote) 
		if [ $1 == 'tolocal' ]; then
			DEST="../DEVICE_DATA/"
		elif [ $1 == 'toremote' ]; then
			echo "ERROR: toremote is not implemented!";
			# DEST="/home/nicksen782/node_sites/remarkableViewer/DEVICE_DATA/"
			exit;
		fi
		;;
	*)
		echo "Argument 1 is INVALID. (Valid options: toremote, tolocal)"; exit;
esac

case $2 in
	wifi|usb)
		if [ $2 == 'wifi' ]; then
			SRC="root@remarkablewifi:/home/root/.local/share/remarkable/"
		elif [ $2 == 'usb' ]; then
			echo "ERROR: usb is not implemented!";
			# SRC="root@remarkableusb:/home/root/.local/share/remarkable/"
			exit;
		fi
		;;
	*)
		echo "Argument 2 is INVALID (Valid options: wifi, usb)"; exit;
esac

EXCLUDES="--exclude '.cache/' --exclude 'webusb' --exclude 'templates'"
# ARGS='--delete -r -v --stats' 
# ARGS='--delete -r -v --stats --size-only'
ARGS='--delete -r -v --stats --checksum' 

# Create the command. 
CMD="time rsync $ARGS $EXCLUDES $SRC $DEST"
echo 

# Run the command.
eval $CMD
echo 

# Display what the full command was.
echo "CMD: $CMD";
