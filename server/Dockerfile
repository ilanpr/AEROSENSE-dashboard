FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY api ./api
COPY scripts ./scripts
RUN chmod -R a+rX /app
USER node
CMD ["node", "api/server.mjs"]
