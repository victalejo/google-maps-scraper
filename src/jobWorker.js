const jobManager = require('./jobManager');
const GoogleMapsScraper = require('./scraper');
const GoogleMapsParser = require('./parser');
const DataExporter = require('./exporter');

/**
 * Job Worker - Procesa jobs de la cola de forma asíncrona
 * Respeta el límite de jobs concurrentes configurado
 */
class JobWorker {
  constructor() {
    this.isProcessing = false;
    this.processingTimeout = null;

    // Escuchar eventos de jobs
    jobManager.on('job:created', () => this.processQueue());
    jobManager.on('config:updated', () => this.processQueue());

    console.log('🚀 Job Worker iniciado');
  }

  /**
   * Inicia el procesamiento de la cola
   */
  async processQueue() {
    // Si ya está procesando, no hacer nada
    if (this.isProcessing) return;

    this.isProcessing = true;

    try {
      while (true) {
        // Verificar cuántos jobs están en procesamiento
        const processingJobs = jobManager.getProcessingJobs();
        const config = jobManager.getConfig();

        // Si ya alcanzamos el límite, esperar
        if (processingJobs.length >= config.maxConcurrentJobs) {
          break;
        }

        // Obtener el siguiente job pendiente
        const pendingJobs = jobManager.getPendingJobs();
        if (pendingJobs.length === 0) {
          break; // No hay más jobs pendientes
        }

        const nextJob = pendingJobs[0];

        // Procesar el job (no esperar a que termine)
        this.processJob(nextJob.jobId).catch(err => {
          console.error(`❌ Error procesando job ${nextJob.jobId}:`, err);
        });

        // Pequeña pausa para evitar race conditions
        await this.sleep(100);
      }
    } finally {
      this.isProcessing = false;

      // Si hay más jobs pendientes, reprogramar procesamiento
      const pendingJobs = jobManager.getPendingJobs();
      if (pendingJobs.length > 0) {
        // Reintentar en 2 segundos
        if (this.processingTimeout) clearTimeout(this.processingTimeout);
        this.processingTimeout = setTimeout(() => this.processQueue(), 2000);
      }
    }
  }

  /**
   * Procesa un job individual
   * @param {string} jobId - ID del job a procesar
   */
  async processJob(jobId) {
    const job = jobManager.getJob(jobId);
    if (!job) {
      console.error(`❌ Job no encontrado: ${jobId}`);
      return;
    }

    console.log(`\n🔵 Iniciando procesamiento del job: ${jobId}`);
    console.log(`   URL: ${job.url}`);
    console.log(`   Opciones: maxScrolls=${job.options.maxScrolls}, headless=${job.options.headless}`);

    // Marcar como en procesamiento
    jobManager.updateJobStatus(jobId, 'processing', {
      progress: {
        current: 0,
        total: job.options.maxScrolls,
        percentage: 0,
        message: 'Iniciando navegador...',
      },
    });

    let scraper = null;

    try {
      // Crear scraper con opciones del job
      scraper = new GoogleMapsScraper({
        headless: job.options.headless,
        maxScrolls: job.options.maxScrolls,
        scrollDelay: job.options.scrollDelay,
        waitAfterSort: job.options.waitAfterSort,
        timeout: job.options.timeout,
        reviewsLimit: job.options.reviewsLimit,
        onProgress: (current, total, message) => {
          // Callback de progreso
          jobManager.updateJobProgress(jobId, current, total, message);
        },
      });

      // Actualizar progreso
      jobManager.updateJobProgress(jobId, 0, job.options.maxScrolls, 'Navegador iniciado, comenzando scraping...');

      // Ejecutar scraping
      const capturedResponses = await scraper.scrape(job.url);

      // Actualizar progreso
      jobManager.updateJobProgress(jobId, job.options.maxScrolls, job.options.maxScrolls, 'Parseando datos...');

      // Parsear respuestas
      const parser = new GoogleMapsParser();
      parser.parseResponses(capturedResponses);

      const reviewsBeforeCleanup = parser.getParsedReviews().length;
      parser.removeDuplicates();
      parser.sortByDate();

      const reviews = parser.getParsedReviews();

      // Calcular estadísticas
      const statistics = this.calculateStatistics(reviews);

      // Preparar resultado
      const result = {
        url: job.url,
        timestamp: new Date().toISOString(),
        reviews,
        statistics,
        metadata: {
          capturedResponsesCount: capturedResponses.length,
          reviewsBeforeCleanup,
          reviewsAfterCleanup: reviews.length,
          duplicatesRemoved: reviewsBeforeCleanup - reviews.length,
          scrapingOptions: job.options,
        },
      };

      // Exportar a archivo (opcional)
      try {
        const exporter = new DataExporter(reviews);
        const filename = `job_${jobId}_${Date.now()}`;
        await exporter.saveToJSON(filename);
        result.exportedFile = `output/${filename}.json`;
        console.log(`💾 Datos guardados en: ${result.exportedFile}`);
      } catch (exportError) {
        console.warn('⚠️  Error al exportar archivo:', exportError.message);
        // No fallar el job por error de exportación
      }

      // Marcar job como completado
      jobManager.completeJob(jobId, result);

      console.log(`✅ Job completado: ${jobId}`);
      console.log(`   Reviews obtenidas: ${reviews.length}`);
      console.log(`   Promedio calificación: ${statistics.averageRating}`);

    } catch (error) {
      console.error(`❌ Error en job ${jobId}:`, error.message);
      jobManager.failJob(jobId, error);

    } finally {
      // ⚠️ CRÍTICO: Cerrar navegador SIEMPRE, incluso si hay error
      if (scraper) {
        try {
          await scraper.close();
          console.log(`🔴 Navegador cerrado para job: ${jobId}`);
        } catch (closeError) {
          console.error(`❌ Error al cerrar navegador del job ${jobId}:`, closeError.message);
        }
      }

      // Procesar siguiente job en la cola
      setTimeout(() => this.processQueue(), 500);
    }
  }

  /**
   * Calcula estadísticas de las reviews
   * @param {array} reviews - Array de reviews
   * @returns {object} - Estadísticas
   */
  calculateStatistics(reviews) {
    if (!reviews || reviews.length === 0) {
      return {
        totalReviews: 0,
        averageRating: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        withText: 0,
        withPhotos: 0,
        withOwnerResponse: 0,
        localGuides: 0,
        aspectsStatistics: {},
      };
    }

    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let withText = 0;
    let withPhotos = 0;
    let withOwnerResponse = 0;
    let localGuides = 0;
    let totalRating = 0;

    // Aspectos
    const aspectsCount = {
      comida: { sum: 0, count: 0 },
      servicio: { sum: 0, count: 0 },
      ambiente: { sum: 0, count: 0 },
    };

    reviews.forEach(review => {
      // Calificación
      if (review.calificacion) {
        totalRating += review.calificacion;
        ratingDistribution[review.calificacion]++;
      }

      // Textos y fotos
      if (review.texto && review.texto.trim().length > 0) withText++;
      if (review.fotos && review.fotos.length > 0) withPhotos++;
      if (review.respuesta_propietario) withOwnerResponse++;
      if (review.autor_local_guide) localGuides++;

      // Aspectos
      if (review.aspectos) {
        if (review.aspectos.comida) {
          aspectsCount.comida.sum += review.aspectos.comida;
          aspectsCount.comida.count++;
        }
        if (review.aspectos.servicio) {
          aspectsCount.servicio.sum += review.aspectos.servicio;
          aspectsCount.servicio.count++;
        }
        if (review.aspectos.ambiente) {
          aspectsCount.ambiente.sum += review.aspectos.ambiente;
          aspectsCount.ambiente.count++;
        }
      }
    });

    const averageRating = reviews.length > 0 ? (totalRating / reviews.length).toFixed(2) : 0;

    return {
      totalReviews: reviews.length,
      averageRating: parseFloat(averageRating),
      ratingDistribution,
      withText,
      withPhotos,
      withOwnerResponse,
      localGuides,
      percentageWithText: reviews.length > 0 ? ((withText / reviews.length) * 100).toFixed(1) : 0,
      percentageWithPhotos: reviews.length > 0 ? ((withPhotos / reviews.length) * 100).toFixed(1) : 0,
      percentageWithOwnerResponse: reviews.length > 0 ? ((withOwnerResponse / reviews.length) * 100).toFixed(1) : 0,
      percentageLocalGuides: reviews.length > 0 ? ((localGuides / reviews.length) * 100).toFixed(1) : 0,
      aspectsStatistics: {
        comida: aspectsCount.comida.count > 0
          ? (aspectsCount.comida.sum / aspectsCount.comida.count).toFixed(2)
          : null,
        servicio: aspectsCount.servicio.count > 0
          ? (aspectsCount.servicio.sum / aspectsCount.servicio.count).toFixed(2)
          : null,
        ambiente: aspectsCount.ambiente.count > 0
          ? (aspectsCount.ambiente.sum / aspectsCount.ambiente.count).toFixed(2)
          : null,
      },
    };
  }

  /**
   * Utilidad para pausar ejecución
   * @param {number} ms - Milisegundos
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Crear instancia singleton y exportar
const jobWorker = new JobWorker();

module.exports = jobWorker;
