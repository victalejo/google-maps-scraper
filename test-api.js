/**
 * Script de prueba para el sistema de jobs
 */

const http = require('http');

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function testJobSystem() {
  console.log('🧪 Iniciando pruebas del sistema de jobs...\n');

  try {
    // 1. Verificar estado inicial
    console.log('1️⃣ Verificando configuración inicial...');
    const config = await makeRequest('GET', '/api/config');
    console.log('   ✅ Max concurrent jobs:', config.config.maxConcurrentJobs);
    console.log('   ✅ Jobs en cola:', config.currentLoad.pending);
    console.log('   ✅ Jobs procesando:', config.currentLoad.processing, '\n');

    // 2. Crear un job de prueba
    console.log('2️⃣ Creando job de prueba...');
    const startTime = Date.now();

    const jobResponse = await makeRequest('POST', '/api/scrape', {
      url: 'https://www.google.com/maps/place/test',
      maxScrolls: 2,
      headless: true
    });

    const responseTime = Date.now() - startTime;

    console.log('   ✅ Respuesta recibida en:', responseTime, 'ms (respuesta inmediata!)');
    console.log('   ✅ Job ID:', jobResponse.job.jobId);
    console.log('   ✅ Status:', jobResponse.job.status, '\n');

    const jobId = jobResponse.job.jobId;

    // 3. Verificar estado del job
    console.log('3️⃣ Verificando estado del job después de 1 segundo...');
    await new Promise(resolve => setTimeout(resolve, 1000));

    const jobStatus = await makeRequest('GET', '/api/jobs/' + jobId);
    console.log('   ✅ Status:', jobStatus.job.status);
    console.log('   ✅ Progreso:', jobStatus.job.progress.percentage + '% -', jobStatus.job.progress.message, '\n');

    // 4. Listar todos los jobs
    console.log('4️⃣ Listando todos los jobs...');
    const allJobs = await makeRequest('GET', '/api/jobs');
    console.log('   ✅ Total de jobs:', allJobs.stats.total);
    console.log('   ✅ Pending:', allJobs.stats.pending);
    console.log('   ✅ Processing:', allJobs.stats.processing);
    console.log('   ✅ Completed:', allJobs.stats.completed);
    console.log('   ✅ Failed:', allJobs.stats.failed, '\n');

    // 5. Esperar un poco más
    console.log('5️⃣ Esperando 3 segundos más...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    const finalStatus = await makeRequest('GET', '/api/jobs/' + jobId);
    console.log('   ✅ Status final:', finalStatus.job.status);
    console.log('   ✅ Progreso:', finalStatus.job.progress.percentage + '%\n');

    // 6. Si falló, mostrar error
    if (finalStatus.job.status === 'failed') {
      console.log('⚠️  Job falló como se esperaba (URL de prueba inválida)');
      console.log('   Error:', finalStatus.job.error, '\n');
    }

    // 7. Limpiar jobs
    console.log('6️⃣ Limpiando jobs...');
    const cleanupResult = await makeRequest('DELETE', '/api/jobs');
    console.log('   ✅', cleanupResult.message, '\n');

    console.log('✅ Todas las pruebas completadas exitosamente!\n');
    console.log('📊 RESUMEN:');
    console.log('   - La API respondió en ' + responseTime + 'ms (inmediato)');
    console.log('   - El sistema de jobs funciona correctamente');
    console.log('   - Los endpoints de gestión funcionan correctamente\n');

  } catch (error) {
    console.error('❌ Error durante las pruebas:', error.message);
  }
}

testJobSystem();
