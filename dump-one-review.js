/**
 * Dump the structure of ONE review to understand the exact location of author
 */

const fs = require('fs').promises;
const path = require('path');

async function dumpReview() {
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
  if (cleanBody.startsWith(')]}\'')) {
    cleanBody = cleanBody.substring(4);
  }

  const parsedData = JSON.parse(cleanBody);
  const reviewsContainer = parsedData[2];

  if (!Array.isArray(reviewsContainer) || reviewsContainer.length === 0) {
    console.log('No reviews container');
    return;
  }

  // Get first review
  const firstReviewGroup = reviewsContainer[0];
  if (!Array.isArray(firstReviewGroup) || firstReviewGroup.length === 0) {
    console.log('No review group');
    return;
  }

  const firstReview = firstReviewGroup[0];

  console.log('\n📝 DUMPING FIRST REVIEW STRUCTURE\n');
  console.log(`Review array length: ${firstReview.length}\n`);

  // Dump each element
  for (let i = 0; i < firstReview.length; i++) {
    const element = firstReview[i];
    console.log(`\n${'='.repeat(60)}`);
    console.log(`reviewArray[${i}]:`);
    console.log(`${'='.repeat(60)}\n`);

    if (Array.isArray(element)) {
      console.log(`Type: Array[${element.length}]`);
      console.log(`Content:\n${JSON.stringify(element, null, 2).substring(0, 1000)}`);
    } else if (typeof element === 'string') {
      console.log(`Type: string`);
      console.log(`Value: "${element.substring(0, 200)}"`);
    } else {
      console.log(`Type: ${typeof element}`);
      console.log(`Value: ${JSON.stringify(element)}`);
    }
  }

  console.log('\n\n🔍 SEARCHING FOR AUTHOR IN reviewArray[1]:\n');
  if (Array.isArray(firstReview[1])) {
    for (let j = 0; j < firstReview[1].length; j++) {
      const item = firstReview[1][j];
      if (Array.isArray(item)) {
        // Check if this looks like author data
        for (let k = 0; k < Math.min(item.length, 10); k++) {
          const subItem = item[k];
          if (Array.isArray(subItem) && subItem.length >= 2 &&
              typeof subItem[0] === 'string' && typeof subItem[1] === 'string') {
            if (subItem[1].includes('googleusercontent')) {
              console.log(`FOUND at reviewArray[1][${j}][${k}]:`);
              console.log(`  Author: "${subItem[0]}"`);
              console.log(`  Photo: "${subItem[1].substring(0, 80)}..."\n`);
            }
          }
        }
      }
    }
  }
}

dumpReview().catch(err => console.error(err));
