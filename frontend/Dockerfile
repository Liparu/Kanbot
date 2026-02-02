FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN chmod +x node_modules/.bin/*

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
