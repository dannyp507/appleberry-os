FROM node:24-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./

# Explicit optional dependency install avoids the Linux native package bug
# we hit in Railway's default build image path.
RUN npm install --include=optional

COPY . .

RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "run", "start"]
