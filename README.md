# Remarkable Viewer V4

Has been tested on:
Version 3.0.4.1305
Version 3.2.3.1595
Version 3.6.1.1894

# Problems with sync after device software update.
When updating the device software it's remote host identification changes. 
This causes the SSH connection used for the sync to no longer work.
Presently, this can be fixed on Linux systems. 
Here is an example of how to fix this for Linux systems:

ssh-keygen -f "/home/nick/.ssh/known_hosts" -R "10.11.99.1"
ssh remarkableusb

Then, you will see "The authenticity of host '10.11.99.1 (10.11.99.1)' can't be established.
Answer 'yes' to this question. You should now be at a prompt for the Remarkable device.
Type 'exit' and press enter to return to your system.
The syncing feature should now work again.