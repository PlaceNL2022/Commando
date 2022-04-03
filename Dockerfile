FROM node:16

# Create app directory
WORKDIR ./app

# Install app dependencies
COPY package*.json ./

RUN npm install
# If you are building your code for production
# RUN npm ci --only=production

# Bundle app source
COPY . .

EXPOSE 3987
CMD [ "node", "index.js" ]