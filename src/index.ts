import { profileAndUpload } from './profilerService';
import http from 'http'

const TIMEOUT = 5; // In minutes
const MINS_TO_MS_CONVERSION = 60000;
const { PROFILING_PROJECT } = process.env;

/**
 * Run profiler service in a loop with specified duration
 */
async function runProfilerService(): Promise<any> {
  const profilerSettings = { duration: TIMEOUT, project: PROFILING_PROJECT }
  console.log('Starting profiling service', profilerSettings);
  await profileAndUpload(profilerSettings);

  setTimeout(async () => {
    try {
      await runProfilerService()
    } catch(err) {
      console.error(
        'Error while running profiler service, exiting with error code',
        err,
      );
      process.exit(1);
    }
  }, TIMEOUT * MINS_TO_MS_CONVERSION);
}

runProfilerService().catch((err) => {
  console.error(
    'Error while running profiler service, exiting with error code',
    err,
  );
  process.exit(1);
});

// Respond success to all http requests for health check
const server = http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/html'});
  res.write('Healthy!');
  res.end();
});

const port = process.env.PORT || 8080
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});