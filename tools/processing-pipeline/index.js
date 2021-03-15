const fs = require('fs');
const Papa = require('papaparse');


(async () => {
  const preparedData = await require('./01-format-raw-data').formatAndAggregateRawData();
  console.log(preparedData);
  fs.writeFileSync('/Users/jens/git/CodeForMD/wege-monitor/wege-monitor-website/data/jens/2021-03-07 11-17-05/Prepared.csv', Papa.unparse(preparedData));
  console.log('Done.');
})();


