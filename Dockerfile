FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./

RUN npm install

# Bundle app source
COPY . .

# Create logs directory
RUN mkdir -p logs

# Expose port
EXPOSE 4000

CMD ["npm", "start"] 