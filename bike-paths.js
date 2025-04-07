// Initialize this as a placeholder until data is loaded
let montrealBikePaths = {
  "type": "FeatureCollection",
  "features": []
};

// Function to load and process bike path data
async function loadBikePaths() {
  try {
    console.log("Loading bike path data...");
    
    // Fetch the JSON file with the correct name
    const response = await fetch('reseau_cyclabe.json');
    
    if (!response.ok) {
      throw new Error(`Failed to load bike path data: ${response.status}`);
    }
    
    const montrealBikePathsRaw = await response.json();
    console.log("Bike path data loaded, processing...");
    
    // Process the data with our enhancement function
    montrealBikePaths = enhanceBikeLaneData(montrealBikePathsRaw);
    console.log(`Processed ${montrealBikePaths.features.length} bike paths`);
    
    // If the map is already initialized, update the source
    if (window.map && map.isStyleLoaded()) {
      const source = map.getSource('bike-paths');
      if (source) {
        source.setData(montrealBikePaths);
        console.log("Updated map source with bike path data");
      }
    }
    
    // Trigger any callbacks that might be waiting for this data
    document.dispatchEvent(new Event('bikePathsLoaded'));
    
  } catch (error) {
    console.error("Error loading bike path data:", error);
    // If loading fails, we'll use some minimal sample data
    montrealBikePaths = createSampleData();
    document.dispatchEvent(new Event('bikePathsLoaded'));
  }
}

// Function to enhance the bike path data with additional safety properties
function enhanceBikeLaneData(originalData) {
  return {
    "type": "FeatureCollection",
    "features": originalData.features.map(feature => {
      // Clone the original feature
      const enhancedFeature = JSON.parse(JSON.stringify(feature));
      
      // Add our enhanced properties
      enhancedFeature.properties.id = `path-${enhancedFeature.properties.ID_CYCL}`;
      
      // Add multilingual names
      const arrCode = enhancedFeature.properties.NOM_ARR_VILLE_DESC || "Montreal";
      enhancedFeature.properties.name = {
        "en": `Bike path ${enhancedFeature.properties.ID_CYCL} (${arrCode})`,
        "fr": `Piste cyclable ${enhancedFeature.properties.ID_CYCL} (${arrCode})`
      };
      
      // Determine if bidirectional or one-way
      enhancedFeature.properties.configuration = 
        enhancedFeature.properties.TYPE_VOIE2_CODE === "44" || 
        enhancedFeature.properties.NBR_VOIE === 2 ? 
        "bidirectional" : "one-way";
      
      // Determine which side of the street (this requires analysis)
      // For now, we'll randomize it for demonstration
      const sides = ["north", "south", "east", "west"];
      enhancedFeature.properties.streetSide = sides[Math.floor(Math.random() * sides.length)];
      
      // Determine path type
      enhancedFeature.properties.pathType = determinePathType(enhancedFeature.properties);
      
      // Determine directions
      enhancedFeature.properties.directions = determineDirections(enhancedFeature.properties);
      
      // Add safety features
      enhancedFeature.properties.safetyFeatures = determineSafetyFeatures(enhancedFeature.properties);
      
      // Add potential hazards
      enhancedFeature.properties.hazards = determineHazards(enhancedFeature.properties);
      
      return enhancedFeature;
    })
  };
}

// Helper functions to determine properties
function determinePathType(properties) {
  // Map Montreal's path types to our simplified types
  switch(properties.TYPE_VOIE_CODE) {
    case "5": return "protected"; // "Piste cyclable en site propre"
    case "4": return "dedicated"; // "Piste cyclable sur rue"
    case "7": return "multiuse";  // "Sentier polyvalent"
    default: return "shared";     // Default to shared
  }
}

function determineDirections(properties) {
  // Set up direction information based on configuration
  if (properties.TYPE_VOIE2_CODE === "44" || properties.configuration === "bidirectional") {
    // Bidirectional path
    return {
      "eastbound": {
        "position": "south",
        "withTraffic": true
      },
      "westbound": {
        "position": "north",
        "withTraffic": true
      }
    };
  } else {
    // One-way path (assuming with traffic by default)
    const isWithTraffic = properties.TYPE_VOIE2_DESC?.includes("Dans le sens") || true;
    return {
      "eastbound": {
        "position": "full",
        "withTraffic": isWithTraffic
      }
    };
  }
}

function determineSafetyFeatures(properties) {
  const features = [];
  
  // Check for protected paths
  if (properties.PROTEGE_4S === "Oui") {
    features.push("protected-barrier");
  }
  
  // Check for four-season paths
  if (properties.SAISONS4 === "Oui") {
    features.push("four-season");
  }
  
  // Check for Route Verte designation
  if (properties.ROUTE_VERTE === "Oui") {
    features.push("route-verte");
  }
  
  // Add separator type if available
  if (properties.SEPARATEUR_DESC) {
    switch(properties.SEPARATEUR_CODE) {
      case "M": features.push("median-separation"); break;
      case "P": features.push("painted-separation"); break;
      default: break;
    }
  }
  
  return features;
}

function determineHazards(properties) {
  const hazards = [];
  
  // Determine possible hazards based on path type
  if (properties.TYPE_VOIE_CODE === "1" || properties.TYPE_VOIE_CODE === "2") {
    hazards.push("shared-with-cars");
  }
  
  if (properties.TYPE_VOIE_CODE === "4") {
    hazards.push("dooring-risk");
  }
  
  if (properties.TYPE_VOIE_CODE === "7") {
    hazards.push("pedestrian-crossings");
  }
  
  // Seasonal lanes have winter closure hazard
  if (properties.SAISONS4 === "Non") {
    hazards.push("seasonal-closure");
  }
  
  return hazards;
}

// Create minimal sample data in case loading fails
function createSampleData() {
  return {
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "properties": {
          "id": "path-sample-1",
          "name": {
            "en": "De Maisonneuve Bike Path",
            "fr": "Piste cyclable De Maisonneuve"
          },
          "configuration": "bidirectional",
          "streetSide": "south",
          "pathType": "protected",
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
          "safetyFeatures": ["protected-barrier", "four-season"],
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
          "id": "path-sample-2",
          "name": {
            "en": "Rue de Bordeaux",
            "fr": "Rue de Bordeaux"
          },
          "configuration": "one-way",
          "streetSide": "west",
          "pathType": "dedicated",
          "directions": {
            "southbound": {
              "position": "full",
              "withTraffic": true
            }
          },
          "safetyFeatures": ["painted-separation"],
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
      }
    ]
  };
}

// Start loading bike path data immediately
loadBikePaths();