FROM node:20-alpine

# Instalar dependencias de Chromium/Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto-emoji

# Configurar Puppeteer para usar Chromium instalado
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

# Instalar dependencias de Node.js
COPY package*.json ./
RUN npm install --production

# Copiar código fuente
COPY . .

# Variables de entorno para producción
ENV NODE_ENV=production

# Crear directorio para archivos de salida
RUN mkdir -p output && chmod 777 output

# Exponer puerto (Dokku lo asigna dinámicamente)
EXPOSE 3001

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3001) + '/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

# Iniciar servidor
CMD ["node", "server.js"]
