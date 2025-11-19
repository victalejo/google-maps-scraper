/**
 * Test the updated parser against existing raw_responses
 */

const GoogleMapsParser = require('./src/parser');
const fs = require('fs').promises;
const path = require('path');

async function testParser() {
  // Read the raw responses file
  const rawFile = path.join(__dirname, 'output', 'raw_responses_La BTK Bellas Artes_2025-11-19.json');
  const content = await fs.readFile(rawFile, 'utf8');
  const data = JSON.parse(content);

  console.log('\n🧪 TESTING UPDATED PARSER\n');
  console.log(`Total responses: ${data.responses.length}\n`);

  // Find listugcposts responses
  const listugcpostsResponses = data.responses.filter(r => r.isListUgcPosts);

  console.log(`Found ${listugcpostsResponses.length} listugcposts responses\n`);

  // Parse them
  const parser = new GoogleMapsParser();

  for (let i = 0; i < Math.min(3, listugcpostsResponses.length); i++) {
    const response = listugcpostsResponses[i];
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Parsing response ${i + 1}:`);
    console.log(`Size: ${response.bodySize} bytes`);
    console.log(`${'='.repeat(60)}\n`);

    const reviews = parser.parseListUgcPosts(response.bodyFull, response.url);
    console.log(`✅ Extracted ${reviews.length} reviews\n`);

    // Show first 3 reviews
    for (let j = 0; j < Math.min(3, reviews.length); j++) {
      const review = reviews[j];
      console.log(`Review ${j + 1}:`);
      console.log(`  Autor: ${review.autor || 'N/A'}`);
      console.log(`  Calificación: ${'⭐'.repeat(review.calificacion || 0)} (${review.calificacion || 'N/A'})`);
      console.log(`  Fecha relativa: ${review.fecha_relativa || 'N/A'}`);
      console.log(`  Fecha ISO: ${review.fecha_iso || 'N/A'}`);
      console.log(`  Texto: ${review.texto ? review.texto.substring(0, 100) + '...' : 'N/A'}`);
      console.log('');
    }
  }

  // Get all parsed reviews
  const allReviews = parser.getParsedReviews();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`TOTAL REVIEWS PARSED: ${allReviews.length}`);
  console.log(`${'='.repeat(60)}\n`);

  // Show stats
  const withAuthor = allReviews.filter(r => r.autor).length;
  const withText = allReviews.filter(r => r.texto).length;
  const withDate = allReviews.filter(r => r.fecha_relativa).length;
  const withRating = allReviews.filter(r => r.calificacion).length;

  console.log(`With author: ${withAuthor}/${allReviews.length}`);
  console.log(`With text: ${withText}/${allReviews.length}`);
  console.log(`With relative date: ${withDate}/${allReviews.length}`);
  console.log(`With rating: ${withRating}/${allReviews.length}`);
}

testParser().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
