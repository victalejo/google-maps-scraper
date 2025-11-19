# 📋 Changelog - Google Maps Scraper

## [1.1.0] - 2025-11-19

### ✅ Correcciones Críticas

#### 🐛 Fix: Detección de Reseñas Editadas
**Problema**: Las reseñas que habían sido editadas por los usuarios no se detectaban correctamente. El campo `editado` siempre aparecía como `false`.

**Causa**: El parser buscaba el indicador "Editado" en la ubicación incorrecta del JSON:
- ❌ Ubicación incorrecta: `reviewArray[3][3]`
- ✅ Ubicación correcta: `reviewArray[1][6]`

**Solución**: Actualizado `src/parser.js` líneas 352-359 para verificar `reviewArray[1][6]` en lugar de `reviewArray[3][3]`.

**Resultado**:
- ✅ Reseñas editadas ahora se detectan correctamente
- ✅ `fecha_original_iso` muestra cuándo se creó la reseña
- ✅ `fecha_edicion_iso` muestra cuándo se editó por última vez
- ✅ `fecha_edicion_relativa` muestra el texto "Editado Hace X tiempo"
- ✅ `fecha_iso` siempre muestra la última versión (edición)

**Ejemplo**:
```json
{
  "autor": "Alma Vargas",
  "editado": true,
  "fecha_relativa": "Hace un mes",
  "fecha_edicion_relativa": "Editado Hace 1 día",
  "fecha_original_iso": "2025-09-21T00:18:08.258Z",
  "fecha_edicion_iso": "2025-11-18T00:02:55.874Z",
  "fecha_iso": "2025-11-18T00:02:55.874Z"
}
```

**Testing**: Verificado con la reseña de Alma Vargas en La BTK Arboledas. Se encontraron 14 reseñas editadas en total en esa ubicación.

---

### ✨ Nuevas Funcionalidades (versión anterior 1.0.1)

#### Campos de Estacionamiento
Agregados nuevos campos para información de estacionamiento:
- `disponibilidad_estacionamiento`: Facilidad para encontrar estacionamiento
- `opciones_estacionamiento`: Array con tipos de estacionamiento disponibles (valet, pagado, etc.)

**Ejemplo**:
```json
{
  "aspectos": {
    "disponibilidad_estacionamiento": "Es un poco difícil encontrar estacionamiento",
    "opciones_estacionamiento": ["Servicio de valet parking", "Estacionamiento pagado en la calle"]
  }
}
```

---

## [1.0.0] - 2025-11-19

### 🎉 Versión Inicial

- ✅ Interceptación de red con Chrome DevTools Protocol
- ✅ Extracción completa de datos de reseñas:
  - Información del autor (nombre, foto, Local Guide, total opiniones)
  - Texto de la reseña y calificación
  - Fechas (ISO + relativa)
  - Respuestas del propietario
  - Aspectos guiados (comida, servicio, ambiente, etc.)
  - Platos recomendados
  - Fotos
- ✅ Exportación a JSON y CSV
- ✅ Eliminación automática de duplicados
- ✅ Ordenamiento por fecha
- ✅ Estadísticas automáticas
- ✅ Modo headless por defecto
- ✅ Stealth mode para evitar detección

---

## 🔜 Próximas Mejoras

- [ ] Soporte para múltiples idiomas
- [ ] Exportación a Excel (.xlsx)
- [ ] Filtros por calificación y fecha
- [ ] Análisis de sentimiento
- [ ] Generación de gráficos y reportes visuales

---

## 📝 Notas de Versión

### Estructura de Datos de Google Maps

**Campos Importantes**:
- `reviewArray[1][2]`: Timestamp original (microsegundos)
- `reviewArray[1][3]`: Timestamp de edición (microsegundos)
- `reviewArray[1][6]`: Texto "Editado Hace X tiempo" (si existe)
- `reviewArray[3][3]`: Fecha relativa ("Hace un mes")
- `reviewArray[2][15][0][0]`: Texto de la reseña
- `reviewArray[1][4][5]`: Datos del autor

**Conversión de Timestamps**:
- Google Maps usa microsegundos (16 dígitos)
- Dividir por 1000 para obtener milisegundos
- Validar que sea > 946684800000 (1 de enero de 2000)
