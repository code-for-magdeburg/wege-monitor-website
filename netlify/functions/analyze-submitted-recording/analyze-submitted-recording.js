const AWS = require('aws-sdk');
const JSZip = require('jszip');
const Papa = require('papaparse');
const h3 = require('h3-js');

const { WM_AWS_ACCESS_KEY_ID, WM_AWS_SECRET_ACCESS_KEY, WM_S3_BUCKET_NAME } = process.env;

const MIN_VELOCITY = 15 / 3.6;
const BEST_VELOCITY = 20 / 3.6;
const MAX_VELOCITY = 25 / 3.6;
const TOO_SLOW = 'TOO_SLOW';
const TOO_FAST = 'TOO_FAST';
const GOOD_SPEED = 'GOOD_SPEED';
const PERFECT_SPEED = 'PERFECT_SPEED';


const s3 = new AWS.S3({
  signatureVersion: 'v4',
  region: 'eu-central-1',
  credentials: new AWS.Credentials(WM_AWS_ACCESS_KEY_ID, WM_AWS_SECRET_ACCESS_KEY)
});


const docClient = new AWS.DynamoDB.DocumentClient({
  apiVersion: '2012-08-10',
  region: 'eu-central-1',
  credentials: new AWS.Credentials(WM_AWS_ACCESS_KEY_ID, WM_AWS_SECRET_ACCESS_KEY)
});


async function loadAndExtractRecordingFile(awsKey) {

  const params = { Bucket: WM_S3_BUCKET_NAME, Key: awsKey };
  const recordingFile = await s3.getObject(params).promise();
  const unzipped = await JSZip.loadAsync(recordingFile.Body);

  const recordingCsvFile = unzipped.file('recording.csv');
  const recordingCsv = await recordingCsvFile.async('text');
  const recordings = await parseCsv(recordingCsv);

  const profileFile = unzipped.file('profile.json');
  const profile = JSON.parse(await profileFile.async('text'));

  return { recordings, profile };

}


function prepareAndFilterRecordings(recordings) {
  const recordingsByLocTimeMap = recordings.data.reduce((entryMap, e) => entryMap.set(e.locTime, [...entryMap.get(e.locTime) || [], e]), new Map());
  return Array
    .from(recordingsByLocTimeMap.values())
    .map(group => {
      const lat = group.reduce((p, c) => p + c.lat, 0) / group.length;
      const lon = group.reduce((p, c) => p + c.lon, 0) / group.length;
      const velocity = group.reduce((p, c) => p + c.velocity, 0) / group.length;
      return {
        locTime: group[0].locTime,
        lat,
        lon,
        h3IndexRes13: h3.geoToH3(lat, lon, 13),
        maxAcceleration: Math.max(...group.map(e => e.acceleration)),
        avgAcceleration: group.map(e => e.acceleration).reduce((p, c) => p + c, 0) / group.length,
        velocity
      };
    })
    .filter(r => {
      const velocityRating = rateVelocity(r.velocity);
      return velocityRating === GOOD_SPEED || velocityRating === PERFECT_SPEED;
    });
}


function normalizeRecordings(recordings, profile) {

  const adjustToBounds = (valueToAdjust, lowerBound, upperBound) => Math.min(upperBound, Math.max(lowerBound, valueToAdjust));
  const normalize = (value, lowerBound, upperBound) => (value - lowerBound) / (upperBound - lowerBound);

  return recordings.map(recording => {

    const adjustedMaxAcceleration = adjustToBounds(recording.maxAcceleration, profile.maxAcceleration.lowerValue, profile.maxAcceleration.upperValue);
    const normalizedMaxAcceleraton = normalize(adjustedMaxAcceleration, profile.maxAcceleration.lowerValue, profile.maxAcceleration.upperValue);
    const adjustedAvgAcceleration = adjustToBounds(recording.avgAcceleration, profile.avgAcceleration.lowerValue, profile.avgAcceleration.upperValue);
    const normalizedAvgAcceleraton = normalize(adjustedAvgAcceleration, profile.avgAcceleration.lowerValue, profile.avgAcceleration.upperValue);

    return {
      ...recording,
      maxAcceleration: normalizedMaxAcceleraton,
      avgAcceleration: normalizedAvgAcceleraton
    };

  });

}


function groupByH3Index(recordings) {
  const recordingsPerH3Res13Map = recordings.reduce((entryMap, e) => entryMap.set(e.h3IndexRes13, [...entryMap.get(e.h3IndexRes13) || [], e]), new Map());
  return Array
    .from(recordingsPerH3Res13Map.values())
    .map(group => {
      return ({
        h3IndexRes13: group[0].h3IndexRes13,
        entries: group
      });
    });
}


async function parseCsv(csv) {

  return new Promise((resolve, reject) => {

    const parseConfig = {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: resolve,
      error: reject
    };
    Papa.parse(csv, parseConfig);

  });

}


function rateVelocity(velocity) {

  if (velocity < MIN_VELOCITY) {
    return TOO_SLOW;
  }

  if (velocity > MAX_VELOCITY) {
    return TOO_FAST;
  }

  if (velocity > BEST_VELOCITY) {
    return GOOD_SPEED;
  }

  return PERFECT_SPEED;

}


async function saveToDatabase(recordingsByH3Index) {

  const promises = recordingsByH3Index.map(recordings => {

    return new Promise((resolve, reject) => {

      const params = {
        TableName: 'AccelerationBaseData',
        Key: {
          h3IndexRes07: h3.h3ToParent(recordings.h3IndexRes13, 7),
          h3IndexRes13: recordings.h3IndexRes13,
        },
        UpdateExpression: 'set avgAcceleration = :avgAcceleration, maxAcceleration = :maxAcceleration',
        ExpressionAttributeValues: {
          // TODO: Careful! Don't just fetch the first entry. Has to be fixed!
          ':avgAcceleration': recordings.entries[0].avgAcceleration,
          ':maxAcceleration': recordings.entries[0].maxAcceleration
        },
        ReturnValues: 'UPDATED_NEW'
      };

      docClient.update(params, (err, data) => {
        if (err) {
          return reject(err);
        }
        resolve(data);
      });

    });

  });

  return Promise.all(promises);

}


const handler = async (event) => {

  try {

    const key = event.queryStringParameters.key;

    const { recordings, profile } = await loadAndExtractRecordingFile(key);

    const recordingsByLocTime = prepareAndFilterRecordings(recordings);
    const normalizedRecordings = normalizeRecordings(recordingsByLocTime, profile);
    const recordingsPerH3Res13 = groupByH3Index(normalizedRecordings);

    const saveResult = await saveToDatabase(recordingsPerH3Res13);

    return {
      statusCode: 200,
      body: JSON.stringify(saveResult)
    }

  } catch (error) {
    return { statusCode: 500, body: error.toString() }
  }

}

module.exports = { handler }
