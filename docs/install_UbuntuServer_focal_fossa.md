# Install instructions for Ubuntu Server 20.04 LTS (Focal Fossa)

## Download the disk image for Ubuntu Server 20.04 LTS (Focal Fossa)
- [Download](https://ubuntu.com/download/server)
- Choose "Option 2 - Manual server installation"
- The download should start.
- Note: Any Ubuntu Server 20.04 or higher should work fine.

## After the disk image boots:
- Choose language.
- If prompted for "Installer update available" choose whichever you want.
- Choose keyboard.
- Choose network connection. 
- Choose proxy address (leave as default.)
- Configure Ubuntu archive mirror (leave as default.)
- Guided storage configuration (leave as default.)
	- Choose Done.
	- Choose Done.
	- Choose "Continue" to "Confirm destructive action".
- Profile setup: Fill the form fields as indicated.
- SSH Setup - Use the spacebar to check the option.
	- Skip "Import SSH identity".
- Featured server snaps: Choose none of these then choose "Done".
- Wait for Ubuntu to install. 
- Reboot Ubuntu when indicated to do so.

## After the reboot:
- Login with the username and password created during setup.
- sudo apt install -y net-tools 
