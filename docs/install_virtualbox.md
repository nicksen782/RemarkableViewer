# Install VirtualBox:
- [Download](https://www.virtualbox.org/wiki/Downloads)
- Installing VirtualBox in either Windows or Linux is similar to other program installs.

# Configure the VirtualBox Container:
- 

# Install VirtualBox Guest Additions (optional):
- In the VirtualBox menu click Devices->Insert Guest Additions CD.
- sudo apt-get update
- sudo apt-get install -y dkms build-essential linux-headers-generic linux-headers-$- (uname -r)
- sudo mount /dev/cdrom /cdrom
- cd /cdrom
- sudo ./VBoxLinuxAdditions.run
