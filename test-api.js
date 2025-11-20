const http = require('http');

const url = 'https://www.google.com/maps/place/BTK+Tecnol%C3%B3gico/@19.267822,-99.5767884,17z/data=!4m8!3m7!1s0x85cd8bdb988e3a8f:0x4f62740ae63ef3ac!8m2!3d19.267822!4d-99.5767884!9m1!1b1!16s%2Fg%2F11g_yfcy17?entry=ttu&g_ep=EgoyMDI1MTExNy4wIKXMDSoASAFQAw%3D%3D';

const postData = JSON.stringify({
  url: url,
  maxScrolls: 10,
  headless: true,
  scrollDelay: 2000,
  waitAfterSort: 3000,
  timeout: 60000
});

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/scrape',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('Testing API in HEADLESS mode...');
console.log('URL:', url);
console.log('headless: true\n');

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const response = JSON.parse(data);
    console.log('Response:', JSON.stringify(response, null, 2));

    if (response.success && response.job) {
      const jobId = response.job.jobId;
      console.log('\nJob created:', jobId);
      console.log('Waiting 30s for completion...');

      setTimeout(() => {
        checkJobStatus(jobId);
      }, 30000);
    }
  });
});

req.on('error', (error) => { console.error('Error:', error.message); });
req.write(postData);
req.end();

function checkJobStatus(jobId) {
  console.log('\nChecking job status...');

  http.get({
    hostname: 'localhost',
    port: 3001,
    path: `/api/jobs/${jobId}`
  }, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      const response = JSON.parse(data);

      if (response.success && response.job) {
        const job = response.job;
        console.log('Status:', job.status);
        console.log('Progress:', job.progress?.percentage + '%');

        if (job.status === 'completed' && job.result) {
          const reviews = job.result.reviews || [];
          console.log('\nTotal reviews:', reviews.length);

          if (reviews.length > 0) {
            console.log('\nFirst 5 reviews:');
            for (let i = 0; i < Math.min(5, reviews.length); i++) {
              const r = reviews[i];
              console.log(`${i+1}. ${r.autor} - ${r.fecha_relativa} - ${r.calificacion} stars`);
            }

            const luisReview = reviews.find(r => r.autor && r.autor.toLowerCase().includes('luis') && r.autor.toLowerCase().includes('garc'));
            if (luisReview) {
              console.log('\n✅ Luis García review FOUND!');
            } else {
              console.log('\n⚠️  Luis García review NOT found');
            }
          }
        } else if (job.status === 'processing') {
          console.log('Still processing... waiting 15s more...');
          setTimeout(() => checkJobStatus(jobId), 15000);
        } else if (job.status === 'failed') {
          console.log('Job FAILED:', job.error);
        }
      }
    });
  }).on('error', (err) => { console.error('Error:', err.message); });
}
