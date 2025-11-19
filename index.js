/**
 * Google Maps Reviews Scraper
 *
 * Scraper que utiliza Network Interception con Puppeteer y CDP
 * para obtener reseñas de Google Maps sin usar selectores HTML.
 *
 * Uso:
 *   node index.js <URL>                          # Una sola URL
 *   node index.js --batch                        # Procesar urls.json
 *   node index.js --batch urls-btk.json          # Archivo personalizado
 *
 * Ejemplos:
 *   node index.js "https://www.google.com/maps/place/BTK+..."
 *   node index.js --batch
 */

const GoogleMapsScraper = require('./src/scraper');
const GoogleMapsParser = require('./src/parser');
const ReviewsExporter = require('./src/exporter');
const fs = require('fs').promises;
const path = require('path');

// ═══════════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════════

/**
 * Extraer Place ID de una URL de Google Maps
 */
function extractPlaceId(url) {
  // Patrón: 0x[hex]:0x[hex]
  const match = url.match(/(0x[0-9a-fA-F]+:0x[0-9a-fA-F]+)/);
  return match ? match[1] : null;
}

/**
 * Extraer nombre del establecimiento de la URL
 */
function extractPlaceName(url) {
  try {
    // Patrón: /place/[nombre]/
    const match = url.match(/\/place\/([^/@]+)/);
    if (match) {
      // Decodificar URL encoding y reemplazar + por espacios
      return decodeURIComponent(match[1]).replace(/\+/g, ' ');
    }
    return 'Establecimiento';
  } catch (e) {
    return 'Establecimiento';
  }
}

/**
 * Crear slug seguro para nombres de archivo
 */
function createSafeSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

// ═══════════════════════════════════════════════════════════
// FUNCIÓN DE SCRAPING INDIVIDUAL
// ═══════════════════════════════════════════════════════════

async function scrapePlace(url, options = {}) {
  const placeId = extractPlaceId(url);
  const placeName = extractPlaceName(url);
  const slug = createSafeSlug(placeName);

  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║     GOOGLE MAPS REVIEWS SCRAPER - NETWORK INTERCEPTION    ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  console.log(`🎯 Establecimiento: ${placeName}`);
  console.log(`🔗 URL: ${url}`);
  console.log(`🆔 Place ID: ${placeId || 'No detectado'}\n`);

  let scraper = null;

  try {
    // ═══════════════════════════════════════════════════════════
    // PASO 1: SCRAPING
    // ═══════════════════════════════════════════════════════════

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('PASO 1: SCRAPING CON NETWORK INTERCEPTION');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const scraperOptions = {
      headless: options.headless !== undefined ? options.headless : false,
      timeout: options.timeout || 60000,
      scrollDelay: options.scrollDelay || 2000,
      maxScrolls: options.maxScrolls || 500,
      reviewsLimit: options.reviewsLimit || null
    };

    scraper = new GoogleMapsScraper(scraperOptions);
    const capturedResponses = await scraper.scrape(url);

    console.log(`\n✅ Scraping completado`);
    console.log(`📦 Respuestas capturadas: ${capturedResponses.length}\n`);

    // ═══════════════════════════════════════════════════════════
    // PASO 2: PARSING
    // ═══════════════════════════════════════════════════════════

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('PASO 2: PARSING DE RESPUESTAS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const parser = new GoogleMapsParser();
    parser.parseResponses(capturedResponses);
    parser.removeDuplicates();
    parser.sortByDate();

    const finalReviews = parser.getParsedReviews();
    const errors = parser.getErrors();

    console.log(`\n✅ Parsing completado`);
    console.log(`📝 Reseñas únicas: ${finalReviews.length}`);
    console.log(`⚠️  Errores de parsing: ${errors.length}\n`);

    if (finalReviews.length === 0) {
      console.log('\n⚠️  ADVERTENCIA: No se pudieron extraer reseñas de las respuestas capturadas.');
      console.log('Esto puede deberse a:');
      console.log('  1. El formato de respuesta de Google Maps ha cambiado');
      console.log('  2. Las respuestas están en formato Protocol Buffer que requiere decodificación especial');
      console.log('  3. No se capturaron los endpoints correctos');
      console.log('\nRevisando respuestas crudas exportadas para debugging...\n');
    }

    // ═══════════════════════════════════════════════════════════
    // PASO 3: EXPORTACIÓN
    // ═══════════════════════════════════════════════════════════

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('PASO 3: EXPORTACIÓN DE RESULTADOS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const exporterOptions = {
      outputDir: options.outputDir || './output',
      prettyPrint: true,
    };

    const exporter = new ReviewsExporter(exporterOptions);

    const metadata = {
      place_name: placeName,
      place_id: placeId,
      url: url,
      slug: slug
    };

    // Exportar reseñas a JSON
    const jsonPath = await exporter.exportToJSON(finalReviews, metadata);

    // Exportar respuestas crudas (para debugging)
    if (options.exportRaw !== false) {
      await exporter.exportRawResponses(capturedResponses, metadata);
    }

    // Exportar a CSV (opcional)
    if (options.exportCSV && finalReviews.length > 0) {
      await exporter.exportToCSV(finalReviews, metadata);
    }

    // ═══════════════════════════════════════════════════════════
    // PASO 4: REPORTE FINAL
    // ═══════════════════════════════════════════════════════════

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('REPORTE FINAL');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    exporter.printSummary(finalReviews, metadata);

    // Mostrar muestra de reseñas
    if (finalReviews.length > 0) {
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('MUESTRA DE RESEÑAS (primeras 3)');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      for (let i = 0; i < Math.min(3, finalReviews.length); i++) {
        const review = finalReviews[i];
        console.log(`Reseña ${i + 1}:`);
        console.log(`  Autor: ${review.autor || 'N/A'}`);
        console.log(`  Calificación: ${review.calificacion ? '⭐'.repeat(review.calificacion) : 'N/A'} (${review.calificacion || 'N/A'})`);
        console.log(`  Fecha: ${review.fecha_iso || review.fecha_relativa || 'N/A'}`);
        console.log(`  Texto: ${review.texto ? review.texto.substring(0, 150) + '...' : 'Sin texto'}`);
        console.log('');
      }
    }

    console.log('\n✅ Proceso completado exitosamente!\n');

    return {
      success: true,
      placeName,
      placeId,
      reviewsCount: finalReviews.length,
      outputPath: jsonPath
    };

  } catch (error) {
    console.error('\n❌ ERROR FATAL:', error.message);
    console.error('\nStack trace:', error.stack);

    return {
      success: false,
      placeName,
      placeId,
      error: error.message
    };

  } finally {
    if (scraper) {
      await scraper.close();
    }
  }
}

// ═══════════════════════════════════════════════════════════
// PROCESAMIENTO BATCH
// ═══════════════════════════════════════════════════════════

async function processBatch(configFile = 'urls.json', options = {}) {
  console.log(`\n🔄 MODO BATCH - Procesando múltiples URLs desde: ${configFile}\n`);

  try {
    // Leer archivo de configuración
    const configPath = path.join(process.cwd(), configFile);
    const configData = await fs.readFile(configPath, 'utf8');
    const config = JSON.parse(configData);

    const urls = config.urls || [];

    if (urls.length === 0) {
      console.log('⚠️  No se encontraron URLs en el archivo de configuración');
      return;
    }

    console.log(`📋 Total de URLs a procesar: ${urls.length}\n`);

    const results = [];

    // Procesar cada URL
    for (let i = 0; i < urls.length; i++) {
      const urlConfig = urls[i];
      const url = typeof urlConfig === 'string' ? urlConfig : urlConfig.url;

      console.log(`\n${'═'.repeat(60)}`);
      console.log(`PROCESANDO ${i + 1}/${urls.length}: ${extractPlaceName(url)}`);
      console.log(`${'═'.repeat(60)}\n`);

      // Mergear opciones específicas de la URL con opciones globales
      const urlOptions = typeof urlConfig === 'object' ? { ...options, ...urlConfig } : options;

      const result = await scrapePlace(url, urlOptions);
      results.push(result);

      // Delay entre scrapes para evitar rate limiting
      if (i < urls.length - 1) {
        const delay = options.delayBetweenScrapes || 5000;
        console.log(`\n⏳ Esperando ${delay / 1000} segundos antes del siguiente scrape...\n`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // Reporte final de batch
    console.log('\n\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║              REPORTE FINAL - PROCESAMIENTO BATCH          ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`✅ Exitosos: ${successful}/${urls.length}`);
    console.log(`❌ Fallidos: ${failed}/${urls.length}\n`);

    results.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      const info = result.success
        ? `${result.reviewsCount} reseñas`
        : `Error: ${result.error}`;

      console.log(`${status} ${index + 1}. ${result.placeName} - ${info}`);
    });

    console.log('\n');

  } catch (error) {
    console.error('❌ Error en procesamiento batch:', error.message);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════
// FUNCIÓN PRINCIPAL
// ═══════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);

  try {
    // Modo batch
    if (args[0] === '--batch') {
      const configFile = args[1] || 'urls.json';
      await processBatch(configFile, {
        headless: false,
        exportRaw: true,
        exportCSV: true,
        delayBetweenScrapes: 5000
      });
    }
    // Modo single URL desde argumentos
    else if (args[0] && args[0].startsWith('http')) {
      await scrapePlace(args[0], {
        headless: false,
        exportRaw: true,
        exportCSV: true
      });
    }
    // Sin argumentos - mostrar ayuda
    else {
      console.log(`
╔═══════════════════════════════════════════════════════════╗
║     GOOGLE MAPS REVIEWS SCRAPER - NETWORK INTERCEPTION    ║
╚═══════════════════════════════════════════════════════════╝

USO:
  node index.js <URL>                    Scrapear una sola URL
  node index.js --batch                  Procesar urls.json
  node index.js --batch <archivo>        Procesar archivo personalizado

EJEMPLOS:
  node index.js "https://www.google.com/maps/place/BTK+Tecnol%C3%B3gico/..."
  node index.js --batch
  node index.js --batch urls-btk.json

ARCHIVOS:
  urls.json          Archivo con múltiples URLs (crear con urls-example.json)
  output/            Carpeta donde se guardan los resultados

NOTA:
  Si no proporcionas argumentos, crea un archivo urls.json con tus URLs
  o usa el modo single URL.
      `);
    }

  } catch (error) {
    console.error('\n❌ ERROR FATAL:', error.message);
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════════════════
// MANEJO DE ERRORES GLOBALES
// ═══════════════════════════════════════════════════════════

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// ═══════════════════════════════════════════════════════════
// EJECUTAR
// ═══════════════════════════════════════════════════════════

if (require.main === module) {
  main();
}

module.exports = {
  GoogleMapsScraper,
  GoogleMapsParser,
  ReviewsExporter,
  scrapePlace,
  processBatch
};
