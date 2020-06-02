// import {
//   readFile,
//   mkdirSync,
//   existsSync,
//   writeFileSync,
//   unlinkSync,
// readFileSync,
// } from 'fs';
import { utcToZonedTime, format } from 'date-fns-tz'; // eslint-disable-line import/no-extraneous-dependencies

/**
 * @param dataItem
 */
function formatData(dataItem: any): any {
  const { path: pathArray, bytes, name: type, client, timestamp } = dataItem;
  const date = new Date(timestamp);
  const pstTimeZone = 'America/Los_Angeles';
  const zonedDate = utcToZonedTime(date, pstTimeZone);
  const estZonedDate = utcToZonedTime(date, 'America/New_York');
  const pattern = 'd.m.yyyy h:mm:ss.SSS';
  const output = format(zonedDate, pattern, { timeZone: pstTimeZone });
  const estOutput = format(estZonedDate, pattern, {
    timeZone: 'America/New_York',
  });
  if (!pathArray) {
    console.log('path array does not exist', dataItem);
  }
  return {
    path: pathArray?.join('/'),
    bytes,
    type,
    address: client?.remoteAddress?.address,
    browser: client?.userAgent?.browser,
    timeInPST: output,
    timeInEST: estOutput,
    timestamp,
  };
}

/**
 *
 */
async function parseSingleFileResults(): Promise<any> {
  console.log('args', process.argv[2]);
  const resultsData = require(`${process.cwd()}/${process.argv[2]}`); // eslint-disable-line
  const biggestByBytes = resultsData
    .filter((item: any) => item?.bytes)
    .sort((first: any, second: any) => {
      return second.bytes - first.bytes;
    })
    .map(formatData);

  const resultsByPath = resultsData.reduce((acc: any, item: any) => {
    if (!item.path) {
      return acc;
    }
    const joinedPath = item.path.join('/');
    return {
      ...acc,
      [joinedPath]: acc[joinedPath] ? acc[joinedPath].concat([item]) : [item],
    };
  }, {});
  console.log('biggest by bytes:', biggestByBytes.splice(0, 4));
  console.log('-------------------------------------');

  const mostByPath = Object.keys(resultsByPath)
    .map(pathForCurrent => ({
      count: resultsByPath[pathForCurrent].length,
      path: pathForCurrent,
    }))
    .sort((first: any, second: any) => {
      return second.count - first.count;
    });
  console.log('Most by path: ', mostByPath[0]);
}

parseSingleFileResults();
