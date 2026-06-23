FROM node:20-alpine

WORKDIR /app

COPY package*.json .npmrc ./
RUN npm ci

COPY . .
RUN npm run build
RUN npm prune --omit=dev

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001
CMD ["node", "server.js"]
