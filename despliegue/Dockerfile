# AdminPH - imagen de producción (backend NestJS + frontend estático en el mismo servidor)
# Se construye desde la carpeta que contiene "backend/backend-adminph" y "frontend/AdminPH".
FROM node:22-slim AS build
WORKDIR /app/backend
COPY backend/backend-adminph/package*.json ./
RUN npm ci
COPY backend/backend-adminph/ ./
RUN npm run build && npm prune --omit=dev

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app/backend
COPY --from=build /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/package.json ./package.json
COPY frontend/AdminPH /app/frontend
ENV FRONTEND_DIR=/app/frontend
EXPOSE 3000
CMD ["node", "dist/main.js"]
