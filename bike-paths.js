// Enhanced bike path data for Montreal
const montrealBikePaths = {
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "properties": {
          "id": "demaisonneuve-main",
          "name": {
            "en": "De Maisonneuve Bike Path",
            "fr": "Piste cyclable De Maisonneuve"
          },
          "pathType": "protected",
          "streetSide": "south",
          "configuration": "bidirectional",
          "directions": {
            "eastbound": {
              "position": "south",
              "withTraffic": true
            },
            "westbound": {
              "position": "north",
              "withTraffic": true
            }
          },
          "safetyFeatures": ["concrete-barrier"],
          "hazards": ["pedestrian-crossings"]
        },
        "geometry": {
          "type": "LineString",
          "coordinates": [
            [-73.5685, 45.5085],
            [-73.5670, 45.5085],
            [-73.5650, 45.5085],
            [-73.5630, 45.5085]
          ]
        }
      },
      {
        "type": "Feature",
        "properties": {
          "id": "bordeaux-street",
          "name": {
            "en": "Rue de Bordeaux",
            "fr": "Rue de Bordeaux"
          },
          "pathType": "dedicated",
          "streetSide": "west",
          "configuration": "one-way",
          "directions": {
            "southbound": {
              "position": "full",
              "withTraffic": true
            }
          },
          "safetyFeatures": ["painted-line"],
          "hazards": ["dooring-risk"]
        },
        "geometry": {
          "type": "LineString",
          "coordinates": [
            [-73.5650, 45.5085],
            [-73.5650, 45.5070],
            [-73.5650, 45.5055],
            [-73.5650, 45.5040]
          ]
        }
      },
      {
        "type": "Feature",
        "properties": {
          "id": "rachel-street",
          "name": {
            "en": "Rachel Street",
            "fr": "Rue Rachel"
          },
          "pathType": "protected",
          "streetSide": "south",
          "configuration": "bidirectional",
          "directions": {
            "eastbound": {
              "position": "south",
              "withTraffic": true
            },
            "westbound": {
              "position": "north",
              "withTraffic": true
            }
          },
          "safetyFeatures": ["concrete-barrier"],
          "hazards": ["pedestrian-crossings"]
        },
        "geometry": {
          "type": "LineString",
          "coordinates": [
            [-73.5780, 45.5240],
            [-73.5760, 45.5240],
            [-73.5740, 45.5240],
            [-73.5720, 45.5240]
          ]
        }
      },
      {
        "type": "Feature",
        "properties": {
          "id": "berri-street",
          "name": {
            "en": "Berri Street",
            "fr": "Rue Berri"
          },
          "pathType": "contraflow",
          "streetSide": "east",
          "configuration": "one-way",
          "directions": {
            "northbound": {
              "position": "full",
              "withTraffic": false
            }
          },
          "safetyFeatures": ["painted-line"],
          "hazards": ["one-way-street", "dooring-risk"]
        },
        "geometry": {
          "type": "LineString",
          "coordinates": [
            [-73.5620, 45.5160],
            [-73.5620, 45.5145],
            [-73.5620, 45.5130],
            [-73.5620, 45.5115]
          ]
        }
      }
    ]
  };