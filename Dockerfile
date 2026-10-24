# Etapa 1: build da aplicação React/Vite
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Etapa 2: servir os arquivos estáticos com nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# A imagem oficial do nginx substitui automaticamente ${PORT} usando envsubst
# a partir de qualquer arquivo em /etc/nginx/templates/*.template no start-up.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
ENV PORT=80
ENV BACKEND_URL=http://backend:8081
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
