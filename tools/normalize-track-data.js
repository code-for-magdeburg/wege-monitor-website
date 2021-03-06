const Papa = require('papaparse');
const ss = require('simple-statistics');
const fs = require('fs');
const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')


const argv = yargs(hideBin(process.argv))
  .option('l', {
    alias: 'location-data',
    demandOption: true,
    type: 'string',
    requiresArg: true
  })
  .option('a', {
    alias: 'acceleration-data',
    demandOption: true,
    type: 'string',
    requiresArg: true
  })
  .option('p', {
    alias: 'processed-data',
    type: 'string',
    requiresArg: true
  })
  .argv;

const locationDataFilePath = argv.locationData;
const accelerationDataFilePath = argv.accelerationData;
const processedDataFilePath = argv.processedData || './output.csv';


(async (locationDataFilePath, accelerationDataFilePath, processedDataFilePath) => {
  const data = await loadAndMergeDatasets(locationDataFilePath, accelerationDataFilePath);
  const processedData = processData(data);
  saveProcessedData(processedDataFilePath, processedData);
})(locationDataFilePath, accelerationDataFilePath, processedDataFilePath);


async function loadAndMergeDatasets(locationFilename, accelerationFilename) {

  const locationData = await parseAndTransformLocationData(locationFilename);
  const accelerationData = await parseAndTransformAccelerationData(accelerationFilename);

  const m = new Map();
  locationData.forEach(ld => m.set(ld.second, { ...ld, accelerationData: [] }));
  accelerationData.forEach(ad => {
    const existing = m.get(ad.second);
    if (existing) {
      Object.assign(existing, { accelerationData: ad.accelerationData })
    } else {
      m.set(ad.second, { ...ad, locationData: [] });
    }
  });

  return Array.from(m.values());

}


function processData(data) {
  return data
    .map(d => ({
      time: d.second,
      latitude: d.locationData.length > 0 ? ss.average(d.locationData.map(ld => ld.latitude)) : 0,
      longitude: d.locationData.length > 0 ? ss.average(d.locationData.map(ld => ld.longitude)) : 0,
      maxAcceleration: d.accelerationData.length > 0 ? ss.max(d.accelerationData.map(ad => ad.acceleration)) : 0,
      avgAcceleration: d.accelerationData.length > 0 ? ss.average(d.accelerationData.map(ad => ad.acceleration)) : 0,
      velocity: d.locationData.length > 0 ? ss.average(d.locationData.map(ld => ld.velocity)) : 0
    }))
    .filter(d => d.latitude !== 0 && d.longitude !== 0);
}


function saveProcessedData(filename, data) {
  fs.writeFileSync(filename, Papa.unparse(data));
}


function parseAndTransformLocationData(filename) {

  return new Promise((resolve, reject) => {

    const locationText = fs.readFileSync(filename, 'utf8');
    Papa.parse(locationText, {
      header: true,
      skipEmptyLines: true,
      complete: function (results) {
        const csvData = results.data;
        const locationData = csvData.map(mapRawDataToLocationData);
        const locationDataBySecondObj = locationData.reduce(reduceToTimeBucket, {});
        const locationDataBySecond = transformLocationDataToArrayOfSeconds(locationDataBySecondObj);
        resolve(locationDataBySecond);
      }
    });

  });

}


function parseAndTransformAccelerationData(filename) {

  return new Promise((resolve, reject) => {

    const accelerationText = fs.readFileSync(filename, 'utf8');
    Papa.parse(accelerationText, {
      header: true,
      skipEmptyLines: true,
      complete: function (results) {
        const csvData = results.data;
        const accelerationData = csvData.map(mapRawDataToAccelerationData);
        const accelerationDataBySecondObj = accelerationData.reduce(reduceToTimeBucket, {});
        const accelerationDataBySecond = transformAccelerationDataToArrayOfSeconds(accelerationDataBySecondObj);
        resolve(accelerationDataBySecond);
      }
    });

  });

}


function mapRawDataToLocationData(raw) {
  return {
    time: +raw.time,
    latitude: +raw.lat,
    longitude: +raw.lon,
    velocity: +raw.velocity
  };
}


function mapRawDataToAccelerationData(raw) {
  return {
    time: +raw.time,
    acceleration: +raw.accAbsolute
  };
}


function reduceToTimeBucket(p, c) {
  const timeBucket = Math.floor(c.time);
  p[timeBucket] = [...(p[timeBucket] || []), c];
  return p;
}


function transformLocationDataToArrayOfSeconds(obj) {
  return Object.keys(obj).map(key => ({
    second: +key,
    locationData: obj[key]
  }));
}


function transformAccelerationDataToArrayOfSeconds(obj) {
  return Object.keys(obj).map(key => ({
    second: +key,
    accelerationData: obj[key]
  }));
}
