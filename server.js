/**
 * API REST para Google Maps Scraper
 *
 * Endpoint: POST /api/scrape
 * Body: { url: string, maxScrolls?: number, headless?: boolean }
 * Response: { success: boolean, data: {...}, error?: string }
 */

const express = require('express');
const cors = require('cors');
const GoogleMapsScraper = require('./src/scraper');
const GoogleMapsParser = require('./src/parser');
const jobManager = require('./src/jobManager');
const jobWorker = require('./src/jobWorker');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Logger middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.1.0'
  });
});

/**
 * Endpoint principal de scraping (ASÍNCRONO - retorna jobId inmediatamente)
 * POST /api/scrape
 */
app.post('/api/scrape', async (req, res) => {
  try {
    // Validar parámetros
    const { url, maxScrolls, headless, scrollDelay, waitAfterSort, reviewsLimit, timeout } = req.body;

    // Validación de URL (requerido)
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'El parámetro "url" es requerido',
        example: {
          url: 'https://www.google.com/maps/place/...',
          maxScrolls: 20,
          headless: true
        }
      });
    }

    // Validar que la URL sea de Google Maps
    if (!url.includes('google.com/maps')) {
      return res.status(400).json({
        success: false,
        error: 'La URL debe ser de Google Maps',
        providedUrl: url
      });
    }

    // Crear job con las opciones
    const job = jobManager.createJob(url, {
      maxScrolls: maxScrolls || 20,
      headless: headless !== undefined ? headless : true,
      scrollDelay: scrollDelay || 2000,
      waitAfterSort: waitAfterSort || 3000,
      reviewsLimit: reviewsLimit || null,
      timeout: timeout || 60000
    });

    // Responder inmediatamente con el job
    return res.status(202).json({
      success: true,
      message: 'Job creado exitosamente. El scraping se está procesando de forma asíncrona.',
      job: {
        jobId: job.jobId,
        status: job.status,
        url: job.url,
        createdAt: job.createdAt,
        progress: job.progress
      },
      links: {
        status: `/api/jobs/${job.jobId}`,
        allJobs: '/api/jobs'
      }
    });

  } catch (error) {
    console.error('❌ Error creando job:', error);

    return res.status(500).json({
      success: false,
      error: error.message || 'Error interno del servidor',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * Endpoint para obtener solo estadísticas (sin reseñas completas)
 * POST /api/scrape/stats
 */
app.post('/api/scrape/stats', async (req, res) => {
  const startTime = Date.now();

  try {
    const { url, maxScrolls, headless } = req.body;

    if (!url || !url.includes('google.com/maps')) {
      return res.status(400).json({
        success: false,
        error: 'URL de Google Maps válida es requerida'
      });
    }

    const scraperOptions = {
      headless: headless !== false,
      maxScrolls: maxScrolls || 20
    };

    console.log('\n📊 Obteniendo estadísticas...');

    const scraper = new GoogleMapsScraper(scraperOptions);
    const parser = new GoogleMapsParser();

    const result = await scraper.scrape(url);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }

    parser.parseResponses(result.capturedResponses);
    parser.removeDuplicates();
    parser.sortByDate();

    const reviews = parser.getParsedReviews();
    const statistics = calculateStatistics(reviews);
    const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`✅ Estadísticas obtenidas en ${executionTime}s`);

    return res.json({
      success: true,
      data: {
        metadata: {
          establecimiento: result.placeInfo?.name || 'N/A',
          total_reseñas: reviews.length,
          fecha_scraping: new Date().toISOString(),
          execution_time_seconds: parseFloat(executionTime)
        },
        estadisticas: statistics
      }
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================
// NUEVOS ENDPOINTS - SISTEMA DE JOBS
// ========================================

/**
 * Obtener estado de un job específico
 * GET /api/jobs/:jobId
 */
app.get('/api/jobs/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobManager.getJob(jobId);

  if (!job) {
    return res.status(404).json({
      success: false,
      error: 'Job no encontrado',
      jobId
    });
  }

  return res.json({
    success: true,
    job
  });
});

/**
 * Listar todos los jobs (con filtros opcionales)
 * GET /api/jobs?status=pending|processing|completed|failed
 */
app.get('/api/jobs', (req, res) => {
  const { status, limit } = req.query;

  const filters = {};
  if (status) {
    filters.status = status;
  }

  let jobs = jobManager.getAllJobs(filters);

  // Aplicar límite si se especifica
  if (limit) {
    const limitNum = parseInt(limit, 10);
    if (!isNaN(limitNum) && limitNum > 0) {
      jobs = jobs.slice(0, limitNum);
    }
  }

  const stats = jobManager.getStats();

  return res.json({
    success: true,
    stats,
    jobs
  });
});

/**
 * Cancelar un job específico
 * DELETE /api/jobs/:jobId
 */
app.delete('/api/jobs/:jobId', (req, res) => {
  const { jobId } = req.params;
  const cancelled = jobManager.cancelJob(jobId);

  if (!cancelled) {
    return res.status(400).json({
      success: false,
      error: 'No se pudo cancelar el job. Puede que no exista o ya esté completado/fallido.',
      jobId
    });
  }

  return res.json({
    success: true,
    message: 'Job cancelado exitosamente',
    jobId
  });
});

/**
 * Limpiar jobs completados/fallidos
 * DELETE /api/jobs
 */
app.delete('/api/jobs', (req, res) => {
  const cleaned = jobManager.cleanupCompletedJobs();

  return res.json({
    success: true,
    message: `${cleaned} jobs limpiados`,
    cleaned
  });
});

/**
 * Obtener configuración actual
 * GET /api/config
 */
app.get('/api/config', (req, res) => {
  const config = jobManager.getConfig();
  const stats = jobManager.getStats();

  return res.json({
    success: true,
    config,
    currentLoad: {
      processing: stats.processing,
      pending: stats.pending,
      maxConcurrent: config.maxConcurrentJobs
    }
  });
});

/**
 * Actualizar configuración
 * PUT /api/config
 * Body: { maxConcurrentJobs?: number }
 */
app.put('/api/config', (req, res) => {
  const { maxConcurrentJobs } = req.body;

  if (maxConcurrentJobs !== undefined) {
    if (typeof maxConcurrentJobs !== 'number' || maxConcurrentJobs < 1 || maxConcurrentJobs > 10) {
      return res.status(400).json({
        success: false,
        error: 'maxConcurrentJobs debe ser un número entre 1 y 10'
      });
    }
  }

  jobManager.updateConfig({ maxConcurrentJobs });

  return res.json({
    success: true,
    message: 'Configuración actualizada',
    config: jobManager.getConfig()
  });
});

/**
 * Endpoint de documentación
 */
app.get('/', (req, res) => {
  const config = jobManager.getConfig();
  const stats = jobManager.getStats();

  res.json({
    name: 'Google Maps Scraper API - Sistema de Jobs Asíncrono',
    version: '2.0.0',
    description: 'API con sistema de jobs para scraping asíncrono de Google Maps',
    systemStatus: {
      jobsProcessing: stats.processing,
      jobsPending: stats.pending,
      jobsCompleted: stats.completed,
      jobsFailed: stats.failed,
      maxConcurrentJobs: config.maxConcurrentJobs
    },
    endpoints: {
      'GET /health': 'Health check',
      'POST /api/scrape': 'Crear job de scraping (retorna inmediatamente con jobId)',
      'GET /api/jobs/:jobId': 'Obtener estado y resultado de un job',
      'GET /api/jobs': 'Listar todos los jobs (filtrar con ?status=pending|processing|completed|failed)',
      'DELETE /api/jobs/:jobId': 'Cancelar un job específico',
      'DELETE /api/jobs': 'Limpiar jobs completados/fallidos',
      'GET /api/config': 'Obtener configuración actual',
      'PUT /api/config': 'Actualizar configuración (ej: maxConcurrentJobs)',
      'POST /api/scrape/stats': 'Obtener solo estadísticas (endpoint legacy - bloqueante)',
      'GET /': 'Esta documentación'
    },
    examples: {
      createJob: {
        method: 'POST',
        url: '/api/scrape',
        body: {
          url: 'https://www.google.com/maps/place/...',
          maxScrolls: 20,
          headless: true,
          scrollDelay: 2000,
          waitAfterSort: 3000,
          reviewsLimit: null,
          timeout: 60000
        },
        response: {
          success: true,
          message: 'Job creado exitosamente...',
          job: { jobId: 'job_1234567890_abc123', status: 'pending', url: '...', createdAt: '...', progress: {} },
          links: { status: '/api/jobs/job_1234567890_abc123', allJobs: '/api/jobs' }
        }
      },
      checkJobStatus: {
        method: 'GET',
        url: '/api/jobs/job_1234567890_abc123',
        response: {
          success: true,
          job: {
            jobId: 'job_1234567890_abc123',
            status: 'completed',
            progress: { percentage: 100, message: 'Completado' },
            result: { reviews: [], statistics: {} }
          }
        }
      },
      updateConfig: {
        method: 'PUT',
        url: '/api/config',
        body: { maxConcurrentJobs: 5 }
      }
    },
    documentation: 'Ver GUIA-DE-USO.md para más información'
  });
});

/**
 * Manejo de rutas no encontradas
 */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint no encontrado',
    availableEndpoints: [
      'GET /health',
      'POST /api/scrape',
      'GET /api/jobs/:jobId',
      'GET /api/jobs',
      'DELETE /api/jobs/:jobId',
      'DELETE /api/jobs',
      'GET /api/config',
      'PUT /api/config',
      'POST /api/scrape/stats',
      'GET /'
    ]
  });
});

/**
 * Manejo de errores global
 */
app.use((err, req, res, next) => {
  console.error('Error global:', err);
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor',
    message: err.message
  });
});

/**
 * Función auxiliar para calcular estadísticas
 */
function calculateStatistics(reviews) {
  if (!reviews || reviews.length === 0) {
    return {
      promedio_calificacion: 0,
      total_con_texto: 0,
      total_con_fotos: 0,
      total_con_respuesta: 0,
      total_editadas: 0,
      distribucion_calificaciones: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
      fecha_mas_antigua: null,
      fecha_mas_reciente: null
    };
  }

  const stats = {
    promedio_calificacion: 0,
    total_con_texto: 0,
    total_con_fotos: 0,
    total_con_respuesta: 0,
    total_editadas: 0,
    distribucion_calificaciones: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
    fecha_mas_antigua: null,
    fecha_mas_reciente: null
  };

  let sumaCalificaciones = 0;
  let fechas = [];

  for (const review of reviews) {
    // Calificaciones
    if (review.calificacion) {
      sumaCalificaciones += review.calificacion;
      stats.distribucion_calificaciones[review.calificacion.toString()]++;
    }

    // Contadores
    if (review.texto && review.texto.trim().length > 0) {
      stats.total_con_texto++;
    }
    if (review.fotos && review.fotos.length > 0) {
      stats.total_con_fotos++;
    }
    if (review.respuesta_propietario) {
      stats.total_con_respuesta++;
    }
    if (review.editado) {
      stats.total_editadas++;
    }

    // Fechas
    if (review.fecha_iso) {
      fechas.push(new Date(review.fecha_iso));
    }
  }

  // Promedio
  if (reviews.length > 0) {
    stats.promedio_calificacion = parseFloat((sumaCalificaciones / reviews.length).toFixed(2));
  }

  // Fechas extremas
  if (fechas.length > 0) {
    fechas.sort((a, b) => a - b);
    stats.fecha_mas_antigua = fechas[0].toISOString();
    stats.fecha_mas_reciente = fechas[fechas.length - 1].toISOString();
  }

  return stats;
}

/**
 * Iniciar servidor
 */
const server = app.listen(PORT, () => {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║     GOOGLE MAPS SCRAPER API - RUNNING                     ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  console.log(`🚀 Servidor iniciado en http://localhost:${PORT}`);
  console.log(`📚 Documentación: http://localhost:${PORT}/`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`📡 Endpoint principal: POST http://localhost:${PORT}/api/scrape`);
  console.log('\n💡 Ejemplo de uso:');
  console.log('   curl -X POST http://localhost:3000/api/scrape \\');
  console.log('        -H "Content-Type: application/json" \\');
  console.log('        -d \'{"url":"https://www.google.com/maps/place/...","maxScrolls":20}\'');
  console.log('\n⌨️  Presiona Ctrl+C para detener el servidor\n');
});

// Manejo de señales de terminación
process.on('SIGTERM', () => {
  console.log('\n🛑 Señal SIGTERM recibida, cerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n\n🛑 Servidor detenido por el usuario (Ctrl+C)');
  server.close(() => {
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
});

module.exports = app;
