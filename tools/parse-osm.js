const osmread = require('osm-read');
const GeoJSON = require('geojson');
const fs = require('fs');


const nodes = [];
const ways = [];


osmread.parse({

  filePath: './tools/osm-data-extracts/highways-magdeburg-latest.osm',
  format: 'xml',

  endDocument: function () {

    const osmStreets = ways.map(w => ({
      name: w.name,
      entries: [w.refs.map(r => [r.lon, r.lat])]
    }));

    const geoJson = GeoJSON.parse(osmStreets, { 'MultiLineString': 'entries' });
    fs.writeFileSync('./tools/osm-data-extracts/cyclepaths-magdeburg.geojson', JSON.stringify(geoJson));

    console.log('Done.');

  },

  node: function (node) {
    nodes.push(node);
  },

  way: function (way) {

    ways.push({
      name: way.tags.name,
      refs: way.nodeRefs
        .map(nodeRef => {
          const node = nodes.find(n => n.id === nodeRef);
          if (node) {
            return node;
          }
          return null;
        }).filter(node => !!node)
    });

  },

  error: function (msg) {
    console.log('error: ' + msg);
  }

});
