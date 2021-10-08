# Install Prerequisites and Program:
## Install Non-npm Programs:
- sudo apt install poppler-utils
- sudo apt install ghostscript
- sudo apt install imagemagick
- sudo nano -l /etc/ImageMagic-g/policy.xml
	- Find line ~95 (<Policty domain="coder" rights="none" pattern="PDF"/>
	- Change rights="none" to rights="read|write".
	- Save the file and exit nano.

## Clone the Application Code Repo:
- git clone https://github.com/nicksen782/RemarkableViewer.git
- cd RemarkableViewer

## Install Node.js
- sudo apt install nodejs npm
- sudo npm install -g n
- sudo n stable
- PATH="$PATH"
- sudo npm install -g nodemon
- npm install

## Run the Program:
- cd to the Remarkable directory.
- nodemon