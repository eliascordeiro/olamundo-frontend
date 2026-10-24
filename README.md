# Olá Mundo - Frontend

Frontend em React + Vite que consome a API REST do projeto
[olamundo](https://github.com/eliascordeiro/olamundo) (Spring Boot + MongoDB),
hospedado como um serviço separado no Railway.

## Rodando localmente

```bash
npm install
npm run dev
```

A API utilizada é definida pela variável `VITE_API_BASE_URL` (veja `.env.development.local`).
Por padrão, em desenvolvimento aponta para `http://localhost:8080`.

## Build de produção

```bash
npm run build
```

Os arquivos estáticos são gerados em `dist/` e servidos via nginx (ver `Dockerfile`).

## Deploy no Railway

Este repositório inclui um `Dockerfile` que builda a aplicação e serve os arquivos
estáticos com nginx, escutando na porta definida pela variável `PORT` do Railway.
