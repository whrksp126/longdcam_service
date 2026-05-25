FROM node:20-bullseye-slim

RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

EXPOSE 3000
CMD ["node", "dist/server.js"]
