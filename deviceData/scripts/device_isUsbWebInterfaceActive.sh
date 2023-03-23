#!/bin/bash

# EXAMPLE: ./deviceData/scripts/device_isUsbWebInterfaceActive.sh skipSshCheck
# EXAMPLE: ./deviceData/scripts/device_isUsbWebInterfaceActive.sh 

SSHALIAS=remarkableusb

# CONNECTION CHECK (unless "skipSshCheck" is a command argument.)
if [ "$1" != "skipSshCheck" ]; then
    # CONNECTION CHECK.
    STATUS=$(ssh -o BatchMode=yes -o ConnectTimeout=2 $SSHALIAS echo ok 2>&1)
    if [[ $STATUS != ok ]] ; then
        echo "Could not connect to the device (SSH alias: '$SSHALIAS')."
        echo "Please check connectivity and/or SSH config."
        exit 1
    fi
fi

# Run the command and then store the exit_status.
script="grep -q 'WebInterfaceEnabled=true' /home/root/.config/remarkable/xochitl.conf"
ssh $SSHALIAS $script
exit_status=$?

# Check for the result or for an error.
if [ $exit_status -eq 0 ]; then
    echo "enabled"
    exit 0
else
    if [ $exit_status -eq 1 ]; then
        echo "disabled"
        exit 0
    else
        echo "An error occurred"
        exit 1
    fi
fi
