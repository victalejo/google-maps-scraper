/**
 * Debug script para analizar estructura de listugcposts
 */

const fs = require('fs').promises;
const path = require('path');

async function debugParser() {
  // Leer archivo de respuestas crudas
  const rawFile = path.join(__dirname, 'output', 'raw_responses_La BTK Bellas Artes_2025-11-19.json');
  const content = await fs.readFile(rawFile, 'utf8');
  const data = JSON.parse(content);

  console.log('\n📊 ANÁLISIS DE RESPUESTAS CAPTURADAS\n');
  console.log(`Total de respuestas: ${data.responses.length}\n`);

  // Encontrar primera respuesta listugcposts con contenido
  for (let i = 0; i < data.responses.length; i++) {
    const response = data.responses[i];

    if (response.url.includes('/maps/rpc/listugcposts')) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`RESPUESTA #${i}: listugcposts`);
      console.log(`${'='.repeat(60)}\n`);
      console.log(`URL: ${response.url.substring(0, 120)}...`);
      console.log(`Tamaño: ${response.bodySize} bytes`);
      console.log(`Preview: ${response.bodyPreview?.substring(0, 100)}...\n`);

      // Reconstruir body completo desde bodyFull (preferido) o bodyPreview
      let bodyToAnalyze = response.bodyFull || response.bodyPreview;

      // Parsear el JSON
      try {
        // Remover prefijo de seguridad
        let cleanBody = bodyToAnalyze.trim();
        if (cleanBody.startsWith(')]}\'')) {
          cleanBody = cleanBody.substring(4);
        }

        const parsedData = JSON.parse(cleanBody);

        console.log('📋 ESTRUCTURA DEL RESPONSE:');
        console.log(`  - Tipo: ${Array.isArray(parsedData) ? 'Array' : 'Object'}`);
        console.log(`  - Longitud: ${Array.isArray(parsedData) ? parsedData.length : 'N/A'}`);

        if (Array.isArray(parsedData)) {
          console.log(`\n  Elementos del array principal:`);
          parsedData.forEach((item, idx) => {
            if (idx < 5) { // Mostrar solo primeros 5
              const type = Array.isArray(item) ? `Array[${item.length}]` : typeof item;
              const preview = JSON.stringify(item).substring(0, 80);
              console.log(`    [${idx}]: ${type} - ${preview}...`);
            }
          });

          // Examinar data[2] que debería contener las reseñas
          console.log(`\n📝 EXAMINANDO parsedData[2] (contenedor de reseñas):`);
          const reviewsContainer = parsedData[2];

          if (Array.isArray(reviewsContainer)) {
            console.log(`  - Es un array con ${reviewsContainer.length} elementos\n`);

            // Examinar primer elemento del contenedor
            if (reviewsContainer[0]) {
              console.log(`  Primer elemento de reviewsContainer:`);
              const firstGroup = reviewsContainer[0];
              const groupType = Array.isArray(firstGroup) ? `Array[${firstGroup.length}]` : typeof firstGroup;
              console.log(`    Tipo: ${groupType}`);

              if (Array.isArray(firstGroup) && firstGroup.length > 0) {
                console.log(`\n  📌 PRIMERA RESEÑA (reviewsContainer[0][0]):\n`);
                const firstReview = firstGroup[0];

                if (Array.isArray(firstReview)) {
                  console.log(`    Array con ${firstReview.length} elementos:\n`);

                  // Mostrar cada elemento de la reseña
                  firstReview.forEach((item, idx) => {
                    const itemType = Array.isArray(item) ? `Array[${item.length}]` : typeof item;
                    let itemPreview = '';

                    if (Array.isArray(item)) {
                      // Show more detail for arrays
                      if (item.length > 0 && item.length <= 20) {
                        itemPreview = JSON.stringify(item, null, 2).substring(0, 300);
                      } else {
                        itemPreview = JSON.stringify(item).substring(0, 100);
                      }
                    } else if (typeof item === 'string') {
                      itemPreview = `"${item.substring(0, 60)}"`;
                    } else {
                      itemPreview = JSON.stringify(item);
                    }

                    console.log(`\n      [${idx}]: ${itemType.padEnd(12)}`);
                    console.log(`      ${itemPreview}${itemPreview.length >= 100 ? '...' : ''}`);
                  });
                }
              }
            }
          } else {
            console.log(`  ⚠️  parsedData[2] no es un array: ${typeof reviewsContainer}`);
          }
        }

        // Solo analizar primera respuesta
        break;

      } catch (error) {
        console.error(`❌ Error parseando: ${error.message}`);
        console.log(`Body preview: ${bodyToAnalyze?.substring(0, 200)}`);
      }
    }
  }
}

debugParser().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
