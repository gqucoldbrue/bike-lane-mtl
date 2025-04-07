// Set your Mapbox access token here
mapboxgl.accessToken = 'pk.eyJ1IjoiYmlrZWxhbmVtdGwiLCJhIjoiY205Nml0ZjN0MWhiNzJrcG44Y2lyNG1sMCJ9.X-LfKNc57YnP7UkbHbrLDg'; // Replace with your actual token

// Initialize the map
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v11',
  center: [-73.5674, 45.5075], // De Maisonneuve & Bordeaux
  zoom: 15
});

// Add navigation controls
map.addControl(new mapboxgl.NavigationControl());

// Initialize variables
let userLocation = null;
let userBearing = 0;
let activePath = null;
let simulationMode = true; // For testing without GPS
let dataLoaded = false;

// Listen for the data loaded event
document.addEventListener('bikePathsLoaded', () => {
  dataLoaded = true;
  console.log("Bike path data loaded event received");
  
  // If the map is already loaded, add the bike path layers
  if (map.isStyleLoaded()) {
    addBikePathLayers();
  }
});

// Add the map controls after the map is loaded
map.on('load', () => {
  console.log("Map loaded");
  
  // If data is already loaded, add the bike path layers
  if (dataLoaded) {
    addBikePathLayers();
  } else {
    console.log("Waiting for bike path data to load...");
  }
});

// Put all the bike path layer code in a separate function
function addBikePathLayers() {
  console.log("Adding bike path layers to map");
  
  // Add the bike paths as a source
  map.addSource('bike-paths', {
    type: 'geojson',
    data: montrealBikePaths
  });
  
  // Add a layer for all bike paths
  map.addLayer({
    id: 'bike-paths-layer',
    type: 'line',
    source: 'bike-paths',
    layout: {
      'line-join': 'round',
      'line-cap': 'round'
    },
    paint: {
      'line-color': [
        'match',
        ['get', 'configuration'],
        'bidirectional', '#2ecc71',  // Green for bidirectional
        '#3498db'  // Blue default for one-way
      ],
      'line-width': [
        'match',
        ['get', 'pathType'],
        'protected', 6,
        'dedicated', 4,
        'multiuse', 5,
        'shared', 2,
        3  // Default
      ],
      'line-opacity': [
        'case',
        ['in', 'four-season', ['get', 'safetyFeatures']],
        1.0,  // Full opacity for year-round paths
        0.7   // Slightly transparent for seasonal paths
      ]
    }
  });
  
  // Add a layer for path arrows to show direction
  map.addLayer({
    id: 'bike-path-arrows',
    type: 'symbol',
    source: 'bike-paths',
    layout: {
      'symbol-placement': 'line',
      'symbol-spacing': 70,
      'icon-image': 'arrow-up',  // Default arrow
      'icon-size': 0.7,
      'icon-allow-overlap': true,
      'icon-ignore-placement': true
    }
  });
  
  // Add a pulsing dot for user location
  map.loadImage(
    'https://docs.mapbox.com/mapbox-gl-js/assets/custom_marker.png',
    (error, image) => {
      if (error) throw error;
      map.addImage('custom-marker', image);
      
      // Add user location source
      map.addSource('user-location', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });
      
      // Add user location layer
      map.addLayer({
        id: 'user-location-layer',
        type: 'symbol',
        source: 'user-location',
        layout: {
          'icon-image': 'custom-marker',
          'icon-size': 0.5,
          'icon-allow-overlap': true
        }
      });
    }
  );
  
  // Simulate a route for demonstration
  simulateRoute();
}

// Handle the locate button
document.getElementById('locate-button').addEventListener('click', () => {
  console.log("Location button clicked, simulation mode:", simulationMode);
  
  // Force simulation mode for testing
  simulationMode = true;
  simulateUserLocation();
  
  console.log("After simulation, user location:", userLocation);
});

// Update user location on the map
function updateUserLocation() {
  if (!userLocation) return;
  
  console.log("Updating user location on map:", userLocation);
  
  const userSource = map.getSource('user-location');
  if (userSource) {
    userSource.setData({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: userLocation
        },
        properties: {
          bearing: userBearing
        }
      }]
    });
  } else {
    console.warn("User location source not found");
  }
}

// Check if user is near a bike path
function checkNearbyPaths() {
  if (!userLocation) return;
  
  console.log("Checking nearby paths at:", userLocation);
  
  // If turf.js is available, use proper spatial queries
  if (typeof turf !== 'undefined') {
    const userPoint = turf.point(userLocation);
    let nearestPath = null;
    let minDistance = Infinity;
    
    // Find the nearest path
    montrealBikePaths.features.forEach(feature => {
      try {
        const line = turf.lineString(feature.geometry.coordinates);
        const nearestPoint = turf.nearestPointOnLine(line, userPoint);
        
        if (nearestPoint.properties.dist < minDistance) {
          minDistance = nearestPoint.properties.dist;
          nearestPath = feature;
        }
      } catch (e) {
        console.warn("Error processing path:", feature.properties.id, e);
      }
    });
    
    // Only consider paths within a certain distance (50 meters)
    if (minDistance < 0.05) {  // roughly 50 meters
      activePath = nearestPath;
      console.log("Found nearby path:", nearestPath.properties.id, "at distance", minDistance);
    } else {
      // For testing, just pick a random path if none is nearby
      const randomIndex = Math.floor(Math.random() * montrealBikePaths.features.length);
      activePath = montrealBikePaths.features[randomIndex];
      console.log("No path nearby, using random path for testing:", activePath.properties.id);
    }
  } else {
    // Fallback if turf.js is not available
    const randomIndex = Math.floor(Math.random() * montrealBikePaths.features.length);
    activePath = montrealBikePaths.features[randomIndex];
    console.log("Using random path:", activePath.properties.id);
  }
  
  // Update the side and direction indicators
  if (activePath) {
    updatePathIndicators(activePath);
  } else {
    console.warn("No path found");
  }
}

// Update path indicators based on active path
function updatePathIndicators(path) {
  const sideIndicator = document.getElementById('side-indicator');
  const directionIndicator = document.getElementById('direction-indicator');
  
  if (!path) {
    sideIndicator.textContent = 'Bike lane: Not on a bike path';
    directionIndicator.textContent = 'Direction: Unknown';
    return;
  }
  
  // Get user's current direction - in a real app this would be from GPS
  // For demo we'll assume eastbound on De Maisonneuve or southbound on other streets
  const userDirection = path.properties.id.includes('demaisonneuve') ? 'eastbound' : 'southbound';
  
  // Set path side indicator
  sideIndicator.textContent = `Bike lane: On ${path.properties.streetSide.toUpperCase()} side`;
  sideIndicator.className = path.properties.streetSide + '-side';
  
  // Set direction indicator
  let directionText = '';
  let positionText = '';
  
  if (path.properties.configuration === 'bidirectional') {
    directionText = 'BIDIRECTIONAL';
    // Get position within the bike lane
    if (path.properties.directions[userDirection]) {
      positionText = `Stay on ${path.properties.directions[userDirection].position.toUpperCase()} side of lane`;
    }
  } else {
    // One-way lane
    const direction = Object.keys(path.properties.directions)[0];
    const withTraffic = path.properties.directions[direction].withTraffic;
    directionText = withTraffic ? 'ONE-WAY with traffic' : 'ONE-WAY against traffic (CONTRAFLOW)';
  }
  
  directionIndicator.textContent = `Direction: ${directionText}`;
  
  // Update safety instruction panel
  updateInstructionPanel(path, userDirection, positionText);
  
  // Update lane visual
  updateLaneVisual(path, userDirection);
}

// Update the turn-by-turn instruction panel with enhanced data
function updateInstructionPanel(path, userDirection, positionText) {
  const streetDirectionElement = document.querySelector('.step-direction');
  const instructionContent = document.querySelector('.step-safety-info');
  
  if (!path) {
    instructionContent.textContent = 'No specific instructions';
    return;
  }
  
  // Update the street name and direction
  const pathName = path.properties.name.en;
  streetDirectionElement.textContent = `On ${pathName}`;
  
  // Create safety instruction based on path properties
  let safetyText = `Bike lane on ${path.properties.streetSide.toUpperCase()} side, `;
  
  // Add configuration
  if (path.properties.configuration === 'bidirectional') {
    safetyText += 'BIDIRECTIONAL path';
    if (positionText) {
      safetyText += ` (${positionText})`;
    }
  } else {
    // One-way configuration
    const direction = Object.keys(path.properties.directions)[0];
    const withTraffic = path.properties.directions[direction].withTraffic;
    safetyText += withTraffic ? 'ONE-WAY with traffic' : 'ONE-WAY against traffic (use caution!)';
  }
  
  // Add path type
  safetyText += `, ${path.properties.pathType.toUpperCase()} lane`;
  
  // Add safety features if present
  if (path.properties.safetyFeatures && path.properties.safetyFeatures.length > 0) {
    safetyText += ` with ${formatSafetyFeatures(path.properties.safetyFeatures)}`;
  }
  
  // Add hazards if present
  if (path.properties.hazards && path.properties.hazards.length > 0) {
    safetyText += ` - Watch for: ${formatHazards(path.properties.hazards)}`;
  }
  
  instructionContent.textContent = safetyText;
}

// Update the visual lane indicator
function updateLaneVisual(path, userDirection) {
  console.log("Updating lane visual for path:", path.properties.id, "direction:", userDirection);
  
  const bikeElement = document.querySelector('.bike-lane');
  const arrowElement = document.querySelector('.direction-arrow');
  
  if (!bikeElement || !arrowElement) {
    console.error("Lane visual elements not found in DOM");
    return;
  }
  
  // Remove existing position classes
  bikeElement.classList.remove('north', 'south', 'east', 'west');
  
  // Add the appropriate position class
  const side = path.properties.streetSide;
  console.log("Adding lane position class:", side);
  bikeElement.classList.add(side);
  
  // Update the arrow direction
  if (path.properties.configuration === 'bidirectional') {
    arrowElement.innerHTML = '⟷';
  } else {
    // For one-way lanes
    const direction = Object.keys(path.properties.directions)[0];
    if (direction === 'northbound') arrowElement.innerHTML = '↑';
    else if (direction === 'southbound') arrowElement.innerHTML = '↓';
    else if (direction === 'eastbound') arrowElement.innerHTML = '→';
    else if (direction === 'westbound') arrowElement.innerHTML = '←';
  }
}

// Helper to format hazards for display
function formatHazards(hazards) {
  const hazardLabels = {
    'dooring-risk': 'car doors',
    'pedestrian-crossings': 'pedestrians',
    'shared-with-cars': 'mixed traffic',
    'seasonal-closure': 'winter closure',
    'busy-intersections': 'busy intersections',
    'one-way-street': 'one-way street'
  };
  
  return hazards.map(h => hazardLabels[h] || h).join(', ');
}

// Helper to format safety features for display
function formatSafetyFeatures(features) {
  const featureLabels = {
    'protected-barrier': 'physical barrier',
    'four-season': 'open year-round',
    'route-verte': 'Route Verte',
    'median-separation': 'median barrier',
    'painted-separation': 'painted buffer'
  };
  
  return features.map(f => featureLabels[f] || f).join(', ');
}

// Simulate a route for demonstration
function simulateRoute() {
  // Set up a simulated route
  document.querySelector('.step-direction').textContent = 'Turn left onto Bordeaux';
  
  // Find a path in our data to use
  if (montrealBikePaths && montrealBikePaths.features && montrealBikePaths.features.length > 0) {
    const randomIndex = Math.floor(Math.random() * montrealBikePaths.features.length);
    const path = montrealBikePaths.features[randomIndex];
    
    // Update indicators with this path
    if (path) {
      updatePathIndicators(path);
    }
  }
}

// Simulate user location for demonstration
function simulateUserLocation() {
  console.log("Simulating user location");
  
  // Set a simulated location at De Maisonneuve & Bordeaux
  userLocation = [-73.5650, 45.5085];
  userBearing = 180; // Facing south
  
  updateUserLocation();
  
  // Center map on simulated location
  map.flyTo({
    center: userLocation,
    zoom: 15
  });
  
  // Check nearby paths
  checkNearbyPaths();
}