# Étape 1 : construire le front (HTML, CSS et JS dans dist/)
# Même version majeure de Node que frontend/.nvmrc
FROM node:22-alpine AS build
WORKDIR /app

# Dépendances d'abord : Docker garde cette étape en cache tant que
# package.json et package-lock.json ne changent pas
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Étape 2 : servir le build avec nginx. L'image finale ne contient ni Node ni node_modules.
FROM nginx:1.30-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
