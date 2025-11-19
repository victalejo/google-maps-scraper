/**
 * Find where the review text is located in the structure
 */

const fs = require('fs').promises;
const path = require('path');

function findStringsInObject(obj, path = '', depth = 0, maxDepth = 10) {
  if (depth > maxDepth) return [];

  const results = [];

  if (typeof obj === 'string') {
    // Only show strings longer than 10 chars that look like review text (not URLs, IDs, etc.)
    if (obj.length > 10 &&
        !obj.startsWith('http') &&
        !obj.startsWith('0x') &&
        !obj.startsWith('GUIDED_') &&
        !obj.startsWith('0ahU') &&
        !obj.match(/^[A-Za-z0-9_\-]{20,}$/)) {
      results.push({ path, value: obj.substring(0, 100) });
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      results.push(...findStringsInObject(item, `${path}[${index}]`, depth + 1, maxDepth));
    });
  }

  return results;
}

async function findText() {
  // Read raw responses
  const rawFile = path.join(__dirname, 'output', 'raw_responses_La BTK Bellas Artes_2025-11-19.json');
  const content = await fs.readFile(rawFile, 'utf8');
  const data = JSON.parse(content);

  // Find first listugcposts response
  const listugcposts = data.responses.find(r => r.isListUgcPosts);

  if (!listugcposts || !listugcposts.bodyFull) {
    console.log('No listugcposts response found');
    return;
  }

  // Parse it
  let cleanBody = listugcposts.bodyFull.trim();
  if (cleanBody.startsWith(")]}\'")) {
    cleanBody = cleanBody.substring(4);
  }

  const parsedData = JSON.parse(cleanBody);
  const reviewsContainer = parsedData[2];

  if (!Array.isArray(reviewsContainer) || reviewsContainer.length === 0) {
    console.log('No reviews container');
    return;
  }

  // Get first 3 reviews and search for text
  for (let i = 0; i < Math.min(3, reviewsContainer.length); i++) {
    const reviewGroup = reviewsContainer[i];
    if (!Array.isArray(reviewGroup) || reviewGroup.length === 0) continue;

    const reviewArray = reviewGroup[0];

    console.log(`\n${'='.repeat(80)}`);
    console.log(`REVIEW ${i + 1} - Searching for text content`);
    console.log(`${'='.repeat(80)}\n`);

    const strings = findStringsInObject(reviewArray);

    strings.forEach(item => {
      console.log(`Path: reviewArray${item.path}`);
      console.log(`Text: "${item.value}"`);
      console.log('');
    });
  }
}

findText().catch(err => console.error(err));
