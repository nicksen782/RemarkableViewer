#!/bin/bash
echo

echo "*****************************************"
echo "Checking if app port is already in use..."
echo "*****************************************"
node removeprocess.js 3200
echo

echo "***************"
echo "Starting app..."
echo "***************"
echo
node _backend.js
echo