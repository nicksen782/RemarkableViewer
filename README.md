# Remarkable Viewer
### PURPOSE:
- Sync your Remarkable data to your own PC/SERVER.
- Replacement for the Remarkable Desktop app. 
- This app is designed to NOT use the Remarkable cloud although it can still be used if desired.
#

### IMPLEMENTED MAIN FEATURES:
- Sync your data to the computer/server of your choice. (You can have complete custody of your data.)
- The "Source of Truth" for data is the Remarkable Tablet, not the cloud.
- Syncing is one-way from the Remarkable to the destination.
	- Syncing can be performed via WIFI or USB.
- The file navigation web UI is designed to look similar to the Remarkable UI.
- Opened documents appear and operate in a two-page book-like view.
- Pages are changed/flipped with animation.
- Only minimal writing to the Remarkable tablet will be available.
#
### UPCOMING FEATURES:
- TODO: One-page document view.
- TODO: Rotated document view for landscape.
- TODO: Configurable page flipping.
- TODO: Upload pdf (creation of document.)
- TODO: Move document (metadata change.)
- TODO: Rename document (metadata change.)
- TODO: Send to trash (metadata change.)
#
### TESTED REMARKABLE OS VERSIONS:
- 2.9.1.217 (last tested: 2021-10-07) 
- 2.10.1.332 (last tested: 2021-10-07) 
#

## REMARKABLE OS UPDATE BUG:
If the remote host indentification changes then the app will fail to sync.

To fix this:

### LINUX: 
```sh
- ssh-keygen -f "/home/<YOUR_PC_USERNAME>/.ssh/known_hosts" -R "<REMARKABLE_WIFI_IP>"
- ssh-keygen -f "/home/<YOUR_PC_USERNAME>/.ssh/known_hosts" -R "10.11.99.1"
```
> Note: Conveniently, a Linux system will also provide you a command to copy/paste.

### Windows:
- Edit: C:\Users\<YOUR_USERNAME>\.ssh\known_hosts
- Remove any lines that contain IP addresses used by the Remarkable.

### After applying the fix:
> Reconnect at least once to remarkablewifi and to remarkableusb so that you can answer the question about unknown host. 
#

### INSTALLATION INSTRUCTIONS:
<!-- - Install/Config Docker -->
<!-- - [Instructions](docs/install_docker.md) -->

- Install/Config VirtualBox
	- [Instructions](docs/install_virtualbox.md)

- Install to Ubuntu Server 20.04 LTS (Focal Fossa)
	- [Instructions](docs/install_UbuntuServer_focal_fossa.md)

<!-- - Install to Ubuntu 20 LTS -->
<!-- - [Instructions](docs/install_Ubuntu_focal_fossa.md) -->
#
