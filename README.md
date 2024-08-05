# Remarkable Viewer V4

Has been tested on:
Version 3.12.4.4    (newest)
Version 3.11.2.5
Version 3.10.2.2063 
Version 3.9.3.1986 
Version 3.8.3.1976
Version 3.8.2.1965
Version 3.6.1.1894
Version 3.2.3.1595
Version 3.0.4.1305

# Problems with sync after device software update.
When updating the device software it's remote host identification will change. 
This causes the SSH connection used for the sync to no longer work.
Presently, this can be fixed on Linux systems. 
Here is an example of how to fix this for Linux systems:

ssh-keygen -f "/home/nick/.ssh/known_hosts" -R "10.11.99.1"

Now run:
ssh remarkableusb

Then, you will see "The authenticity of host '10.11.99.1 (10.11.99.1)' can't be established.
Answer 'yes' to this question. You should now be at a prompt for the Remarkable device.
Type 'exit' and press enter to return to your system.
The syncing feature should now work again because the remote host identification has been updated.