#!/bin/bash

# EXAMPLE: ./deviceData/scripts/process_removeLocalDocumentDir.sh "6647bd38-4ff5-49cc-a3bc-f89c87fb2479"

# Command arguments.
UUID=$1

# Make this directory if it does not already exist (to avoid an error.)
mkdir -p deviceData/pdf/$UUID

# Remove the document directory and it's contents.
# echo "Removing with: rm -r -d deviceData/pdf/$UUID"
rm -r -d deviceData/pdf/$UUID && echo "REMOVED"
