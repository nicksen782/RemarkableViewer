#!/bin/bash

# if:  https://tldp.org/LDP/Bash-Beginners-Guide/html/sect_07_01.html
# basename: https://man7.org/linux/man-pages/man1/basename.1.html
# find: https://man7.org/linux/man-pages/man1/find.1.html

# Switch to the xochitl dir.
# Find all directories (Pipe to while).
# While there are results from the pipe from find: 
#  Check if directory exists.
#  Check if directory exists and is a directory.
#  Ignore any directory that has a "." in the name.
#  echo the unix time and the $dir.
#  Restart the while as long as there are still dirs left. 

# The output should be one record per line (with \n) and look something like this:
# 1638722753 ./f5076cc9-3143-4e78-8d49-abb0792125eb
# 1625075603 ./7dcd0f95-66c5-4acf-ac5b-b4059ba13b8b
# 1623731066 ./328f95ab-25de-4ea9-a4d9-d0a4355c4442
# 1630865385 ./04dd4fbe-c530-4b65-8bbe-3d802acaebee
# 1671314857 ./45ca7bf9-71b4-44ef-ae60-9278aade0a73

# CONNECTION CHECK.
SSHALIAS=remarkableusb
STATUS=$(ssh -o BatchMode=yes -o ConnectTimeout=2 $SSHALIAS echo ok 2>&1)
if [[ $STATUS != ok ]] ; then
  echo "Could not connect to the device (SSH alias: '$SSHALIAS')."
  echo "Please check connectivity and/or SSH config."
  exit 1
fi

# Single line:
# script='cd /home/root/.local/share/remarkable/xochitl && find . -type d | while read dir; do [ ! -e "$dir" ] && continue; [ ! -d "$dir" ] && continue; [[ "$(basename "$dir")" == *.* ]] && continue; echo $(stat -c "%Y" "$dir") "$dir"; done'

# Multi-line (but will act as a single line.)
script='cd /home/root/.local/share/remarkable/xochitl && \
find . -type d | \
while read dir; \
do \
 [ ! -e "$dir" ] && continue; \
 [ ! -d "$dir" ] && continue; \
 [[ "$(basename "$dir")" == *.* ]] && continue; \
 echo $(stat -c "%Y" "$dir") "$dir"; \
done'

# Run the line against the device.
ssh $SSHALIAS 'bash -s' <<< "$script"
