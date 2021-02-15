#!/usr/bin/env bash

osmosis --read-pbf file=./osm-data-extracts/magdeburg-latest.osm.pbf \
        --tf accept-ways highway=* \
        --tf accept-ways bicycle=designated,yes \
        --tf reject-ways highway=motorway,motorway_link \
        --tf reject-relations \
        --used-node \
        --write-xml ./osm-data-extracts/highways-magdeburg-latest.osm

osmosis --read-pbf file=./osm-data-extracts/magdeburg-latest.osm.pbf \
        --tf accept-ways highway=* \
        --tf accept-ways bicycle=designated,yes \
        --tf reject-ways highway=motorway,motorway_link \
        --tf reject-relations \
        --used-node \
        --write-pbf ./osm-data-extracts/highways-magdeburg-latest.osm.pbf
