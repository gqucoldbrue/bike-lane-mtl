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

// Initialize Mapbox Directions
const directions = new MapboxDirections({
  accessToken: mapboxgl.accessToken,
  unit: 'metric',
  profile: 'mapbox/cycling', // Use cycling profile for bike directions
  alternatives: true,
  congestion: true,
  interactive: false, // We'll handle the UI ourselves
  controls: {
    inputs: false,
    instructions: false
  }
});

// Initialize variables
let userLocation = null;
let userBearing = 0;
let activePath = null;
let simulationMode = true; // For testing without GPS
let dataLoaded = false;
let currentRoute = null;

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
  
  // Add the directions control (invisible UI, we'll use our own)
  map.addControl(directions, 'top-left');
  
  // If data is already loaded, add the bike path layers
  if (dataLoaded) {
    addBikePathLayers();
  } else {
    console.log("Waiting for bike path data to load...");
  }
  
  // Listen for route results
  directions.on('route', (e) => {
    // Update the current route and show safety info for the first step
    currentRoute = e.route[0]; // Use the first route
    console.log("Received route:", currentRoute);
    
    // Display route steps
    displayRouteSteps(currentRoute);
    
    // Check for bike path safety info for the first step
    if (currentRoute && currentRoute.legs[0] && currentRoute.legs[0].steps[0]) {
      const firstStep = currentRoute.legs[0].steps[0];
      const startCoord = firstStep.geometry.coordinates[0];
      
      // Set user location to the start of the route for testing
      userLocation = startCoord;
      updateUserLocation();
      
      // Check for nearby bike paths to show safety info
      checkNearbyPaths();
    }
  });
});

// Handle route point inputs
document.getElementById('get-directions').addEventListener('click', () => {
  const startInput = document.getElementById('start-point').value;
  const endInput = document.getElementById('end-point').value;
  
  if (!startInput || !endInput) {
    alert("Please enter both start and end locations");
    return;
  }
  
  // Clear previous route
  document.querySelector('.instructions-panel').innerHTML = '<div class="loading">Finding route...</div>';
  
  // Set the origin and destination
  directions.setOrigin(startInput);
  directions.setDestination(endInput);
});

// Use my location button
document.getElementById('use-my-location').addEventListener('click', () => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = [position.coords.longitude, position.coords.latitude];
        document.getElementById('start-point').value = coords.join(',');
      },
      (error) => {
        console.error('Error getting location:', error);
        alert('Could not get your location. Please enter it manually.');
      }
    );
  } else {
    alert('Geolocation is not supported by your browser. Please enter your location manually.');
  }
});

// Display route steps in the instructions panel
function displayRouteSteps(route) {
  if (!route || !route.legs || !route.legs[0] || !route.legs[0].steps) {
    console.error("Invalid route data:", route);
    return;
  }
  
  const stepsContainer = document.querySelector('.instructions-panel');
  stepsContainer.innerHTML = '';
  
  // Create list for all steps
  const stepsList = document.createElement('ul');
  stepsList.className = 'route-steps';
  
  // Only show the first 5 steps initially to save space
  const stepsToShow = route.legs[0].steps.slice(0, 5);
  
  stepsToShow.forEach((step, index) => {
    const stepItem = document.createElement('li');
    stepItem.className = 'route-step';
    
    // Create step header with number and instruction
    const stepHeader = document.createElement('div');
    stepHeader.className = 'instruction-step';
    
    const stepNumber = document.createElement('div');
    stepNumber.className = 'step-number';
    stepNumber.textContent = index + 1;
    
    const stepContent = document.createElement('div');
    stepContent.className = 'step-content';
    
    const stepDirection = document.createElement('div');
    stepDirection.className = 'step-direction';
    // Simplify long instructions
    let instruction = step.maneuver.instruction;
    if (instruction.length > 40) {
      instruction = instruction.substring(0, 40) + '...';
    }
    stepDirection.textContent = instruction;
    
    // Create safety info placeholder (will be filled when selected)
    const safetySuggestion = document.createElement('div');
    safetySuggestion.className = 'step-safety-info';
    safetySuggestion.textContent = 'Tap for safety info';
    
    // Add event listener to show safety info when clicked
    stepItem.addEventListener('click', () => {
      // Center map on this step and show safety info
      const coords = step.geometry.coordinates[0];
      map.flyTo({
        center: coords,
        zoom: 16
      });
      
      // Update user location for testing
      userLocation = coords;
      updateUserLocation();
      
      // Check nearby bike lanes
      checkNearbyPaths();
    });
    
    // Assemble the elements
    stepContent.appendChild(stepDirection);
    stepContent.appendChild(safetySuggestion);
    stepHeader.appendChild(stepNumber);
    stepHeader.appendChild(stepContent);
    stepItem.appendChild(stepHeader);
    
    stepsList.appendChild(stepItem);
  });
  
  // If there are more steps, add a "more steps" indicator
  if (route.legs[0].steps.length > 5) {
    const moreSteps = document.createElement('li');
    moreSteps.className = 'more-steps';
    moreSteps.textContent = `+ ${route.legs[0].steps.length - 5} more steps...`;
    moreSteps.addEventListener('click', () => {
      // Show all steps when clicked
      stepsContainer.innerHTML = '';
      const fullStepsList = document.createElement('ul');
      fullStepsList.className = 'route-steps';
      
      route.legs[0].steps.forEach((step, index) => {
        const stepItem = document.createElement('li');
        stepItem.className = 'route-step';
        
        const stepHeader = document.createElement('div');
        stepHeader.className = 'instruction-step';
        
        const stepNumber = document.createElement('div');
        stepNumber.className = 'step-number';
        stepNumber.textContent = index + 1;
        
        const stepContent = document.createElement('div');
        stepContent.className = 'step-content';
        
        const stepDirection = document.createElement('div');
        stepDirection.className = 'step-direction';
        let instruction = step.maneuver.instruction;
        if (instruction.length > 40) {
          instruction = instruction.substring(0, 40) + '...';
        }
        stepDirection.textContent = instruction;
        
        const safetySuggestion = document.createElement('div');
        safetySuggestion.className = 'step-safety-info';
        safetySuggestion.textContent = 'Tap for safety info';
        
        stepItem.addEventListener('click', () => {
          const coords = step.geometry.coordinates[0];
          map.flyTo({
            center: coords,
            zoom: 16
          });
          userLocation = coords;
          updateUserLocation();
          checkNearbyPaths();
        });
        
        stepContent.appendChild(stepDirection);
        stepContent.appendChild(safetySuggestion);
        stepHeader.appendChild(stepNumber);
        stepHeader.appendChild(stepContent);
        stepItem.appendChild(stepHeader);
        
        fullStepsList.appendChild(stepItem);
      });
      
      stepsContainer.appendChild(fullStepsList);
    });
    stepsList.appendChild(moreSteps);
  }
  
  stepsContainer.appendChild(stepsList);
}
      
      // Update user location for testing
      userLocation = coords;
      updateUserLocation();
      
      // Check nearby bike lanes
      checkNearbyPaths();
    });
    
    // Assemble the elements
    stepContent.appendChild(stepDirection);
    stepContent.appendChild(safetySuggestion);
    stepHeader.appendChild(stepNumber);
    stepHeader.appendChild(stepContent);
    stepItem.appendChild(stepHeader);
    
    stepsList.appendChild(stepItem);
  });
  
  stepsContainer.appendChild(stepsList);
}

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
  
  // Set up click handler for bike paths
  map.on('click', 'bike-paths-layer', (e) => {
    const features = map.queryRenderedFeatures(e.point, {
      layers: ['bike-paths-layer']
    });
    
    if (features.length > 0) {
      activePath = features[0];
      updatePathIndicators(activePath);
    }
  });
  
  // Simulate a route for demonstration
  simulateRoute();
}

// Handle the locate button
document.getElementById('locate-button').addEventListener('click', () => {
  console.log("Location button clicked, simulation mode:", simulationMode);
  
  if (simulationMode) {
    simulateUserLocation();
  } else if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        userLocation = [position.coords.longitude, position.coords.latitude];
        updateUserLocation();
        
        // Center map on user's location
        map.flyTo({
          center: userLocation,
          zoom: 15
        });
        
        // Check nearby bike paths
        checkNearbyPaths();
      },
      (error) => {
        console.error('Error getting location:', error);
        alert('Could not get your location. Using simulation mode.');
        simulationMode = true;
        simulateUserLocation();
      }
    );
  } else {
    alert('Geolocation is not supported by your browser. Using simulation mode.');
    simulationMode = true;
    simulateUserLocation();
  }
  
  console.log("After location update, user location:", userLocation);
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
  
  if (!sideIndicator || !directionIndicator) {
    console.error("Side or direction indicator elements not found in DOM");
    return;
  }
  
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

// Update the instruction panel with enhanced data
function updateInstructionPanel(path, userDirection, positionText) {
  // Only update safety info if we're not showing route instructions
  if (currentRoute) return;
  
  const instructionsPanel = document.querySelector('.instructions-panel');
  
  if (!instructionsPanel) {
    console.error("Instructions panel not found in DOM");
    return;
  }
  
  // Clear existing content
  instructionsPanel.innerHTML = '';
  
  if (!path) {
    instructionsPanel.innerHTML = '<div class="step-safety-info">No specific instructions</div>';
    return;
  }
  
  // Create the instruction step element
  const stepEl = document.createElement('div');
  stepEl.className = 'instruction-step';
  
  const numberEl = document.createElement('div');
  numberEl.className = 'step-number';
  numberEl.textContent = '1';
  
  const contentEl = document.createElement('div');
  contentEl.className = 'step-content';
  
  const directionEl = document.createElement('div');
  directionEl.className = 'step-direction';
  const pathName = path.properties.name.en;
  directionEl.textContent = `On ${pathName}`;
  
  const safetyEl = document.createElement('div');
  safetyEl.className = 'step-safety-info';
  
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
  
  safetyEl.textContent = safetyText;
  
  // Assemble the elements
  contentEl.appendChild(directionEl);
  contentEl.appendChild(safetyEl);
  stepEl.appendChild(numberEl);
  stepEl.appendChild(contentEl);
  instructionsPanel.appendChild(stepEl);
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
  // Only simulate a route if no real route is present
  if (currentRoute) return;
  
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
  
  // First check if we have actual bike path data loaded
  if (montrealBikePaths && montrealBikePaths.features && montrealBikePaths.features.length > 0) {
    // Find a suitable path with enough coordinates
    let suitablePath = null;
    for (let i = 0; i < montrealBikePaths.features.length; i++) {
      const feature = montrealBikePaths.features[i];
      if (feature.geometry.coordinates.length > 2) {
        suitablePath = feature;
        break;
      }
    }
    
    if (suitablePath) {
      // Get a point along this path (middle point is usually good)
      const midIndex = Math.floor(suitablePath.geometry.coordinates.length / 2);
      userLocation = suitablePath.geometry.coordinates[midIndex];
      console.log("Using point from actual bike path:", userLocation);
    } else {
      // Fallback to De Maisonneuve if no suitable path found
      userLocation = [-73.5650, 45.5085];
    }
  } else {
    // Fallback to De Maisonneuve
    userLocation = [-73.5650, 45.5085];
  }
  
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

// Helper function to geocode an address into coordinates
function geocodeAddress(address) {
  return fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${mapboxgl.accessToken}&limit=1`)
    .then(response => response.json())
    .then(data => {
      if (data.features && data.features.length > 0) {
        return data.features[0].center;
      } else {
        throw new Error("Location not found");
      }
    });
}

// Helper function to test the map with specific locations
function testRoute(start, end) {
  document.getElementById('start-point').value = start;
  document.getElementById('end-point').value = end;
  document.getElementById('get-directions').click();
}

// When the window loads, we can set up some test locations
window.addEventListener('load', () => {
  // You can uncomment and modify these to test specific routes
  // setTimeout(() => {
  //   testRoute("McGill University, Montreal", "Place des Arts, Montreal");
  // }, 3000);
});