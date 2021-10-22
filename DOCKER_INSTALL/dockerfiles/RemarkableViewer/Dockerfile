# Get the base image.
FROM ubuntu:20.04

# Update software, install software, remove cache, add .ssh folder.
RUN echo "STEP: 1" && export DEBIAN_FRONTEND=noninteractive && apt-get update && \
ln -fs /usr/share/zoneinfo/America/New_York /etc/localtime && \
apt-get install -y --no-install-recommends \
software-properties-common \
libzip-dev \
curl \
wget \
rsync \
imagemagick \
ghostscript \
nano \
ca-certificates \
netbase \
sudo \
tzdata \
ssh \
nodejs \
npm \
git && \
dpkg-reconfigure --frontend noninteractive tzdata && \
apt upgrade -y && \
apt-get clean && \
rm -rf /var/lib/apt/lists/*

# Install nodemon, n, and change the node version.
RUN echo "STEP: 2" && npm install -g nodemon && npm install n -g && n 14.17.6

# Add the node user to sudo and set the password.
RUN echo "STEP: 3" && adduser node --gecos "First Last,RoomNumber,WorkPhone,HomePhone" --disabled-password && \
 echo "node:nodepass" | sudo chpasswd && \
 usermod -aG sudo node && \
 mkdir /home/node/.ssh && \

# Configure ImageMagic.
RUN echo "STEP: 4" && sed -i 's+rights="none" pattern="PDF"+rights="read|write" pattern="PDF"+g' /etc/ImageMagick-6/policy.xml

# Change to the node user and install the application.
USER node
RUN echo "STEP: 5" && \
 cd /home/node && \
 git clone https://github.com/nicksen782/RemarkableViewer.git && \
 cd RemarkableViewer && \
 npm install

COPY ./dockerfiles/RemarkableViewer/docker_workspace.code-workspace /home/node/RemarkableViewer
COPY ./configs/.ssh/config /home/node/.ssh/config
COPY ./configs/.ssh/known_hosts /home/node/.ssh/known_hosts
COPY ./configs/.ssh/PRIVATE_KEY /home/node/.ssh/PRIVATE_KEY
COPY ./configs/.ssh/PRIVATE_KEY.pub /home/node/.ssh/PRIVATE_KEY.pub

# Setup SSH files and fix permissions.
USER root
RUN echo "STEP: 6 " && \ 
 chown node:node /home/node/.ssh/                && chmod 700 /home/node/.ssh/ && \ 
 chown node:node /home/node/.ssh/config          && chmod 700 /home/node/.ssh/config && \ 
 chown node:node /home/node/.ssh/known_hosts     && chmod 600 /home/node/.ssh/known_hosts && \ 
 chown node:node /home/node/.ssh/PRIVATE_KEY     && chmod 700 /home/node/.ssh/PRIVATE_KEY && \ 
 chown node:node /home/node/.ssh/PRIVATE_KEY.pub && chmod 700 /home/node/.ssh/PRIVATE_KEY.pub

# Set the work dir.
WORKDIR /home/node/RemarkableViewer