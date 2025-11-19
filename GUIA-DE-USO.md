# 🗺️ Google Maps Scraper - Guía de Uso

## 📋 Descripción

Este scraper extrae **todas las reseñas** de cualquier establecimiento en Google Maps usando interceptación de red (NO scraping HTML). Captura datos completos incluyendo:

- ✅ Datos del autor (nombre, foto, perfil, Local Guide, total de opiniones)
- ✅ Texto de la reseña
- ✅ Calificación (estrellas)
- ✅ Fechas (ISO y relativa como "Hace 2 días")
- ✅ **Detección de reseñas editadas** (fecha original + fecha de edición)
- ✅ Respuestas del propietario con fechas
- ✅ Aspectos guiados (precio, comida, servicio, ambiente)
- ✅ Platos recomendados
- ✅ **Información de estacionamiento** (disponibilidad + opciones como valet parking)
- ✅ Fotos de las reseñas
- ✅ Información adicional (tiempo de espera, ruido, tamaño de grupo, reservas)

---

## 🚀 Requisitos Previos

- **Node.js** versión 14 o superior
- **npm** (incluido con Node.js)

Para verificar si tienes Node.js instalado:

```bash
node --version
npm --version
```

---

## 📦 Instalación

### 1. Clonar o descargar el proyecto

```bash
cd google-maps-scraper
```

### 2. Instalar dependencias

```bash
npm install
```

Esto instalará:
- `puppeteer` - Automatización del navegador
- `puppeteer-extra-plugin-stealth` - Evitar detección de bots
- `csv-writer` - Exportación a CSV

---

## 🎯 Cómo Usar

### Uso Básico

```bash
node index.js "URL_DE_GOOGLE_MAPS"
```

### Ejemplo Real

```bash
node index.js "https://www.google.com/maps/place/La+BTK+Bellas+Artes/@19.4338211,-99.1455109,17z/data=!4m6!3m5!1s0x85d1f96b83b19901:0xc83c8fcab37f08ab!8m2!3d19.4338211!4d-99.1429306!16s%2Fg%2F11gxvsgx0g?entry=ttu"
```

### Cómo Obtener la URL

1. Abre Google Maps en tu navegador
2. Busca el establecimiento que quieres analizar
3. Copia la URL completa de la barra de direcciones
4. Pégala en el comando (entre comillas)

---

## ⚙️ Configuración

Puedes modificar el comportamiento del scraper en `src/scraper.js`:

```javascript
constructor(options = {}) {
  this.headless = options.headless !== false; // false = ver el navegador
  this.maxScrolls = options.maxScrolls || 50;  // Máximo de scrolls
  this.scrollDelay = options.scrollDelay || 2000; // Delay entre scrolls (ms)
  this.waitAfterSort = options.waitAfterSort || 3000; // Espera después de ordenar
}
```

### Ver el Navegador Durante el Scraping

Para depurar o ver el proceso:

```javascript
const scraper = new GoogleMapsScraper({
  headless: false,  // Cambia a false para ver el navegador
  maxScrolls: 100   // Aumenta para obtener más reseñas
});
```

---

## 📊 Estructura de los Datos Exportados

El scraper genera dos archivos en la carpeta `output/`:

### 1. Archivo JSON (`reviews_NOMBRE_FECHA.json`)

```json
{
  "metadata": {
    "establecimiento": "Nombre del lugar",
    "place_id": "ID de Google Maps",
    "url": "URL original",
    "fecha_scraping": "2025-11-19T07:17:33.856Z",
    "total_reseñas": 215,
    "scraper_version": "1.0.0"
  },
  "estadisticas": {
    "promedio_calificacion": 4.63,
    "total_con_texto": 153,
    "total_con_fotos": 15,
    "total_con_respuesta": 213,
    "distribucion_calificaciones": {
      "1": 10,
      "2": 0,
      "3": 7,
      "4": 26,
      "5": 172
    },
    "fecha_mas_antigua": "2025-07-17T01:52:43.000Z",
    "fecha_mas_reciente": "2025-11-18T22:38:03.000Z"
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
      "editado": false,
      "fecha_edicion_iso": null,
      "fecha_edicion_relativa": null,
      "fecha_original_iso": null,
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
        "reserva": "No se requiere hacer una reserva",
        "disponibilidad_estacionamiento": "Es un poco difícil encontrar estacionamiento",
        "opciones_estacionamiento": ["Servicio de valet parking"]
      }
    }
  ]
}
```

### 2. Archivo CSV (`reviews_NOMBRE_FECHA.csv`)

Archivo plano con todas las reseñas en formato tabular, ideal para Excel o análisis de datos.

### 3. Archivo RAW (`raw_responses_NOMBRE_FECHA.json`)

Respuestas de red capturadas en crudo. Útil para depuración o re-procesamiento.

---

## 📁 Campos Extraídos

### Información del Autor

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| `autor` | Nombre del usuario | "Aldo Galdamez" |
| `autor_foto` | URL de la foto de perfil | "https://lh3.googleusercontent.com/..." |
| `autor_url_perfil` | URL del perfil en Google Maps | "https://www.google.com/maps/contrib/..." |
| `autor_user_id` | ID único del usuario | "116655925833951776444" |
| `autor_total_opiniones` | Total de opiniones del usuario | 88 |
| `autor_total_fotos` | Total de fotos subidas | 1 |
| `autor_local_guide` | Estado de Local Guide | "Local Guide · 88 opiniones" |

### Información de la Reseña

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| `calificacion` | Estrellas (1-5) | 5 |
| `texto` | Texto de la reseña | "Buena atención y servicio..." |
| `fecha_relativa` | Fecha relativa | "Hace 7 horas" |
| `fecha_iso` | Fecha ISO 8601 (última versión) | "2025-11-18T22:38:03.736Z" |
| `timestamp_segundos` | Unix timestamp (última versión) | 1763505483 |
| `editado` | Indica si fue editada | `true` / `false` |
| `fecha_edicion_relativa` | Texto con "Editado..." | "Editado Hace 1 día" |
| `fecha_edicion_iso` | Fecha de última edición ISO | "2025-11-17T22:35:41.336Z" |
| `fecha_original_iso` | Fecha de creación original | "2025-09-20T10:30:00.000Z" |
| `likes` | Número de "me gusta" | null |
| `fotos` | Array de URLs de fotos | [] |

### Respuesta del Propietario

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| `respuesta_propietario` | Texto de respuesta | "¡Qué alegría recibir tu reseña!..." |
| `respuesta_propietario_fecha` | Fecha de la respuesta | "2025-11-18T22:46:02.000Z" |

### Aspectos Guiados (Google Questions)

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| `precio_por_persona` | Rango de precio | "$200-300" |
| `comida` | Calificación de comida (1-5) | 5 |
| `servicio` | Calificación de servicio (1-5) | 5 |
| `ambiente` | Calificación de ambiente (1-5) | 5 |
| `platos_recomendados` | Lista de platos | ["Costillas Cometodo"] |
| `tiempo_espera` | Tiempo de espera | "Sin espera" |
| `nivel_ruido` | Nivel de ruido | "Ruido moderado" |
| `tamano_grupo` | Tamaño de grupo ideal | "3 o 4 personas" |
| `reserva` | Recomendación de reserva | "No se requiere hacer una reserva" |
| `disponibilidad_estacionamiento` | Facilidad para estacionar | "Es un poco difícil encontrar estacionamiento" |
| `opciones_estacionamiento` | Tipos de estacionamiento | ["Servicio de valet parking"] |

---

## 📝 Reseñas Editadas

El scraper detecta automáticamente cuando una reseña ha sido editada por el usuario y extrae tanto la fecha original como la fecha de edición.

### Campos Especiales para Reseñas Editadas

Cuando `editado: true`, se llenan estos campos adicionales:

```json
{
  "editado": true,
  "fecha_relativa": "Hace un mes",
  "fecha_edicion_relativa": "Editado Hace 1 día",
  "fecha_original_iso": "2025-09-21T00:18:08.258Z",
  "fecha_edicion_iso": "2025-11-18T00:02:55.874Z",
  "fecha_iso": "2025-11-18T00:02:55.874Z"
}
```

**Notas importantes:**
- `fecha_relativa` muestra el tiempo transcurrido desde la **creación original** ("Hace un mes")
- `fecha_edicion_relativa` contiene el indicador "Editado Hace X tiempo"
- `fecha_original_iso` muestra cuándo se creó la reseña inicialmente
- `fecha_edicion_iso` muestra cuándo se editó por última vez
- `fecha_iso` y `timestamp_segundos` siempre muestran la **última versión** (edición)

### Ejemplo Real

```json
{
  "autor": "Alma Vargas",
  "calificacion": 5,
  "texto": "Todo bien, muy servicial el señor que nos atendió.",
  "editado": true,
  "fecha_relativa": "Hace un mes",
  "fecha_edicion_relativa": "Editado Hace 1 día",
  "fecha_original_iso": "2025-09-21T00:18:08.258Z",
  "fecha_edicion_iso": "2025-11-18T00:02:55.874Z",
  "fecha_iso": "2025-11-18T00:02:55.874Z"
}
```

Esta reseña fue creada hace un mes, pero el usuario la editó hace 1 día.

---

## 🔧 Solución de Problemas

### El scraper no encuentra las reseñas

**Problema**: "Reviews tab NOT clicked"

**Solución**: Verifica que la URL sea de un establecimiento válido con reseñas públicas.

---

### Error: "Cannot find module"

**Problema**: Dependencias no instaladas

**Solución**:
```bash
npm install
```

---

### El navegador se cierra muy rápido

**Problema**: No se alcanza a hacer scroll suficiente

**Solución**: Aumenta `maxScrolls` en `index.js`:

```javascript
const scraper = new GoogleMapsScraper({
  maxScrolls: 100  // Aumenta este número
});
```

---

### Quiero ver el navegador funcionando

**Solución**: Cambia `headless: false` en `index.js`:

```javascript
const scraper = new GoogleMapsScraper({
  headless: false  // Verás el navegador Chrome
});
```

---

## 📝 Ejemplos de Uso

### Ejemplo 1: Restaurante

```bash
node index.js "https://www.google.com/maps/place/La+BTK+Bellas+Artes/@19.4338211,-99.1455109,17z/"
```

### Ejemplo 2: Hotel

```bash
node index.js "https://www.google.com/maps/place/Hotel+Example/@40.7128,-74.0060,15z/"
```

### Ejemplo 3: Tienda

```bash
node index.js "https://www.google.com/maps/place/Store+Name/@34.0522,-118.2437,15z/"
```

---

## 📈 Análisis de Datos

### Usando Excel

1. Abre el archivo CSV generado
2. Usa filtros y tablas dinámicas para analizar:
   - Distribución de calificaciones
   - Palabras más frecuentes
   - Tendencias temporales
   - Respuestas del propietario

### Usando Python (Pandas)

```python
import pandas as pd
import json

# Cargar JSON
with open('output/reviews_NOMBRE_FECHA.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Convertir a DataFrame
df = pd.DataFrame(data['reseñas'])

# Análisis básico
print(df['calificacion'].value_counts())
print(df['texto'].str.len().describe())
```

---

## ⚠️ Limitaciones y Notas Importantes

1. **Respeta los Términos de Servicio**: Usa este scraper de manera responsable
2. **Rate Limiting**: Google puede bloquear IPs si haces demasiadas peticiones
3. **Datos Dinámicos**: Los datos pueden cambiar entre ejecuciones
4. **Captchas**: Si Google detecta comportamiento automatizado, puede mostrar captchas
5. **Reseñas Privadas**: Solo extrae reseñas públicas

---

## 🛠️ Arquitectura del Scraper

```
┌─────────────────────────────────────────────────────────────┐
│                     index.js                                │
│                  (Punto de entrada)                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  src/scraper.js                             │
│  • Abre navegador con Puppeteer                            │
│  • Intercepta respuestas de red (CDP)                      │
│  • Hace clic en "Reseñas" y "Más recientes"               │
│  • Scroll automático hasta cargar todas                    │
│  • Captura endpoint /listugcposts                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  src/parser.js                              │
│  • Parsea JSON de /listugcposts                            │
│  • Extrae todos los campos de cada reseña                 │
│  • Elimina duplicados                                      │
│  • Ordena por fecha                                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                 src/exporter.js                             │
│  • Exporta a JSON (pretty-print)                           │
│  • Exporta a CSV                                           │
│  • Guarda respuestas raw                                   │
│  • Genera estadísticas                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🤝 Contribuciones

Si encuentras algún problema o quieres mejorar el scraper:

1. Reporta el issue
2. Propón mejoras
3. Comparte casos de uso

---

## 📜 Licencia

Este proyecto es de código abierto para uso educativo y de investigación.

---

## 🎓 Aprendizaje

Este scraper utiliza técnicas avanzadas:

- **Chrome DevTools Protocol (CDP)**: Interceptación de red a bajo nivel
- **Network Response Capture**: Captura de respuestas XHR
- **XPath con translate()**: Selección insensible a mayúsculas
- **Array-based JSON parsing**: Navegación de estructuras sin claves
- **Stealth mode**: Evitar detección de automatización

---

## 📞 Soporte

Si tienes preguntas o necesitas ayuda:

1. Revisa esta guía completa
2. Verifica la sección de "Solución de Problemas"
3. Consulta los ejemplos de uso
4. Reporta issues específicos con logs completos

---

**¡Feliz scraping! 🚀**
