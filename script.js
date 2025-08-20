document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const routeForm = document.getElementById('route-form');
    const summaryBox = document.getElementById('summary-box');
    const extraTimeElement = document.getElementById('extra-time');
    const peaceOfMindElement = document.getElementById('peace-of-mind');
    const avoidList = document.getElementById('avoid-list');
    const addAvoidBtn = document.getElementById('add-avoid-btn');
    const ctaButton = document.querySelector('.cta-button');

    // --- State Variables ---
    let map;
    let routeLayer = L.layerGroup();
    const peaceOfMindMessages = ["Priceless", "Mission Accomplished", "Crisis Averted", "Serenity Restored"];

    // --- Functions ---

    /**
     * Initializes the Leaflet map.
     */
    function initMap() {
        map = L.map('map').setView([10.5, 76.5], 7); // Centered on Kerala
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(map);
        routeLayer.addTo(map);
    }

    /**
     * Geocodes an address string to latitude and longitude using Nominatim API.
     * @param {string} address The address to geocode.
     * @returns {Promise<object|null>} A promise that resolves to {lat, lon} or null.
     */
    async function geocodeAddress(address) {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=in`);
            const data = await response.json();
            if (data && data.length > 0) {
                return {
                    lat: parseFloat(data[0].lat),
                    lon: parseFloat(data[0].lon)
                };
            }
            return null;
        } catch (error) {
            console.error("Geocoding error:", error);
            alert("There was an error finding the address. Please try again.");
            return null;
        }
    }

    /**
     * Fetches a route from the OSRM API.
     * @param {Array<object>} waypoints - An array of {lon, lat} objects.
     * @returns {Promise<object|null>} A promise that resolves to the route data or null.
     */
    async function getRoute(waypoints) {
        const coordsString = waypoints.map(p => `${p.lon},${p.lat}`).join(';');
        const apiUrl = `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`;

        try {
            const response = await fetch(apiUrl);
            const data = await response.json();
            if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
                return data.routes[0]; // Return the first route object
            }
            return null;
        } catch (error) {
            console.error("Routing error:", error);
            return null;
        }
    }

    /**
     * Clears all layers from the map.
     */
    function clearMap() {
        routeLayer.clearLayers();
    }

    /**
     * Adds a new "avoid" input field to the form.
     */
    function addAvoidInput() {
        const wrapper = document.createElement('div');
        wrapper.className = 'avoid-input-wrapper';

        const newAvoidInput = document.createElement('input');
        newAvoidInput.type = 'text';
        newAvoidInput.className = 'avoid-input';
        newAvoidInput.placeholder = 'Another place to avoid';

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'remove-avoid-btn';
        removeBtn.textContent = 'X';
        removeBtn.onclick = () => wrapper.remove();

        wrapper.appendChild(newAvoidInput);
        wrapper.appendChild(removeBtn);
        avoidList.appendChild(wrapper);
    }
    
    /**
     * The main function to plot the route on the map.
     * @param {Event} event - The form submission event.
     */
    async function plotRoute(event) {
        event.preventDefault();
        clearMap();
        ctaButton.disabled = true;
        ctaButton.textContent = 'Finding Path...';

        const startAddress = document.getElementById('start-point').value;
        const endAddress = document.getElementById('end-point').value;
        const avoidInputs = document.querySelectorAll('.avoid-input');
        const avoidAddresses = Array.from(avoidInputs)
            .map(input => input.value.trim())
            .filter(value => value !== '');

        if (!startAddress || !endAddress) {
            alert("Please fill in the start and end points.");
            ctaButton.disabled = false;
            ctaButton.textContent = 'Find a New Path';
            return;
        }

        // Geocode all addresses concurrently
        const geocodePromises = [geocodeAddress(startAddress), geocodeAddress(endAddress), ...avoidAddresses.map(geocodeAddress)];
        const [startCoords, endCoords, ...avoidCoordsList] = await Promise.all(geocodePromises);

        if (!startCoords || !endCoords) {
            alert("Could not find the start or destination. Please be more specific.");
            ctaButton.disabled = false;
            ctaButton.textContent = 'Find a New Path';
            return;
        }
        
        // Add markers for start and end
        L.marker(startCoords).addTo(routeLayer).bindPopup("Starting Point");
        L.marker(endCoords).addTo(routeLayer).bindPopup("Destination");

        let finalRoute;
        const validAvoidCoords = avoidCoordsList.filter(c => c !== null);

        if (validAvoidCoords.length > 0) {
            // --- DETOUR LOGIC FOR MULTIPLE POINTS (SMARTER & SORTED) ---
            
            // Sort the avoid coordinates by their distance from the start point
            validAvoidCoords.sort((a, b) => {
                const distA = getDistance(startCoords, a);
                const distB = getDistance(startCoords, b);
                return distA - distB;
            });
            
            const waypoints = [startCoords];

            // Draw all the "No-Go Zone" circles on the map
            validAvoidCoords.forEach((avoidPoint, index) => {
                L.circle(avoidPoint, {
                    color: 'red',
                    fillColor: '#f03',
                    fillOpacity: 0.3,
                    radius: 2000 // 2km radius
                }).addTo(routeLayer).bindPopup(`No-Go Zone ${index + 1}`);
            });

            // For each point to avoid, calculate a smarter detour waypoint and add it to our list sequentially.
            validAvoidCoords.forEach(avoidPoint => {
                const previousWaypoint = waypoints[waypoints.length - 1];
                
                // **FIX:** Increase distance to 7.5km for a wider berth
                const detourCandidates = calculateDetourPoints(previousWaypoint, endCoords, avoidPoint, 7500);
                
                // **FIX:** Intelligently choose the better side (p1 or p2) by comparing path distances
                const cost1 = getDistance(previousWaypoint, detourCandidates.p1) + getDistance(detourCandidates.p1, endCoords);
                const cost2 = getDistance(previousWaypoint, detourCandidates.p2) + getDistance(detourCandidates.p2, endCoords);

                if (cost1 <= cost2) {
                    waypoints.push(detourCandidates.p1);
                } else {
                    waypoints.push(detourCandidates.p2);
                }
            });

            waypoints.push(endCoords);

            // Get the final route that passes through the start, all detour points, and the end.
            finalRoute = await getRoute(waypoints);

        } else {
            // --- DIRECT ROUTE LOGIC ---
            finalRoute = await getRoute([startCoords, endCoords]);
        }

        if (finalRoute && finalRoute.geometry) {
            const routeGeoJSON = L.geoJSON(finalRoute.geometry, {
                style: { color: '#ff007f', weight: 5 }
            });
            routeLayer.addLayer(routeGeoJSON);
            map.fitBounds(routeGeoJSON.getBounds(), { padding: [50, 50] });

            // Update summary box
            const durationMinutes = Math.round(finalRoute.duration / 60);
            extraTimeElement.innerHTML = `<strong>Travel Time:</strong> ${durationMinutes} minutes`;
            const randomMessage = peaceOfMindMessages[Math.floor(Math.random() * peaceOfMindMessages.length)];
            peaceOfMindElement.innerHTML = `<strong>Peace of Mind:</strong> ${randomMessage}`;
            summaryBox.classList.remove('hidden');

        } else {
            alert("Could not find a route. The locations might be unreachable by car or the detour is too complex.");
        }
        
        ctaButton.disabled = false;
        ctaButton.textContent = 'Find a New Path';
    }
    
    // --- Geospatial Helper Functions ---

    function toRad(degrees) { return degrees * Math.PI / 180; }
    function toDeg(radians) { return radians * 180 / Math.PI; }
    
    /**
     * Calculates the distance between two lat/lon points using the Haversine formula.
     * @param {object} p1 - {lat, lon} of point 1.
     * @param {object} p2 - {lat, lon} of point 2.
     * @returns {number} The distance in metres.
     */
    function getDistance(p1, p2) {
        const R = 6371e3; // metres
        const φ1 = toRad(p1.lat);
        const φ2 = toRad(p2.lat);
        const Δφ = toRad(p2.lat - p1.lat);
        const Δλ = toRad(p2.lon - p1.lon);

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }


    /**
     * Calculates two points to detour around a central avoid point.
     * @param {object} start - {lat, lon} of start
     * @param {object} end - {lat, lon} of end
     * @param {object} avoid - {lat, lon} of the point to avoid
     * @param {number} distance - The distance in meters to create the detour points away from the avoid point
     * @returns {object} {p1, p2} containing the two detour points.
     */
    function calculateDetourPoints(start, end, avoid, distance) {
        const R = 6371e3; // Earth's radius in metres
        const bear = getBearing(start, end);
        
        // Calculate bearings perpendicular to the main route's bearing
        const bear1 = (bear + 90) % 360;
        const bear2 = (bear - 90 + 360) % 360;
        
        const p1 = getDestination(avoid, bear1, distance);
        const p2 = getDestination(avoid, bear2, distance);

        return { p1, p2 };
    }
    
    /**
     * Calculates the destination point given a starting point, bearing, and distance.
     */
    function getDestination(start, bearing, distance) {
        const R = 6371e3; // Earth's radius in metres
        const lat1 = toRad(start.lat);
        const lon1 = toRad(start.lon);
        const brng = toRad(bearing);

        const lat2 = Math.asin(Math.sin(lat1) * Math.cos(distance / R) +
            Math.cos(lat1) * Math.sin(distance / R) * Math.cos(brng));
        let lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(distance / R) * Math.cos(lat1),
            Math.cos(distance / R) - Math.sin(lat1) * Math.sin(lat2));

        return { lat: toDeg(lat2), lon: toDeg(lon2) };
    }
    
    /**
     * Calculates the bearing between two points.
     */
    function getBearing(start, end) {
        const lat1 = toRad(start.lat);
        const lon1 = toRad(start.lon);
        const lat2 = toRad(end.lat);
        const lon2 = toRad(end.lon);

        const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
        const brng = Math.atan2(y, x);

        return (toDeg(brng) + 360) % 360;
    }


    // --- Event Listeners ---
    routeForm.addEventListener('submit', plotRoute);
    addAvoidBtn.addEventListener('click', addAvoidInput);

    // --- Initial Load ---
    initMap();
});
