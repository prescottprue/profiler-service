import { profileAndUpload } from './profilerService';
import { MINS_TO_MS_CONVERSION } from './constants';

const TIMEOUT = 5; // In minutes
const PROFILE_PROJECT = process.env.PROFILING_PROJECT;

/**
 *
 */
async function runProfilerService(): Promise<any> {
  await profileAndUpload({ duration: TIMEOUT, project: PROFILE_PROJECT });

  setTimeout(() => {
    runProfilerService().catch((err) => {
      console.error(
        'Error while running profiler service, exiting with error code',
        err,
      );
      process.exit(1);
    });
  }, TIMEOUT * MINS_TO_MS_CONVERSION);
}

console.log('Starting profiling service...');
runProfilerService().catch((err) => {
  console.error(
    'Error while running profiler service, exiting with error code',
    err,
  );
  process.exit(1);
});
