#!/bin/bash

script='cd /home/root/.local/share/remarkable/xochitl && find . -type d | while read dir; do [ ! -e "$dir" ] && continue; [ ! -d "$dir" ] && continue; [[ "$(basename "$dir")" == *.* ]] && continue; echo $(stat -c "%Y" "$dir") "$dir"; done'
ssh remarkableusb 'bash -s' <<< "$script"

