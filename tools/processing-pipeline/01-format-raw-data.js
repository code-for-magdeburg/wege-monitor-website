const fs = require('fs');
const Papa = require('papaparse');
const ss = require('simple-statistics');


const locationDataFilePath = '/Users/jens/git/CodeForMD/wege-monitor/wege-monitor-website/data/jens/2021-03-07 11-17-05/Location.csv';
const accelerationDataFilePath = '/Users/jens/git/CodeForMD/wege-monitor/wege-monitor-website/data/jens/2021-03-07 11-17-05/Acceleration.csv';


async function loadRawLocationData(locationDataFilePath) {

  return new Promise((resolve, reject) => {
    fs.readFile(locationDataFilePath, 'utf8', (err, data) => {
      if (err) {
        return reject(err);
      }
      resolve(data);
    });

  });

}


async function loadRawAccelerationData(accelerationDataFilePath) {

  return new Promise((resolve, reject) => {
    fs.readFile(accelerationDataFilePath, 'utf8', (err, data) => {
      if (err) {
        return reject(err);
      }
      resolve(data);
    });

  });

}


async function parseRawLocationData(rawLocationData) {

  return new Promise((resolve, reject) => {

    Papa.parse(rawLocationData, {
      header: true,
      skipEmptyLines: true,
      complete: results => {
        const csvData = results.data;
        const locationData = csvData.map(mapRawDataToLocationData);
        resolve(locationData);
      },
      error: error => reject(error)
    });

  });

}


function aggregateLocationData(parsedRawLocationData) {

  const mappedBySecond = new Map();

  for (const parsedRawLocationDatum of parsedRawLocationData) {
    const second = Math.floor(parsedRawLocationDatum.time);
    const secondEntry = mappedBySecond.get(second);
    if (secondEntry) {
      secondEntry.push(parsedRawLocationDatum);
    } else {
      mappedBySecond.set(second, [parsedRawLocationDatum]);
    }
  }

  const result = [];
  for (const [key, value] of mappedBySecond) {
    result.push({
      time: key,
      latitude: ss.average(value.map(v => v.latitude)),
      longitude: ss.average(value.map(v => v.longitude)),
      velocity: ss.average(value.map(v => v.velocity)),
    });
  }

  return result;

}


async function parseRawAccelerationData(rawAccelerationData) {

  return new Promise((resolve, reject) => {

    Papa.parse(rawAccelerationData, {
      header: true,
      skipEmptyLines: true,
      complete: results => {
        const csvData = results.data;
        const accelerationData = csvData.map(mapRawDataToAccelerationData);
        resolve(accelerationData);
      },
      error: error => reject(error)
    });

  });

}


function mapRawDataToLocationData(rawData) {
  return {
    time: +rawData.time,
    latitude: +rawData.lat,
    longitude: +rawData.lon,
    velocity: +rawData.velocity
  };
}


function mapRawDataToAccelerationData(rawData) {
  return {
    time: +rawData.time,
    acceleration: +rawData.accAbsolute
  };
}


function aggregateAccelerationData(parsedRawAccelerationData) {

  const mappedBySecond = new Map();

  for (let parsedRawAccelerationDatum of parsedRawAccelerationData) {
    const second = Math.floor(parsedRawAccelerationDatum.time);
    const secondEntry = mappedBySecond.get(second);
    if (secondEntry) {
      secondEntry.push(parsedRawAccelerationDatum);
    } else {
      mappedBySecond.set(second, [parsedRawAccelerationDatum]);
    }
  }

  const result = [];
  for (const [key, value] of mappedBySecond) {
    result.push({
      time: key,
      avgAcceleration: ss.average(value.map(v => v.acceleration)),
      maxAcceleration: ss.max(value.map(v => v.acceleration)),
    });
  }

  return result;

}


function mergeLocationDataAndAccelerationData(locationData, accelerationData) {

  const m = new Map();
  locationData.forEach(ld => m.set(ld.time, { ...ld, maxAcceleration: 0, avgAcceleration: 0 }));
  accelerationData.forEach(ad => {
    const existing = m.get(ad.time);
    if (existing) {
      Object.assign(existing, { maxAcceleration: ad.maxAcceleration, avgAcceleration: ad.avgAcceleration })
    }
  });

  return Array.from(m.values());

}


module.exports.formatAndAggregateRawData = async function () {

  const loadedRawLocationData = await loadRawLocationData(locationDataFilePath);
  const parsedRawLocationData = await parseRawLocationData(loadedRawLocationData);
  const aggregatedLocationData = aggregateLocationData(parsedRawLocationData);

  const loadedRawAccelerationData = await loadRawAccelerationData(accelerationDataFilePath);
  const parsedRawAccelerationData = await parseRawAccelerationData(loadedRawAccelerationData);
  const aggregatedAccelerationData = aggregateAccelerationData(parsedRawAccelerationData);

  const mergedData = mergeLocationDataAndAccelerationData(aggregatedLocationData, aggregatedAccelerationData);
  return mergedData;

};
