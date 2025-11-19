const fs = require('fs').promises;
const path = require('path');

/**
 * Exportador de reseñas a diferentes formatos
 */
class ReviewsExporter {
  constructor(options = {}) {
    this.outputDir = options.outputDir || path.join(process.cwd(), 'output');
    this.prettyPrint = options.prettyPrint !== undefined ? options.prettyPrint : true;
  }

  /**
   * Exportar reseñas a JSON
   */
  async exportToJSON(reviews, metadata = {}) {
    try {
      console.log('\n📦 Preparando exportación a JSON...');

      // Asegurar que el directorio de salida existe
      await this.ensureOutputDir();

      // Generar nombre de archivo con timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const filename = `reviews_${metadata.place_name || 'google_maps'}_${timestamp}.json`;
      const filepath = path.join(this.outputDir, filename);

      // Construir objeto de salida
      const output = {
        metadata: {
          establecimiento: metadata.place_name || 'Desconocido',
          place_id: metadata.place_id || null,
          url: metadata.url || null,
          fecha_scraping: new Date().toISOString(),
          total_reseñas: reviews.length,
          scraper_version: '1.0.0'
        },
        estadisticas: this.calculateStatistics(reviews),
        reseñas: reviews
      };

      // Escribir archivo
      const jsonContent = this.prettyPrint
        ? JSON.stringify(output, null, 2)
        : JSON.stringify(output);

      await fs.writeFile(filepath, jsonContent, 'utf8');

      console.log(`✅ Archivo JSON creado: ${filename}`);
      console.log(`📍 Ubicación: ${filepath}`);
      console.log(`📊 Total de reseñas: ${reviews.length}`);

      return filepath;

    } catch (error) {
      console.error('❌ Error exportando a JSON:', error.message);
      throw error;
    }
  }

  /**
   * Exportar también las respuestas crudas capturadas (para debugging)
   */
  async exportRawResponses(responses, metadata = {}) {
    try {
      console.log('\n📦 Exportando respuestas crudas...');

      await this.ensureOutputDir();

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const filename = `raw_responses_${metadata.place_name || 'google_maps'}_${timestamp}.json`;
      const filepath = path.join(this.outputDir, filename);

      // Sanitizar respuestas para JSON (eliminar datos binarios si los hay)
      const sanitizedResponses = responses.map((r, index) => {
        const isListUgcPosts = r.isListUgcPosts || (r.url && r.url.includes('/maps/rpc/listugcposts'));

        return {
          index: index,
          url: r.url,
          timestamp: r.timestamp,
          status: r.status,
          mimeType: r.mimeType,
          bodySize: r.body ? r.body.length : 0,
          bodyPreview: r.body ? r.body.substring(0, 500) : null,
          // GUARDAR BODY COMPLETO para listugcposts (crítico para parsing) o respuestas muy grandes
          bodyFull: (isListUgcPosts || (r.body && r.body.length > 100000)) ? r.body : null,
          isListUgcPosts: isListUgcPosts,
          headers: r.headers
        };
      });

      const output = {
        metadata: {
          total_responses: responses.length,
          fecha_captura: new Date().toISOString(),
          place_name: metadata.place_name
        },
        responses: sanitizedResponses
      };

      const jsonContent = JSON.stringify(output, null, 2);
      await fs.writeFile(filepath, jsonContent, 'utf8');

      console.log(`✅ Respuestas crudas exportadas: ${filename}`);

      return filepath;

    } catch (error) {
      console.error('❌ Error exportando respuestas crudas:', error.message);
      throw error;
    }
  }

  /**
   * Exportar a CSV (opcional)
   */
  async exportToCSV(reviews, metadata = {}) {
    try {
      console.log('\n📦 Exportando a CSV...');

      await this.ensureOutputDir();

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const filename = `reviews_${metadata.place_name || 'google_maps'}_${timestamp}.csv`;
      const filepath = path.join(this.outputDir, filename);

      // Construir CSV
      const headers = [
        'Autor',
        'Calificación',
        'Texto',
        'Fecha ISO',
        'Fecha Relativa',
        'Timestamp Segundos',
        'Likes',
        'Respuesta Propietario',
        'Total Fotos'
      ];

      let csvContent = headers.join(',') + '\n';

      for (const review of reviews) {
        const row = [
          this.escapeCsv(review.autor || ''),
          review.calificacion || '',
          this.escapeCsv(review.texto || ''),
          review.fecha_iso || '',
          this.escapeCsv(review.fecha_relativa || ''),
          review.timestamp_segundos || '',
          review.likes || '',
          this.escapeCsv(review.respuesta_propietario || ''),
          review.fotos ? review.fotos.length : 0
        ];

        csvContent += row.join(',') + '\n';
      }

      await fs.writeFile(filepath, csvContent, 'utf8');

      console.log(`✅ Archivo CSV creado: ${filename}`);

      return filepath;

    } catch (error) {
      console.error('❌ Error exportando a CSV:', error.message);
      throw error;
    }
  }

  /**
   * Escapar valores para CSV
   */
  escapeCsv(value) {
    if (value === null || value === undefined) return '';

    const stringValue = String(value);

    // Si contiene comas, comillas o saltos de línea, encerrar en comillas
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return '"' + stringValue.replace(/"/g, '""') + '"';
    }

    return stringValue;
  }

  /**
   * Calcular estadísticas de las reseñas
   */
  calculateStatistics(reviews) {
    if (reviews.length === 0) {
      return {
        promedio_calificacion: 0,
        total_con_texto: 0,
        total_con_fotos: 0,
        total_con_respuesta: 0,
        distribucion_calificaciones: {},
        fecha_mas_antigua: null,
        fecha_mas_reciente: null
      };
    }

    // Calcular promedio de calificación
    const ratings = reviews.filter(r => r.calificacion !== null).map(r => r.calificacion);
    const avgRating = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
      : 0;

    // Distribución de calificaciones
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    ratings.forEach(r => {
      const rounded = Math.round(r);
      if (rounded >= 1 && rounded <= 5) {
        distribution[rounded]++;
      }
    });

    // Contar reseñas con texto, fotos, respuesta
    const withText = reviews.filter(r => r.texto && r.texto.length > 0).length;
    const withPhotos = reviews.filter(r => r.fotos && r.fotos.length > 0).length;
    const withResponse = reviews.filter(r => r.respuesta_propietario).length;

    // Fechas más antigua y reciente
    const timestamps = reviews
      .filter(r => r.timestamp_segundos)
      .map(r => r.timestamp_segundos)
      .sort((a, b) => a - b);

    const oldestDate = timestamps.length > 0
      ? new Date(timestamps[0] * 1000).toISOString()
      : null;

    const newestDate = timestamps.length > 0
      ? new Date(timestamps[timestamps.length - 1] * 1000).toISOString()
      : null;

    return {
      promedio_calificacion: Math.round(avgRating * 100) / 100,
      total_con_texto: withText,
      total_con_fotos: withPhotos,
      total_con_respuesta: withResponse,
      distribucion_calificaciones: distribution,
      fecha_mas_antigua: oldestDate,
      fecha_mas_reciente: newestDate
    };
  }

  /**
   * Asegurar que el directorio de salida existe
   */
  async ensureOutputDir() {
    try {
      await fs.access(this.outputDir);
    } catch (error) {
      // El directorio no existe, crearlo
      await fs.mkdir(this.outputDir, { recursive: true });
      console.log(`📁 Directorio de salida creado: ${this.outputDir}`);
    }
  }

  /**
   * Generar reporte de resumen en texto
   */
  generateSummaryReport(reviews, metadata = {}) {
    const stats = this.calculateStatistics(reviews);

    const report = `
╔═══════════════════════════════════════════════════════════╗
║           REPORTE DE SCRAPING - GOOGLE MAPS               ║
╚═══════════════════════════════════════════════════════════╝

ESTABLECIMIENTO: ${metadata.place_name || 'Desconocido'}
PLACE ID: ${metadata.place_id || 'N/A'}
URL: ${metadata.url || 'N/A'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 ESTADÍSTICAS GENERALES

Total de reseñas obtenidas: ${reviews.length}
Promedio de calificación: ${stats.promedio_calificacion} ⭐

Reseñas con texto: ${stats.total_con_texto}
Reseñas con fotos: ${stats.total_con_fotos}
Reseñas con respuesta del propietario: ${stats.total_con_respuesta}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⭐ DISTRIBUCIÓN DE CALIFICACIONES

5 estrellas: ${stats.distribucion_calificaciones[5] || 0} reseñas
4 estrellas: ${stats.distribucion_calificaciones[4] || 0} reseñas
3 estrellas: ${stats.distribucion_calificaciones[3] || 0} reseñas
2 estrellas: ${stats.distribucion_calificaciones[2] || 0} reseñas
1 estrella:  ${stats.distribucion_calificaciones[1] || 0} reseñas

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 RANGO DE FECHAS

Reseña más antigua: ${stats.fecha_mas_antigua || 'N/A'}
Reseña más reciente: ${stats.fecha_mas_reciente || 'N/A'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Fecha de scraping: ${new Date().toISOString()}
`;

    return report;
  }

  /**
   * Imprimir reporte en consola
   */
  printSummary(reviews, metadata = {}) {
    const report = this.generateSummaryReport(reviews, metadata);
    console.log(report);
  }
}

module.exports = ReviewsExporter;
