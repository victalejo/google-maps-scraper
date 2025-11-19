const EventEmitter = require('events');
const crypto = require('crypto');

/**
 * Job Manager - Gestiona el ciclo de vida de los jobs de scraping
 * Mantiene estado en memoria de todos los jobs
 */
class JobManager extends EventEmitter {
  constructor() {
    super();
    this.jobs = new Map(); // jobId -> job object
    this.config = {
      maxConcurrentJobs: 3, // Máximo de jobs simultáneos
      cleanupCompletedAfter: 3600000, // Limpiar jobs completados después de 1 hora (ms)
    };

    // Iniciar limpieza automática de jobs antiguos
    this.startAutoCleanup();
  }

  /**
   * Genera un ID único para un job
   * @returns {string} - Job ID único
   */
  generateJobId() {
    return `job_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Crea un nuevo job
   * @param {string} url - URL a scrapear
   * @param {object} options - Opciones de scraping
   * @returns {object} - Job creado
   */
  createJob(url, options = {}) {
    const jobId = this.generateJobId();
    const job = {
      jobId,
      status: 'pending',
      url,
      options: {
        maxScrolls: options.maxScrolls || 20,
        headless: options.headless !== undefined ? options.headless : true,
        scrollDelay: options.scrollDelay || 2000,
        waitAfterSort: options.waitAfterSort || 3000,
        timeout: options.timeout || 60000,
        reviewsLimit: options.reviewsLimit || null,
      },
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      progress: {
        current: 0,
        total: options.maxScrolls || 20,
        percentage: 0,
        message: 'En cola',
      },
      result: null,
      error: null,
    };

    this.jobs.set(jobId, job);
    this.emit('job:created', job);

    console.log(`📋 Job creado: ${jobId} para URL: ${url}`);
    return job;
  }

  /**
   * Obtiene un job por su ID
   * @param {string} jobId - ID del job
   * @returns {object|null} - Job o null si no existe
   */
  getJob(jobId) {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Obtiene todos los jobs con filtros opcionales
   * @param {object} filters - Filtros { status: 'pending' | 'processing' | 'completed' | 'failed' }
   * @returns {array} - Array de jobs
   */
  getAllJobs(filters = {}) {
    let jobs = Array.from(this.jobs.values());

    if (filters.status) {
      jobs = jobs.filter(job => job.status === filters.status);
    }

    // Ordenar por fecha de creación (más recientes primero)
    jobs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return jobs;
  }

  /**
   * Obtiene jobs pendientes (en cola)
   * @returns {array} - Array de jobs pendientes
   */
  getPendingJobs() {
    return this.getAllJobs({ status: 'pending' });
  }

  /**
   * Obtiene jobs en procesamiento
   * @returns {array} - Array de jobs en procesamiento
   */
  getProcessingJobs() {
    return this.getAllJobs({ status: 'processing' });
  }

  /**
   * Actualiza el estado de un job
   * @param {string} jobId - ID del job
   * @param {string} status - Nuevo estado
   * @param {object} updates - Otros campos a actualizar
   */
  updateJobStatus(jobId, status, updates = {}) {
    const job = this.jobs.get(jobId);
    if (!job) {
      console.warn(`⚠️  Job no encontrado: ${jobId}`);
      return;
    }

    const oldStatus = job.status;
    job.status = status;

    // Actualizar timestamps según el estado
    if (status === 'processing' && !job.startedAt) {
      job.startedAt = new Date().toISOString();
    }

    if ((status === 'completed' || status === 'failed') && !job.completedAt) {
      job.completedAt = new Date().toISOString();
    }

    // Aplicar otras actualizaciones
    Object.assign(job, updates);

    this.emit('job:updated', job, oldStatus);

    console.log(`🔄 Job ${jobId}: ${oldStatus} → ${status}`);
  }

  /**
   * Actualiza el progreso de un job
   * @param {string} jobId - ID del job
   * @param {number} current - Progreso actual
   * @param {number} total - Total
   * @param {string} message - Mensaje de progreso
   */
  updateJobProgress(jobId, current, total, message = '') {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.progress = {
      current,
      total,
      percentage: total > 0 ? Math.round((current / total) * 100) : 0,
      message,
    };

    this.emit('job:progress', job);
  }

  /**
   * Marca un job como completado con su resultado
   * @param {string} jobId - ID del job
   * @param {object} result - Resultado del scraping
   */
  completeJob(jobId, result) {
    this.updateJobStatus(jobId, 'completed', {
      result,
      progress: {
        current: result.reviews?.length || 0,
        total: result.reviews?.length || 0,
        percentage: 100,
        message: 'Completado',
      },
    });
  }

  /**
   * Marca un job como fallido con error
   * @param {string} jobId - ID del job
   * @param {string|Error} error - Error ocurrido
   */
  failJob(jobId, error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.updateJobStatus(jobId, 'failed', {
      error: errorMessage,
      progress: {
        ...this.jobs.get(jobId)?.progress,
        message: `Error: ${errorMessage}`,
      },
    });
  }

  /**
   * Cancela un job (solo si está pending o processing)
   * @param {string} jobId - ID del job
   * @returns {boolean} - true si se canceló, false si no se pudo
   */
  cancelJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    if (job.status === 'pending' || job.status === 'processing') {
      this.updateJobStatus(jobId, 'failed', {
        error: 'Job cancelado por el usuario',
        progress: {
          ...job.progress,
          message: 'Cancelado',
        },
      });
      this.emit('job:cancelled', job);
      return true;
    }

    return false;
  }

  /**
   * Elimina un job de la memoria
   * @param {string} jobId - ID del job
   * @returns {boolean} - true si se eliminó, false si no existía
   */
  deleteJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    this.jobs.delete(jobId);
    this.emit('job:deleted', jobId);
    console.log(`🗑️  Job eliminado: ${jobId}`);
    return true;
  }

  /**
   * Limpia jobs completados o fallidos antiguos
   * @param {number} olderThanMs - Eliminar jobs más antiguos que esto (en ms)
   * @returns {number} - Cantidad de jobs eliminados
   */
  cleanupOldJobs(olderThanMs = this.config.cleanupCompletedAfter) {
    const now = Date.now();
    let cleaned = 0;

    for (const [jobId, job] of this.jobs.entries()) {
      if (job.status === 'completed' || job.status === 'failed') {
        const completedTime = new Date(job.completedAt).getTime();
        if (now - completedTime > olderThanMs) {
          this.deleteJob(jobId);
          cleaned++;
        }
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Limpiados ${cleaned} jobs antiguos`);
    }

    return cleaned;
  }

  /**
   * Limpia todos los jobs completados (sin importar antigüedad)
   * @returns {number} - Cantidad de jobs eliminados
   */
  cleanupCompletedJobs() {
    let cleaned = 0;

    for (const [jobId, job] of this.jobs.entries()) {
      if (job.status === 'completed' || job.status === 'failed') {
        this.deleteJob(jobId);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Inicia limpieza automática periódica de jobs antiguos
   */
  startAutoCleanup() {
    // Limpiar cada 10 minutos
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldJobs();
    }, 10 * 60 * 1000);
  }

  /**
   * Detiene limpieza automática
   */
  stopAutoCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  /**
   * Obtiene estadísticas generales
   * @returns {object} - Estadísticas
   */
  getStats() {
    const allJobs = Array.from(this.jobs.values());
    return {
      total: allJobs.length,
      pending: allJobs.filter(j => j.status === 'pending').length,
      processing: allJobs.filter(j => j.status === 'processing').length,
      completed: allJobs.filter(j => j.status === 'completed').length,
      failed: allJobs.filter(j => j.status === 'failed').length,
      config: this.config,
    };
  }

  /**
   * Actualiza la configuración
   * @param {object} newConfig - Nueva configuración
   */
  updateConfig(newConfig) {
    if (newConfig.maxConcurrentJobs !== undefined) {
      this.config.maxConcurrentJobs = Math.max(1, Math.min(10, newConfig.maxConcurrentJobs));
    }

    if (newConfig.cleanupCompletedAfter !== undefined) {
      this.config.cleanupCompletedAfter = Math.max(60000, newConfig.cleanupCompletedAfter);
    }

    this.emit('config:updated', this.config);
    console.log(`⚙️  Configuración actualizada:`, this.config);
  }

  /**
   * Obtiene la configuración actual
   * @returns {object} - Configuración
   */
  getConfig() {
    return { ...this.config };
  }
}

// Singleton instance
const jobManager = new JobManager();

module.exports = jobManager;
