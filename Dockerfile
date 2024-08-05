# Use the Node.js 20 Docker image
FROM node:20

# Set the working directory in the container
WORKDIR /usr/src/app

# Install necessary system packages, latest npm, and set up the environment
RUN apt-get update \
    && apt-get install -y apt-utils rsync nano jq bc pdf2svg librsvg2-bin pngquant openssh-client \
    && npm install npm@latest -g \
    && rm -rf /var/lib/apt/lists/*

# Copy package.json and package-lock.json first to leverage Docker cache
COPY --chown=node:node package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy SSH keys or certificates and ensure they are not included in public images
COPY --chown=node:node DOCKER/.ssh /home/node/.ssh

# Copy the rest of your application code
COPY --chown=node:node . .

# Set permissions for SSH keys and change ownership and permissions for all application files
RUN chmod 600 /home/node/.ssh/* \
    && chown -R node:node /usr/src/app \
    && chmod -R 755 /usr/src/app/deviceData

# Expose the port your app runs on
EXPOSE 2000

# Switch to user 'node' before running the application
USER node

# Command to start your Node.js application
CMD ["node", "index.js"]
