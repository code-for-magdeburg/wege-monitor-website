#!/usr/bin/env bash

osmosis --read-pbf file=./osm-data-extracts/sachsen-anhalt-latest.osm.pbf \
        --bounding-polygon file=./bounding-polygons/magdeburg.poly \
        --write-pbf ./osm-data-extracts/magdeburg-latest.osm.pbf

osmosis --read-pbf file=./osm-data-extracts/sachsen-anhalt-latest.osm.pbf \
        --bounding-polygon file=./bounding-polygons/magdeburg.poly \
        --write-xml ./osm-data-extracts/magdeburg-latest.osm
