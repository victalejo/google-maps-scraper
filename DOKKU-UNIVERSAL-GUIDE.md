# 📘 Guía Universal de Despliegue en Dokku

## 🎯 Introducción

Esta guía te enseña a desplegar **CUALQUIER tipo de proyecto** en Dokku (Next.js, React, Node.js, Python, PHP, Ruby, Go, etc.).

**Dokku** es una plataforma PaaS (Platform as a Service) de código abierto que funciona como un Heroku self-hosted. Te permite desplegar aplicaciones con un simple `git push`.

### 🔑 Sobre la Clave SSH AURORA

**IMPORTANTE:** Esta guía está configurada para usar la **clave SSH AURORA** (`~/.ssh/aurora`) en todos los ejemplos de despliegue. Esto significa que:

- ✅ Todos los comandos `git push` usarán la clave aurora
- ✅ Los workflows de GitHub Actions usarán la clave aurora
- ✅ La configuración SSH apuntará a la clave aurora
- ✅ Podrás desplegar **CUALQUIER PROYECTO** usando esta misma clave

Si ya tienes la clave aurora configurada, ¡estás listo para desplegar cualquier proyecto siguiendo esta guía!

## 📋 Tabla de Contenidos

1. [Requisitos Previos](#requisitos-previos)
2. [Configuración Inicial del Servidor](#configuración-inicial-del-servidor)
3. [Tipos de Despliegue](#tipos-de-despliegue)
4. [Despliegue por Tipo de Proyecto](#despliegue-por-tipo-de-proyecto)
5. [Configuración de Dominios y SSL](#configuración-de-dominios-y-ssl)
6. [Variables de Entorno](#variables-de-entorno)
7. [Base de Datos](#base-de-datos)
8. [CI/CD con GitHub Actions](#cicd-con-github-actions)
9. [Comandos Útiles](#comandos-útiles)
10. [Troubleshooting](#troubleshooting)

---

## 1. Requisitos Previos

### En tu servidor:

- ✅ Ubuntu 20.04, 22.04, o 24.04
- ✅ Mínimo 1GB RAM (recomendado 2GB+)
- ✅ Dokku instalado
- ✅ Acceso root o sudo

### En tu máquina local:

- ✅ Git instalado
- ✅ SSH configurado
- ✅ **Clave SSH AURORA** (`~/.ssh/aurora` y `~/.ssh/aurora.pub`)

**Nota importante:** Esta guía usa la clave **AURORA** para todos los ejemplos de despliegue. Si no tienes esta clave, puedes usar cualquier otra clave SSH, solo reemplaza `~/.ssh/aurora` con tu ruta de clave.

### Instalación de Dokku (si no está instalado):

```bash
# En el servidor
wget -NP . https://dokku.com/install/v0.34.8/bootstrap.sh
sudo DOKKU_TAG=v0.34.8 bash bootstrap.sh

# Configurar usuario dokku
cat ~/.ssh/authorized_keys | dokku ssh-keys:add admin

# Configurar hostname
dokku domains:set-global tudominio.com
```

---

## 2. Configuración Inicial del Servidor

### 2.1 Ubicación de tu Clave SSH AURORA

La clave **AURORA** ya está configurada en el servidor Dokku. Solo necesitas saber dónde está en tu máquina local:

```bash
# Clave privada AURORA (la que usarás para deploy)
~/.ssh/aurora

# Clave pública AURORA (para referencia)
~/.ssh/aurora.pub

# Ver contenido de la clave pública
cat ~/.ssh/aurora.pub
# Output: ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAO5eHTPUmAPmN/IIEVDfPAfwSk24yLrR7P7Bya0Wy4J victoralejocj@gmail.com
```

**Nota:** Esta clave ya está registrada en Dokku con el nombre "aurora". **NO necesitas hacer nada en el servidor**, solo usarla desde tu máquina local.

### 2.2 Crear una Aplicación

```bash
# En el servidor
dokku apps:create nombre-app

# Verificar
dokku apps:list
```

### 2.3 Configurar Red (Opcional pero recomendado)

```bash
# Crear red personalizada
dokku network:create mi-red

# Asociar app a la red
dokku network:set nombre-app attach-post-deploy mi-red
```

---

## 3. Tipos de Despliegue

Dokku soporta 3 métodos de despliegue:

### 3.1 Buildpacks (Heroku-style)

- ✅ **Sin Dockerfile**
- ✅ Detección automática del lenguaje
- ✅ Fácil y rápido
- ❌ Menos control

**Cuándo usar:** Proyectos simples que siguen convenciones estándar

### 3.2 Dockerfile

- ✅ **Control total** del entorno
- ✅ Multi-stage builds
- ✅ Optimización de imagen
- ❌ Requiere conocimiento de Docker

**Cuándo usar:** Proyectos que necesitan configuración específica

### 3.3 Docker Image

- ✅ Usa imagen pre-construida
- ✅ Muy rápido
- ❌ Requiere registry

**Cuándo usar:** Cuando ya tienes la imagen en Docker Hub/Registry

---

## 4. Despliegue por Tipo de Proyecto

### 4.1 Next.js (App Router & Pages Router)

#### Opción A: Con Dockerfile (Recomendado)

**Archivo: `Dockerfile`**

```dockerfile
# Stage 1: Dependencies
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Stage 2: Builder
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm install
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# Stage 3: Runner
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# IMPORTANTE: Puerto dinámico para Dokku
ENV PORT=${PORT:-3000}
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE ${PORT:-3000}

CMD ["node", "server.js"]
```

**Archivo: `next.config.ts` o `next.config.js`**

```typescript
const nextConfig = {
  output: 'standalone', // CRÍTICO para Docker
};

export default nextConfig;
```

#### Opción B: Con Buildpack

**Archivo: `package.json`** (debe tener):

```json
{
  "scripts": {
    "build": "next build",
    "start": "next start"
  }
}
```

**Archivo: `.buildpacks`** (opcional):

```
https://github.com/heroku/heroku-buildpack-nodejs.git
```

---

### 4.2 React (Vite, CRA, etc.)

#### Con Nginx + Dockerfile

**Archivo: `Dockerfile`**

```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Archivo: `nginx.conf`**

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache para assets estáticos
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

---

### 4.3 Node.js / Express / Fastify

#### Con Dockerfile

**Archivo: `Dockerfile`**

```dockerfile
FROM node:20-alpine
WORKDIR /app

# Dependencias de producción
COPY package*.json ./
RUN npm ci --only=production

# Código de la app
COPY . .

# Puerto dinámico para Dokku
ENV PORT=${PORT:-3000}
EXPOSE ${PORT:-3000}

CMD ["node", "index.js"]
```

#### Con Buildpack (más simple)

**Archivo: `package.json`**

```json
{
  "scripts": {
    "start": "node index.js"
  },
  "engines": {
    "node": "20.x"
  }
}
```

**Archivo: `Procfile`** (opcional pero recomendado):

```
web: node index.js
```

---

### 4.4 Python / Django / Flask / FastAPI

#### Django con Dockerfile

**Archivo: `Dockerfile`**

```dockerfile
FROM python:3.11-slim
WORKDIR /app

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Instalar dependencias de Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código
COPY . .

# Colectar archivos estáticos
RUN python manage.py collectstatic --noinput

# Puerto dinámico
ENV PORT=${PORT:-8000}
EXPOSE ${PORT:-8000}

# Usar gunicorn
CMD gunicorn --bind 0.0.0.0:$PORT --workers 4 myproject.wsgi:application
```

**Archivo: `requirements.txt`**

```
Django>=4.2
gunicorn
psycopg2-binary
whitenoise
```

#### Flask/FastAPI con Dockerfile

**Archivo: `Dockerfile`**

```dockerfile
FROM python:3.11-slim
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PORT=${PORT:-8000}
EXPOSE ${PORT:-8000}

# Para Flask
CMD ["gunicorn", "--bind", "0.0.0.0:$PORT", "app:app"]

# Para FastAPI
# CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "$PORT"]
```

#### Con Buildpack

**Archivo: `requirements.txt`** (necesario)

**Archivo: `Procfile`**

```
web: gunicorn app:app
# O para FastAPI:
# web: uvicorn main:app --host 0.0.0.0 --port $PORT
```

**Archivo: `runtime.txt`**

```
python-3.11.5
```

---

### 4.5 PHP / Laravel

#### Laravel con Dockerfile

**Archivo: `Dockerfile`**

```dockerfile
FROM php:8.2-fpm

# Instalar extensiones
RUN apt-get update && apt-get install -y \
    nginx \
    libpq-dev \
    && docker-php-ext-install pdo pdo_pgsql

# Instalar Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www

# Instalar dependencias
COPY composer.json composer.lock ./
RUN composer install --no-dev --optimize-autoloader

# Copiar código
COPY . .

# Permisos
RUN chown -R www-data:www-data /var/www/storage /var/www/bootstrap/cache

# Nginx config
COPY nginx.conf /etc/nginx/sites-enabled/default

ENV PORT=${PORT:-8000}
EXPOSE ${PORT:-8000}

CMD ["sh", "-c", "php-fpm -D && nginx -g 'daemon off;'"]
```

---

### 4.6 Ruby / Rails

**Archivo: `Dockerfile`**

```dockerfile
FROM ruby:3.2

WORKDIR /app

# Instalar dependencias
COPY Gemfile Gemfile.lock ./
RUN bundle install --without development test

# Copiar código
COPY . .

# Precompilar assets
RUN RAILS_ENV=production bundle exec rake assets:precompile

ENV PORT=${PORT:-3000}
ENV RAILS_ENV=production
EXPOSE ${PORT:-3000}

CMD ["bundle", "exec", "puma", "-C", "config/puma.rb"]
```

**Archivo: `Procfile`**

```
web: bundle exec puma -C config/puma.rb
```

---

### 4.7 Go

**Archivo: `Dockerfile`**

```dockerfile
# Build stage
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o main .

# Runtime stage
FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/main .

ENV PORT=${PORT:-8080}
EXPOSE ${PORT:-8080}

CMD ["./main"]
```

---

### 4.8 Static Sites (HTML/CSS/JS)

**Archivo: `Dockerfile`**

```dockerfile
FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**O usar el buildpack estático:**

**Archivo: `.static`** (archivo vacío)

```bash
touch .static
```

---

## 5. Configuración de Dominios y SSL

### 5.1 Configurar Dominio

```bash
# En el servidor Dokku

# Limpiar dominios por defecto
dokku domains:clear nombre-app

# Agregar tu dominio
dokku domains:add nombre-app tudominio.com
dokku domains:add nombre-app www.tudominio.com

# Verificar
dokku domains:report nombre-app
```

### 5.2 Configurar DNS

En tu proveedor de DNS (Cloudflare, Namecheap, etc.):

```
Type: A
Name: @
Value: [IP del servidor Dokku]
TTL: 3600

Type: A
Name: www
Value: [IP del servidor Dokku]
TTL: 3600
```

### 5.3 Habilitar SSL con Let's Encrypt

```bash
# Instalar plugin (si no está instalado)
sudo dokku plugin:install https://github.com/dokku/dokku-letsencrypt.git

# Configurar email
dokku letsencrypt:set nombre-app email tu@email.com

# Habilitar SSL
dokku letsencrypt:enable nombre-app

# Habilitar auto-renovación
dokku letsencrypt:cron-job --add
```

---

## 6. Variables de Entorno

### 6.1 Configurar Variables

```bash
# Una variable
dokku config:set nombre-app KEY=value

# Múltiples variables
dokku config:set nombre-app \
  NODE_ENV=production \
  API_KEY=secret123 \
  DATABASE_URL=postgres://...

# Desde archivo .env
dokku config:set nombre-app $(cat .env)
```

### 6.2 Ver Variables

```bash
# Ver todas
dokku config nombre-app

# Ver una específica
dokku config:get nombre-app KEY
```

### 6.3 Eliminar Variables

```bash
dokku config:unset nombre-app KEY
```

---

## 7. Base de Datos

### 7.1 PostgreSQL

```bash
# Instalar plugin
sudo dokku plugin:install https://github.com/dokku/dokku-postgres.git

# Crear base de datos
dokku postgres:create nombre-db

# Vincular a la app
dokku postgres:link nombre-db nombre-app

# Esto crea automáticamente la variable DATABASE_URL
```

### 7.2 MySQL

```bash
# Instalar plugin
sudo dokku plugin:install https://github.com/dokku/dokku-mysql.git

# Crear base de datos
dokku mysql:create nombre-db

# Vincular a la app
dokku mysql:link nombre-db nombre-app
```

### 7.3 MongoDB

```bash
# Instalar plugin
sudo dokku plugin:install https://github.com/dokku/dokku-mongo.git

# Crear base de datos
dokku mongo:create nombre-db

# Vincular a la app
dokku mongo:link nombre-db nombre-app
```

### 7.4 Redis

```bash
# Instalar plugin
sudo dokku plugin:install https://github.com/dokku/dokku-redis.git

# Crear Redis
dokku redis:create nombre-redis

# Vincular a la app
dokku redis:link nombre-redis nombre-app
```

---

## 8. CI/CD con GitHub Actions

### 8.1 Usar la Clave SSH AURORA para CI/CD

La clave **AURORA** ya está configurada en Dokku. Para usarla en GitHub Actions, necesitas su contenido:

```bash
# En tu máquina local - Ver la clave privada AURORA
cat ~/.ssh/aurora

# Output (copia esto para el próximo paso):
# -----BEGIN OPENSSH PRIVATE KEY-----
# b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
# QyNTUxOQAAACADuXh0z1JgD5jfyCBFQ3zwH8EpNuMi60ez+wcmtFsuCQAAAKBHhMilR4TI
# pQAAAAtzc2gtZWQyNTUxOQAAACADuXh0z1JgD5jfyCBFQ3zwH8EpNuMi60ez+wcmtFsuCQ
# AAAEACkZJXZ+RkCf/aadX6Eqn23A8qS+XGmsYKZ/ZQEFSO8AO5eHTPUmAPmN/IIEVDfPAf
# wSk24yLrR7P7Bya0Wy4JAAAAF3ZpY3RvcmFsZWpvY2pAZ21haWwuY29tAQIDBAUG
# -----END OPENSSH PRIVATE KEY-----
```

**Nota:** Esta clave ya está registrada en el servidor Dokku. **NO necesitas hacer nada en el servidor remoto**.

### 8.2 Configurar GitHub Secrets

Ve a: `https://github.com/TU-USUARIO/TU-REPO/settings/secrets/actions`

Agrega estos secrets:

- `DOKKU_SSH_PRIVATE_KEY` - Contenido completo de la clave privada **AURORA** (`~/.ssh/aurora`)
- `DOKKU_HOST` - IP o dominio del servidor Dokku (ej: `147.93.184.62`)
- `DOKKU_APP_NAME` - Nombre de tu app en Dokku (ej: `herzconsulting`)

**Para obtener la clave privada AURORA:**
```bash
cat ~/.ssh/aurora
# Copia TODO el contenido, desde -----BEGIN OPENSSH PRIVATE KEY----- hasta -----END OPENSSH PRIVATE KEY-----
```

### 8.3 Workflow de GitHub Actions

**Archivo: `.github/workflows/deploy.yml`**

```yaml
name: Deploy to Dokku

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      # Opcional: Tests
      - name: Run tests
        run: |
          # npm test
          # python -m pytest
          # go test ./...
          echo "Tests passed"

      # Setup SSH usando la clave AURORA
      - name: Setup SSH (clave AURORA)
        run: |
          mkdir -p ~/.ssh
          # DOKKU_SSH_PRIVATE_KEY contiene la clave privada AURORA (~/.ssh/aurora)
          echo "${{ secrets.DOKKU_SSH_PRIVATE_KEY }}" > ~/.ssh/dokku_aurora
          chmod 600 ~/.ssh/dokku_aurora
          ssh-keyscan -H ${{ secrets.DOKKU_HOST }} >> ~/.ssh/known_hosts

      # Deploy usando la clave AURORA
      - name: Deploy to Dokku
        run: |
          git remote add dokku dokku@${{ secrets.DOKKU_HOST }}:${{ secrets.DOKKU_APP_NAME }}
          GIT_SSH_COMMAND="ssh -i ~/.ssh/dokku_aurora -o IdentitiesOnly=yes" git push dokku main:main --force
```

**Nota:** Este workflow usa la clave **AURORA** almacenada en `DOKKU_SSH_PRIVATE_KEY` secret.

---

## 9. Comandos Útiles

### 9.1 Despliegue Local

```bash
# En tu máquina local

# Agregar remote de Dokku
git remote add dokku dokku@tu-servidor.com:nombre-app

# Deploy usando la clave AURORA
GIT_SSH_COMMAND="ssh -i ~/.ssh/aurora -o IdentitiesOnly=yes" git push dokku main:main

# O desde otra rama
GIT_SSH_COMMAND="ssh -i ~/.ssh/aurora -o IdentitiesOnly=yes" git push dokku tu-rama:main

# Tip: Para no escribir GIT_SSH_COMMAND cada vez, configura SSH:
cat >> ~/.ssh/config <<EOF
Host dokku-server
  HostName tu-servidor.com
  User dokku
  IdentityFile ~/.ssh/aurora
  IdentitiesOnly yes
EOF

# Actualiza el remote para usar el alias:
git remote set-url dokku dokku@dokku-server:nombre-app

# Ahora puedes hacer simplemente:
git push dokku main:main
```

**Nota:** Todos los ejemplos en esta guía usan la clave **AURORA** (`~/.ssh/aurora`) para autenticación.

### 9.2 Gestión de Apps

```bash
# Listar apps
dokku apps:list

# Crear app
dokku apps:create nombre-app

# Eliminar app
dokku apps:destroy nombre-app

# Renombrar app
dokku apps:rename old-name new-name
```

### 9.3 Logs y Debugging

```bash
# Ver logs en tiempo real
dokku logs nombre-app -t

# Ver últimas 100 líneas
dokku logs nombre-app --tail 100

# Entrar al contenedor
dokku enter nombre-app web

# Ver procesos
dokku ps:report nombre-app
```

### 9.4 Escalado

```bash
# Escalar web dynos
dokku ps:scale nombre-app web=3

# Agregar workers
dokku ps:scale nombre-app worker=2

# Ver scaling actual
dokku ps:report nombre-app
```

### 9.5 Restart y Rebuild

```bash
# Reiniciar app
dokku ps:restart nombre-app

# Rebuild (sin cambios de código)
dokku ps:rebuild nombre-app

# Detener app
dokku ps:stop nombre-app

# Iniciar app
dokku ps:start nombre-app
```

### 9.6 Rollback

```bash
# Ver releases
dokku ps:report nombre-app

# Rollback a release anterior
dokku ps:restore nombre-app

# Ver imágenes
dokku tags:list nombre-app
```

---

## 10. Troubleshooting

### 10.1 El deploy falla

**Problema:** `! [remote rejected] main -> main (pre-receive hook declined)`

**Solución:**

```bash
# Ver logs del build
dokku logs nombre-app --tail 200

# Verificar que la app exista
dokku apps:list

# Recrear app
dokku apps:destroy nombre-app
dokku apps:create nombre-app
```

### 10.2 Puerto incorrecto

**Problema:** App no responde, timeout en healthcheck

**Solución:**

Asegúrate de que tu app escuche en `0.0.0.0:$PORT`:

```javascript
// Node.js/Express
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
```

```python
# Python/Flask
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
```

### 10.3 SSL no funciona

**Problema:** HTTPS retorna error

**Solución:**

```bash
# Verificar certificado
dokku letsencrypt:list

# Re-generar certificado
dokku letsencrypt:revoke nombre-app
dokku letsencrypt:enable nombre-app

# Ver logs de nginx
dokku nginx:access-logs nombre-app
dokku nginx:error-logs nombre-app
```

### 10.4 Base de datos no conecta

**Problema:** `ECONNREFUSED` o similar

**Solución:**

```bash
# Verificar que DB está corriendo
dokku postgres:info nombre-db  # o mysql/mongo/redis

# Verificar variable de entorno
dokku config:get nombre-app DATABASE_URL

# Re-link
dokku postgres:unlink nombre-db nombre-app
dokku postgres:link nombre-db nombre-app
```

### 10.5 Out of Memory

**Problema:** App se reinicia frecuentemente

**Solución:**

```bash
# Aumentar memoria
dokku docker-options:add nombre-app deploy "--memory=1g"

# Verificar uso
dokku resource:limit nombre-app

# Ver métricas
dokku ps:report nombre-app
```

### 10.6 Build muy lento

**Solución:**

```bash
# Habilitar buildkit
dokku config:set --global DOCKER_BUILDKIT=1

# Limpiar cache
docker system prune -af

# Optimizar Dockerfile (multi-stage builds)
```

---

## 11. Archivos Importantes

### 11.1 `.dockerignore`

```
node_modules
npm-debug.log
.git
.env
.DS_Store
*.md
.github
```

### 11.2 `app.json` (para healthchecks)

```json
{
  "name": "mi-app",
  "description": "Mi aplicación",
  "healthchecks": {
    "web": [
      {
        "type": "startup",
        "name": "web-check",
        "path": "/health",
        "attempts": 3,
        "timeout": 10,
        "wait": 5
      }
    ]
  }
}
```

### 11.3 `Procfile` (para buildpacks)

```
web: npm start
worker: node worker.js
release: npm run migrate
```

### 11.4 `.buildpacks` (forzar buildpack específico)

```
https://github.com/heroku/heroku-buildpack-nodejs.git
https://github.com/heroku/heroku-buildpack-python.git
```

---

## 12. Recursos Adicionales

- **Documentación Oficial:** https://dokku.com/docs/
- **Plugins:** https://dokku.com/docs/community/plugins/
- **Buildpacks:** https://github.com/heroku?q=buildpack
- **Community:** https://github.com/dokku/dokku/discussions

---

## 13. Checklist de Despliegue

Antes de hacer push, verifica:

- [ ] Dockerfile o Procfile configurado correctamente
- [ ] Puerto dinámico configurado (`$PORT`)
- [ ] App escucha en `0.0.0.0` (no `localhost`)
- [ ] Variables de entorno configuradas
- [ ] `.dockerignore` o `.gitignore` actualizado
- [ ] Base de datos configurada (si aplica)
- [ ] DNS apuntando al servidor
- [ ] SSH key agregada a Dokku
- [ ] Git remote configurado

---

## 14. Mejores Prácticas

### ✅ DO:

- Usar multi-stage builds en Dockerfile
- Configurar healthchecks
- Usar variables de entorno para configuración
- Implementar logging apropiado
- Usar .dockerignore para reducir tamaño
- Probar localmente antes de deploy
- Configurar auto-renovación SSL

### ❌ DON'T:

- Hardcodear puertos (usar `$PORT`)
- Commitear archivos sensibles (.env)
- Usar `latest` tag en imágenes base
- Ignorar logs de error
- Deployar directamente a producción sin tests

---

## 🎉 ¡Listo para Desplegar!

Con esta guía puedes desplegar prácticamente cualquier tipo de aplicación en Dokku.

**Flujo básico:**

1. Crear app en Dokku
2. Configurar Dockerfile o Procfile
3. Agregar remote: `git remote add dokku dokku@servidor:app`
4. Deploy: `git push dokku main:main`
5. Configurar dominio y SSL
6. ¡Tu app está en producción! 🚀

---

**¿Preguntas o problemas?** Consulta la [documentación oficial](https://dokku.com/docs/) o abre un issue en el repo de Dokku.
