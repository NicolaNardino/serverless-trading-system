FROM node:latest

WORKDIR /srv/app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run prestart
CMD ["node", "dist/index.js"]