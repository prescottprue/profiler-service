import * as admin from 'firebase-admin';
import {
  mkdirSync,
  existsSync,
  writeFileSync,
  unlinkSync,
  promises as fs,
} from 'fs';
import { dirname } from 'path';
import { tmpdir } from 'os';
import { format } from 'date-fns';
import { Logging } from '@google-cloud/logging';
import { runCommand, to } from './utils';
import { ProfilerResult, ProfilerResultWithExtraValues } from './types';

const MINS_TO_S_CONVERSION = 60;

// Creates a client
const logging = new Logging();

/**
 * @param outputPath - File path for results
 * @param projectName - Name of Google Cloud Project
 * @param profileDuration - Duration for profiling
 */
async function profileDatabase(
  outputPath: string,
  projectName?: string,
  profileDuration?: any,
): Promise<any> {
  console.log(`Starting profiling with recording to path: ${outputPath}`);
  const duration = profileDuration * MINS_TO_S_CONVERSION || '30'; // in seconds
  const outFolder = dirname(outputPath);
  try {
    // Create folder for file path
    if (!existsSync(outFolder)) {
      mkdirSync(outFolder);
    }

    // Create file if it doesn't exist (fix issue with firebase-tools not finding file)
    if (!existsSync(outputPath)) {
      writeFileSync(outputPath, '');
    }
  } catch (err) {
    console.log(`Error making folder for path:"${outputPath}":`, err);
    throw err;
  }

  const commandArgs: string[] = [
    'database:profile',
    '--raw',
    '-o',
    outputPath,
    '-d',
    duration?.toString() || '30',
  ];

  if (projectName) {
    commandArgs.push('--project', projectName);
  }
  console.log('Running command with args:', commandArgs);

  // FIREBASE_TOKEN picked up by firebase-tools
  if (!process.env.FIREBASE_TOKEN) {
    console.warn(
      'NOTE: Running without FIREBASE_TOKEN can cause authentication issues',
    );
  }

  try {
    // Call database profiler
    await runCommand({
      command: 'npx firebase',
      args: commandArgs,
    });
  } catch (err) {
    console.error('Error running firebase command with args:', commandArgs);
    throw err
  }
}

/**
 * @param resultsPath - Path of results file
 * @returns Array of parsed lines
 */
async function parseResults(resultsPath: string): Promise<ProfilerResult[]> {
  console.log('Starting profiler results parse...');
  const [readFileErr, resultsFileContents] = await to(fs.readFile(resultsPath));

  // Handle errors reading file
  if (readFileErr) {
    console.error(`Error reading file from path ${resultsPath}`);
    throw readFileErr;
  }

  // Handle empty file
  if (!resultsFileContents) {
    throw new Error(`${resultsPath} does not contain any content to parse`);
  }

  // Split results string by newlines (how JSON is output by firebase-tools when using --raw)
  const resultsStringsByLine = resultsFileContents.toString().split('\n');
  console.log(
    `Parsing ${resultsStringsByLine.length} lines from results file...`,
    resultsStringsByLine,
  );

  // Remove falsey values (i.e. blank lines)
  const nonEmptyResults = resultsStringsByLine.filter(Boolean);

  // Split results into different lines and parse into JSON
  return nonEmptyResults.map((resultLineStr, lineIdx) => {
    try {
      return JSON.parse(resultLineStr);
    } catch (err) {
      console.error(
        `Error parsing line ${lineIdx + 1}/${resultsStringsByLine.length}`,
        resultLineStr,
      );
      return resultLineStr;
    }
  });
}

/**
 * Get service account from local file or environment variable
 * @returns Promise which resolves with service account object
 */
async function getServiceAccount(): Promise<any> {
  // Load from environment variable
  if (process.env.SERVICE_ACCOUNT) {
    console.log('Loading service account from environment variable');
    try {
      return JSON.parse(process.env.SERVICE_ACCOUNT);
    } catch (err) {
      console.error('Error parsing SERVICE_ACCOUNT env variable:', err);
      throw err;
    }
  }

  // Load from local file
  const serviceAccountPath = './serviceAccount.json';
  if (existsSync(serviceAccountPath)) {
    console.log('Loading service account from local file');
    const saStr = await fs.readFile(serviceAccountPath);
    try {
      return JSON.parse(saStr.toString());
    } catch (err) {
      console.log('Error parsing SERVICE_ACCOUNT file');
      throw err;
    }
  }
  const serviceSccountErr =
    'Service Account not found, falling back to default credentials';
  console.warn(serviceSccountErr);
  return {};
}

interface UploadSettings {
  project?: string;
  bucketName?: string;
}

/**
 * @param cloudStorageFilePath - Path to file in cloud storage
 * @param resultsToUpload - JSON results to upload
 * @param settings - Settings for upload
 */
async function uploadResults(
  cloudStorageFilePath: string,
  resultsToUpload: ProfilerResultWithExtraValues[],
  settings?: UploadSettings,
): Promise<any> {
  console.log(
    `Writing profiler results cloud storage path: ${cloudStorageFilePath}...`,
  );
  // Load service account from environment variable falling back to local file
  const sa = await getServiceAccount();
  const credential =
    admin.credential.cert(sa) || admin.credential.applicationDefault();
  const projectId =
    settings?.project ||
    sa?.project_id ||
    process.env.GCLOUD_PROJECT ||
    process.env.GCP_PROJECT;
  const bucketName =
    (settings && settings.bucketName) ||
    process.env.GCLOUD_BUCKET ||
    `${projectId}.appspot.com`;

  admin.initializeApp({
    credential,
    databaseURL: `https://${projectId}.firebaseio.com`,
  });

  try {
    const stringifiedResults = JSON.stringify(resultsToUpload);
    await admin
      .storage()
      .bucket(bucketName)
      .file(cloudStorageFilePath)
      .save(stringifiedResults);
    console.log(
      `Successfully uploaded to ${bucketName}/${cloudStorageFilePath}`,
    );
  } catch (err) {
    console.error(`Error uploading ${cloudStorageFilePath}: `, err);
    throw err;
  }
}

interface ProfileAndUploadOptions {
  /* Time to run profiler */
  duration: number;
  project?: string;
}

/**
 * @param options - Options for profiling and uploading
 */
export async function profileAndUpload(
  options?: ProfileAndUploadOptions,
): Promise<any> {
  console.log('Called profile and upload', options);
  const now = new Date();
  const currentDateStamp = format(now, 'MM-dd-yyyy');
  const currentTimeStamp = format(now, 'H:mm:ss.SSS');
  const localFilePath = `${tmpdir()}/${currentTimeStamp}.json`;

  // Run database profiler
  await profileDatabase(localFilePath, options?.project, options?.duration);

  // Parse results from file into JSON
  const parsedResults = await parseResults(localFilePath);
  const resultsWithExtraValues: ProfilerResultWithExtraValues[] = parsedResults.map(
    (parsedLine) => ({
      pathStr: parsedLine?.path?.join('/') || '',
      parentPath: parsedLine?.path && parsedLine.path[0] || '',
      ...parsedLine,
    }),
  );

  // Remove local file
  unlinkSync(localFilePath);

  // Write results to Stackdriver
  const log = logging.log('profiler-service');
  // Create array of log entries
  const stackdriverEntries: any[] = [];
  resultsWithExtraValues.forEach((parsedLine) => {
    const resource = {
      // This example targets the "global" resource for simplicity
      type: 'global',
    };
    stackdriverEntries.push(log.entry({ resource }, parsedLine));
  });
  // Write log entries all at once
  log.write(stackdriverEntries);

  // Write profiler results to Cloud Storage
  const cloudStorageFilePath = `profiler-service-results/${currentDateStamp}/${currentTimeStamp}.json`;
  await uploadResults(cloudStorageFilePath, resultsWithExtraValues);
}
