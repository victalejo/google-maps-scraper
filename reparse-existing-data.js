/**
 * Re-parse existing raw_responses with the fixed parser and export
 */

const GoogleMapsParser = require('./src/parser');
const ReviewsExporter = require('./src/exporter');
const fs = require('fs').promises;
const path = require('path');

async function reparseData() {
  console.log('\n🔄 RE-PARSING EXISTING DATA WITH FIXED PARSER\n');

  // Read raw responses
  const rawFile = path.join(__dirname, 'output', 'raw_responses_La BTK Bellas Artes_2025-11-19.json');
  const content = await fs.readFile(rawFile, 'utf8');
  const data = JSON.parse(content);

  console.log(`Total responses: ${data.responses.length}`);

  // Create parser
  const parser = new GoogleMapsParser();

  // Parse all responses
  const capturedResponses = data.responses
    .filter(r => r.isListUgcPosts && r.bodyFull)
    .map(r => ({
      url: r.url,
      body: r.bodyFull,
      timestamp: r.timestamp,
      status: r.status,
      mimeType: r.mimeType,
      headers: r.headers,
      isListUgcPosts: r.isListUgcPosts
    }));

  console.log(`Listugcposts responses: ${capturedResponses.length}\n`);

  parser.parseResponses(capturedResponses);
  parser.removeDuplicates();
  parser.sortByDate();

  const reviews = parser.getParsedReviews();

  console.log(`\n✅ Total reviews extracted: ${reviews.length}\n`);

  // Export
  const exporter = new ReviewsExporter({ outputDir: './output', prettyPrint: true });

  const metadata = {
    place_name: 'La BTK Bellas Artes',
    place_id: '0x85d1f92b275f933b:0xbf641e762a5ca480',
    url: 'https://www.google.com/maps/place/La+BTK+Bellas+Artes/@19.4338211,-99.1455109,17z/data=!3m2!4b1!5s0x85d1f92b275f933b:0xbf641e762a5ca480!4m6!3m5!1s0x85d1f96b83b19901:0xc83c8fcab37f08ab!8m2!3d19.4338211!4d-99.1429306!16s%2Fg%2F11gxvsgx0g?entry=ttu'
  };

  // Create output filename with "FIXED" suffix
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const customFilename = `reviews_La BTK Bellas Artes_${timestamp}_FIXED.json`;

  console.log('\n📤 Exporting results...\n');

  // Manually write the JSON file with custom name
  const filepath = path.join(exporter.outputDir, customFilename);

  const output = {
    metadata: {
      establecimiento: metadata.place_name,
      place_id: metadata.place_id,
      url: metadata.url,
      fecha_scraping: new Date().toISOString(),
      total_reseñas: reviews.length,
      scraper_version: '1.0.0 - FIXED PARSER'
    },
    estadisticas: exporter.calculateStatistics(reviews),
    reseñas: reviews
  };

  await fs.writeFile(filepath, JSON.stringify(output, null, 2), 'utf8');

  console.log(`✅ Exported to: ${customFilename}\n`);

  // Print summary
  exporter.printSummary(reviews, metadata);

  // Show sample reviews
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SAMPLE REVIEWS (first 5)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  for (let i = 0; i < Math.min(5, reviews.length); i++) {
    const review = reviews[i];
    console.log(`${i + 1}. ${review.autor || 'Anónimo'}`);
    console.log(`   ${'⭐'.repeat(review.calificacion || 0)} (${review.calificacion})`);
    console.log(`   ${review.fecha_relativa || 'N/A'} - ${review.fecha_iso?.substring(0, 10) || 'N/A'}`);
    console.log(`   Texto: ${review.texto ? review.texto.substring(0, 100) + '...' : 'Sin texto'}\n`);
  }
}

reparseData().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
