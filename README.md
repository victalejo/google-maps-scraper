# 🗺️ Google Maps Scraper - Network Interception v2.0

Scraper avanzado para obtener **todas las reseñas** de Google Maps utilizando **Network Interception** con Puppeteer y Chrome DevTools Protocol (CDP). Extrae datos completos sin usar selectores HTML.

## 🎉 Nuevo en v2.0: Sistema de Jobs Asíncrono

✨ **API completamente renovada** con sistema de jobs que responde inmediatamente:

```bash
# Antes (v1.x): Espera minutos a que termine
curl -X POST http://localhost:3001/api/scrape -d '{"url":"..."}'
# ⏱️ Respuesta después de 2-5 minutos

# Ahora (v2.0): Respuesta inmediata con jobId
curl -X POST http://localhost:3001/api/scrape -d '{"url":"..."}'
# ⚡ Respuesta en ~100ms con jobId
# 🔍 Consulta progreso: GET /api/jobs/{jobId}
```

### Características v2.0

- ⚡ **Respuesta instantánea**: API responde en ~100ms sin bloquear
- 🔄 **Cola de procesamiento**: Configura máximo de jobs simultáneos
- 📊 **Progreso en tiempo real**: Consulta estado y avance de cada job
- 🔧 **Sin fugas de memoria**: Navegadores se cierran correctamente
- 🚀 **Escalable**: Procesa múltiples scraping jobs en paralelo

## 🚀 Inicio Rápido

### Opción 1: Línea de Comandos

```bash
# 1. Instalar dependencias
npm install

# 2. Ejecutar scraper
node index.js "URL_DE_GOOGLE_MAPS"
```

### Opción 2: API REST v2.0 (Asíncrona)

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor API
npm run api
# Servidor en http://localhost:3001

# 3. Crear job de scraping (respuesta inmediata)
curl -X POST http://localhost:3001/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.google.com/maps/place/...","maxScrolls":20}'

# Respuesta (~100ms):
# {
#   "success": true,
#   "job": {
#     "jobId": "job_1234567890_abc123",
#     "status": "pending",
#     "progress": { "percentage": 0, "message": "En cola" }
#   },
#   "links": { "status": "/api/jobs/job_1234567890_abc123" }
# }

# 4. Consultar progreso y obtener resultados
curl http://localhost:3001/api/jobs/job_1234567890_abc123
```

**📖 Documentación:**
- **[GUÍA DE USO (CLI)](./GUIA-DE-USO.md)** - Scraper por línea de comandos
- **[API DOCUMENTATION v2.0](./API-DOCUMENTATION.md)** - Sistema de jobs asíncrono completo
  - 🆕 Endpoints de jobs asíncronos
  - 🆕 Gestión de cola y concurrencia
  - 🆕 Seguimiento de progreso en tiempo real

---

## ✨ Datos Extraídos (Completos)

### 👤 Información del Autor
✅ Nombre, foto de perfil, URL del perfil
✅ ID de usuario
✅ Total de opiniones y fotos
✅ Estado de Local Guide ("Local Guide · 88 opiniones")

### 📝 Contenido de la Reseña
✅ Texto completo de la reseña
✅ Calificación (1-5 estrellas)
✅ Fechas (ISO 8601 + relativa "Hace 2 días")
✅ Fotos subidas por el usuario

### 💬 Respuesta del Propietario
✅ Texto completo de la respuesta
✅ Fecha de la respuesta

### 🎯 Aspectos Guiados (Google Questions)
✅ Precio por persona (rango)
✅ Calificación de comida (1-5)
✅ Calificación de servicio (1-5)
✅ Calificación de ambiente (1-5)
✅ Platos recomendados (lista)
✅ Tiempo de espera
✅ Nivel de ruido
✅ Tamaño de grupo recomendado
✅ Necesidad de reserva

---

## 🛠️ Características Técnicas

- **Network Interception con CDP**: Intercepta las peticiones HTTP directamente sin depender de selectores HTML
- **Stealth Mode**: Evasión de detección con `puppeteer-extra-plugin-stealth`
- **Paginación Automática**: Scroll automático para cargar todas las reseñas disponibles
- **Múltiples Formatos**: Exporta a JSON y CSV
- **Parsing Completo**: Extrae TODOS los campos disponibles (215+ campos por reseña)
- **Estadísticas Automáticas**: Genera reportes con análisis completo
- **Eliminación de Duplicados**: Detecta y elimina reseñas duplicadas
- **Ordenamiento por Fecha**: Reseñas ordenadas de más recientes a más antiguas

## Requisitos

- Node.js 16.x o superior
- Google Chrome o Chromium instalado
- Conexión a Internet

## 📦 Instalación

```bash
# 1. Clonar o descargar el proyecto
cd google-maps-scraper

# 2. Instalar dependencias
npm install

# 3. Puppeteer descargará Chromium automáticamente
```

## 🎯 Uso

### Método Simple (Recomendado)

```bash
node index.js "URL_DE_GOOGLE_MAPS"
```

**Ejemplo real:**
```bash
node index.js "https://www.google.com/maps/place/La+BTK+Bellas+Artes/@19.4338211,-99.1455109,17z/data=!4m6!3m5!1s0x85d1f96b83b19901:0xc83c8fcab37f08ab!8m2!3d19.4338211!4d-99.1429306!16s%2Fg%2F11gxvsgx0g"
```

### Cómo Obtener la URL

1. Abre Google Maps en tu navegador
2. Busca el establecimiento que quieres analizar
3. Copia la URL completa de la barra de direcciones
4. Pégala en el comando (entre comillas)

**Eso es todo!** El scraper:
- Extraerá TODAS las reseñas disponibles
- Generará archivos JSON y CSV en la carpeta `output/`
- Mostrará estadísticas en la consola

### Proceso de Scraping

El scraper ejecuta automáticamente:

1. **Inicialización**: Abre Chrome con stealth mode
2. **Navegación**: Va a la URL del establecimiento
3. **Interacción**: Click en "Opiniones" y "Ordenar por más recientes"
4. **Scroll**: Carga todas las reseñas haciendo scroll automático
5. **Interceptación**: Captura todas las peticiones a endpoints de Google Maps
6. **Parsing**: Extrae datos de las respuestas interceptadas
7. **Exportación**: Guarda resultados en `output/`

### Estructura de Salida

El scraper genera tres archivos en `output/`:

1. **reviews_NOMBRE_FECHA.json** - Reseñas parseadas y estructuradas
2. **raw_responses_NOMBRE_FECHA.json** - Respuestas HTTP crudas (debugging)
3. **reviews_NOMBRE_FECHA.csv** - Reseñas en formato CSV

### Formato de Datos (JSON)

```json
{
  "metadata": {
    "establecimiento": "BTK Tecnológico",
    "place_id": "0x85cd8bdb988e3a8f:0x4f62740ae63ef3ac",
    "url": "https://...",
    "fecha_scraping": "2025-11-19T10:30:00.000Z",
    "total_reseñas": 150,
    "scraper_version": "1.0.0"
  },
  "estadisticas": {
    "promedio_calificacion": 4.5,
    "total_con_texto": 120,
    "total_con_fotos": 45,
    "total_con_respuesta": 30,
    "distribucion_calificaciones": {
      "1": 5,
      "2": 10,
      "3": 20,
      "4": 35,
      "5": 80
    },
    "fecha_mas_antigua": "2023-01-15T10:00:00.000Z",
    "fecha_mas_reciente": "2025-11-19T09:00:00.000Z"
  },
  "reseñas": [
    {
      "autor": "Aldo Galdamez",
      "autor_foto": "https://lh3.googleusercontent.com/...",
      "autor_url_perfil": "https://www.google.com/maps/contrib/116655925833951776444",
      "autor_user_id": "116655925833951776444",
      "autor_total_opiniones": 88,
      "autor_total_fotos": 1,
      "autor_local_guide": "Local Guide · 88 opiniones",
      "calificacion": 5,
      "texto": "Buena atención y servicio 10/10 recomendado",
      "fecha_relativa": "Hace 7 horas",
      "fecha_iso": "2025-11-18T22:38:03.736Z",
      "timestamp_segundos": 1763505483,
      "likes": null,
      "respuesta_propietario": "¡Qué alegría recibir tu reseña!...",
      "respuesta_propietario_fecha": "2025-11-18T22:46:02.000Z",
      "fotos": [],
      "aspectos": {
        "precio_por_persona": "$200-300",
        "comida": 5,
        "servicio": 5,
        "ambiente": 5,
        "platos_recomendados": ["Costillas Cometodo"],
        "tiempo_espera": "Sin espera",
        "nivel_ruido": "Ruido moderado",
        "tamano_grupo": "3 o 4 personas",
        "reserva": "No se requiere hacer una reserva"
      }
    }
  ]
}
```

## Arquitectura del Proyecto

```
google-maps-scraper/
├── src/
│   ├── scraper.js      # Lógica de scraping con CDP
│   ├── parser.js       # Parsing de respuestas
│   └── exporter.js     # Exportación de datos
├── output/             # Archivos generados
├── index.js            # Punto de entrada
├── package.json        # Dependencias
└── README.md           # Este archivo
```

## Cómo Funciona

### 1. Network Interception con CDP

El scraper usa Chrome DevTools Protocol para interceptar peticiones de red:

```javascript
// Crear sesión CDP
const client = await page.target().createCDPSession();
await client.send('Network.enable');

// Interceptar respuestas
client.on('Network.responseReceived', async (event) => {
  if (event.response.url.includes('/maps/rpc/listugcposts')) {
    const { body } = await client.send('Network.getResponseBody', {
      requestId: event.requestId
    });
    // Procesar respuesta...
  }
});
```

### 2. Endpoints Interceptados

El scraper captura peticiones a:
- `/maps/rpc/listugcposts` (principal)
- Otros endpoints con `/rpc` y `reviews`

### 3. Parsing Multi-Formato

El parser intenta múltiples estrategias:
1. JSON directo
2. JSON con prefijos de seguridad de Google (`)]}'`)
3. Arrays JSON embebidos
4. Formato Protocol Buffer (básico)

### 4. Evasión de Detección

- **Stealth Plugin**: Oculta indicadores de automatización
- **User-Agent real**: Chrome en Windows
- **Delays aleatorios**: Simula comportamiento humano
- **Viewport realista**: 1920x1080

## Limitaciones y Consideraciones

### Limitaciones Técnicas

1. **Formato Propietario**: Google Maps usa Protocol Buffer, difícil de decodificar sin schema
2. **Cambios de API**: Google puede cambiar endpoints sin aviso
3. **Rate Limiting**: Demasiadas peticiones pueden resultar en bloqueo temporal
4. **CAPTCHAs**: Google puede mostrar CAPTCHAs si detecta actividad sospechosa

### Aspectos Legales

⚠️ **IMPORTANTE**: El scraping de Google Maps puede violar los [Términos de Servicio de Google](https://policies.google.com/terms). Este código es solo para fines educativos.

**Alternativas Legales:**
- [Google Maps Platform APIs](https://developers.google.com/maps) (oficial)
- [Places API](https://developers.google.com/maps/documentation/places/web-service/overview) (oficial)
- APIs de terceros autorizadas (SerpApi, etc.)

### Recomendaciones

1. **Uso Responsable**: No hagas scraping excesivo
2. **Delays**: Mantén delays generosos entre peticiones
3. **Proxies**: Considera usar proxies residenciales para volúmenes altos
4. **Testing**: Prueba primero en modo no-headless para ver el proceso

## Solución de Problemas

### Error: "No se pudieron extraer reseñas"

**Causas posibles:**
- El formato de respuesta de Google cambió
- Las respuestas están en Protocol Buffer sin decodificar
- No se capturaron los endpoints correctos

**Solución:**
1. Revisa `raw_responses_*.json` en `output/`
2. Busca patrones en las respuestas crudas
3. Ajusta el parser según sea necesario

### Error: "Navigation timeout"

**Solución:**
- Aumenta `timeout` en CONFIG
- Verifica tu conexión a Internet
- Prueba con `headless: false` para ver qué sucede

### CAPTCHAs o Bloqueos

**Solución:**
- Aumenta los delays (`scrollDelay`)
- Usa proxies residenciales
- Reduce la frecuencia de scraping

### No se encuentra botón de "Opiniones"

**Solución:**
- Verifica que la URL sea correcta
- El scraper continuará aunque no encuentre el botón
- Revisa el navegador en modo no-headless

## Desarrollo y Personalización

### Añadir Nuevos Endpoints

Edita `src/scraper.js` en el método `isRelevantEndpoint()`:

```javascript
isRelevantEndpoint(url) {
  const relevantPatterns = [
    '/maps/rpc/listugcposts',
    'TU_NUEVO_ENDPOINT',
    // ...
  ];
  return relevantPatterns.some(pattern => url.includes(pattern));
}
```

### Personalizar Parsing

Edita `src/parser.js` y añade nuevas estrategias en `parseResponse()`.

### Modificar Formato de Salida

Edita `src/exporter.js` para cambiar la estructura del JSON o añadir nuevos formatos.

## Dependencias

- **puppeteer**: ^21.11.0 - Automatización de Chrome
- **puppeteer-extra**: ^3.3.6 - Extensiones para Puppeteer
- **puppeteer-extra-plugin-stealth**: ^2.11.2 - Evasión de detección

## Licencia

MIT

## Descargo de Responsabilidad

Este proyecto es solo para fines educativos y de investigación. El autor no se hace responsable del uso indebido de este código. Usa bajo tu propia responsabilidad y asegúrate de cumplir con los Términos de Servicio de Google y las leyes aplicables.

## Contribuciones

Las contribuciones son bienvenidas. Por favor:
1. Fork el proyecto
2. Crea una rama para tu feature
3. Commit tus cambios
4. Push a la rama
5. Abre un Pull Request

## Soporte

Para reportar bugs o solicitar features, abre un issue en el repositorio.

---

## 🔖 Versión

**v2.0.0** - Sistema de Jobs Asíncrono

### Nuevas funcionalidades v2.0:
- ✅ API asíncrona con respuesta inmediata (~100ms)
- ✅ Sistema de cola con límite configurable de jobs concurrentes
- ✅ Endpoints de gestión de jobs y progreso
- ✅ Navegadores se cierran correctamente (sin fugas de memoria)
- ✅ Escalable para alto volumen de scraping

Ver [API-DOCUMENTATION.md](./API-DOCUMENTATION.md) para detalles completos.

---

**Nota**: Si las respuestas de Google Maps están en formato Protocol Buffer y no se pueden parsear automáticamente, necesitarás herramientas adicionales como `protobuf-decoder` o realizar reverse engineering manual del formato.
