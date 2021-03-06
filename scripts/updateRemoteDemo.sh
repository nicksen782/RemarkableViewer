#!/bin/bash

SCRIPTPATH=$(realpath $(pwd))

# (SERVER)            
if   [ $1 == 'part1' ]; then
	# Rsync the SERVER directory. (skip: DEVICE_DATA_IMAGES, DEVICE_DATA)
	echo "===== Rsync the SERVER directory. (skip: DEVICE_DATA_IMAGES, DEVICE_DATA) ===== ";
	SRC="..";
	DEST="nicksen782@dev2.nicksen782.net:/home/nicksen782/workspace/websites/LIVE/nicksen782.net/RemarkableViewer/SERVER/";
	rsync --exclude '.cache/' --exclude 'no_git' --exclude 'DEVICE_DATA' --exclude 'DEVICE_DATA_IMAGES' --exclude '.git' --exclude 'debug/lab' --exclude 'configFile.json' --exclude 'files.json' --exclude '_WebUI/*' --delete -r -v --stats --checksum $SRC $DEST;
	echo;

# (configFile.json)   
elif [ $1 == 'part2' ]; then
	# Replace the configFile.json in the Html directory.
	echo "===== Replace the configFile.json in the Html directory. ===== ";
	SRC="demo_configFile.json";
	DEST="nicksen782@dev2.nicksen782.net:/home/nicksen782/workspace/websites/LIVE/nicksen782.net/RemarkableViewer/SERVER/configFile.json";
	scp $SRC $DEST;
	echo;

# (Html)              
elif [ $1 == 'part3' ]; then
	# Rsync the Html directory.
	echo "===== Rsync the Html directory. ===== ";
	SRC="../_WebUI/Html/";
	DEST="nicksen782@dev2.nicksen782.net:/home/nicksen782/workspace/websites/LIVE/nicksen782.net/RemarkableViewer/SERVER/_WebUI/Html/";
	rsync --delete -r -v --stats --checksum $SRC $DEST;
	echo;

# (files.json)        
elif [ $1 == 'part4' ]; then
	# Replace the files.json in the SERVER directory.
	echo "===== Replace the files.json in the SERVER directory. ===== ";
	SRC="demo_files.json";
	DEST="nicksen782@dev2.nicksen782.net:/home/nicksen782/workspace/websites/LIVE/nicksen782.net/RemarkableViewer/SERVER/files.json";
	scp $SRC $DEST;
	echo;

# (DEVICE_DATA)       
elif [ $1 == 'part5' ]; then
	# Rsync the demo files to the server. (DEVICE_DATA)
	echo "===== Rsync the demo files to the server. (DEVICE_DATA) ===== ";
	cd ../DEVICE_DATA/xochitl &&
	rsync --delete -r -v --stats --checksum --include-from=$SCRIPTPATH/updateRemoteDemo.filter \
	. nicksen782@dev2.nicksen782.net:/home/nicksen782/workspace/websites/LIVE/nicksen782.net/RemarkableViewer/SERVER/DEVICE_DATA/xochitl;
	cd ..
	# scp recent.json nicksen782@dev2.nicksen782.net:/home/nicksen782/workspace/websites/LIVE/nicksen782.net/RemarkableViewer/SERVER/DEVICE_DATA/recent.json;
	
	# Rsync the templates.
	rsync --delete -r -v --stats --checksum templates/ nicksen782@dev2.nicksen782.net:/home/nicksen782/workspace/websites/LIVE/nicksen782.net/RemarkableViewer/SERVER/DEVICE_DATA/templates/;
	
	cd $SCRIPTPATH;
	echo;

# (DEVICE_DATA_IMAGES)
elif [ $1 == 'part6' ]; then
	# Rsync the demo files to the server. (DEVICE_DATA_IMAGES)
	echo "===== Rsync the demo files to the server. (DEVICE_DATA_IMAGES) ===== ";
	cd ../DEVICE_DATA_IMAGES &&
	rsync --delete -r -v --stats --checksum --include-from=$SCRIPTPATH/updateRemoteDemo.filter \
	. nicksen782@dev2.nicksen782.net:/home/nicksen782/workspace/websites/LIVE/nicksen782.net/RemarkableViewer/SERVER/DEVICE_DATA_IMAGES;
	cd $SCRIPTPATH;
	echo;
fi
