const http = require('http');

const host = process.env.HEALTHCHECK_HOST || 'localhost';
const port = Number(process.env.PORT || 3000);

const options = {
  host,
  port,
  path: '/api/health',
  timeout: 2000
};

const request = http.request(options, (response) => {
  if (response.statusCode && response.statusCode >= 200 && response.statusCode < 400) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

request.on('error', () => process.exit(1));
request.on('timeout', () => {
  request.destroy();
  process.exit(1);
});

request.end();
