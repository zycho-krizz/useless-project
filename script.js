document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const routeForm = document.getElementById('route-form');
    const summaryBox = document.getElementById('summary-box');
    const peaceOfMindElement = document.getElementById('peace-of-mind');
    const avoidList = document.getElementById('avoid-list');
    const addAvoidBtn = document.getElementById('add-avoid-btn');

    // --- State Variables ---
    let map;
    let routeLayer = L.layerGroup();
    const peaceOfMindMessages = ["Priceless", "Mission Accomplished", "Crisis Averted", "Serenity Restored"];

    // --- Functions ---
    
    function initMap() {
        map = L.map('map').setView([10.5, 76.5], 7);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd', maxZoom: 20
        }).addTo(map);
        routeLayer.addTo(map);
    }

    async function geocodeAddress(address) {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
            const data = await response.json();
            if (data && data.length > 0) {
                return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
            }
            return null;
        } catch (error) {
            console.error("Geocoding error:", error);
            return null;
        }
    }

    function clearMap() {
        routeLayer.clearLayers();
    }
    
    // NEW FUNCTION: Handles adding a new "avoid" input field
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
        removeBtn.onclick = () => wrapper.remove(); // Remove the entire wrapper on click

        wrapper.appendChild(newAvoidInput);
        wrapper.appendChild(removeBtn);
        avoidList.appendChild(wrapper);
    }
    
    // MODIFIED FUNCTION: Now handles an array of "avoid" locations
    async function plotRoute(event) {
        event.preventDefault();
        clearMap();

        const startAddress = document.getElementById('start-point').value;
        const endAddress = document.getElementById('end-point').value;
        
        // Get all avoid inputs and create an array of their values
        const avoidInputs = document.querySelectorAll('.avoid-input');
        const avoidAddresses = Array.from(avoidInputs)
            .map(input => input.value.trim())
            .filter(value => value !== ''); // Filter out empty strings

        if (!startAddress || !endAddress) {
            alert("Please fill in the start and end points.");
            return;
        }

        // Create an array of promises for all geocoding requests
        const startPromise = geocodeAddress(startAddress);
        const endPromise = geocodeAddress(endAddress);
        const avoidPromises = avoidAddresses.map(address => geocodeAddress(address));

        // Wait for all promises to resolve
        const [startCoords, endCoords, ...avoidCoords] = await Promise.all([startPromise, endPromise, ...avoidPromises]);

        if (!startCoords || !endCoords) {
            alert("Could not find the start or destination. Please be more specific.");
            return;
        }

        // --- Draw on Map ---
        L.marker(startCoords).addTo(routeLayer).bindPopup("Starting Point");
        L.marker(endCoords).addTo(routeLayer).bindPopup("Destination");
        
        // Loop through all found avoid coordinates and draw a circle for each
        const validAvoidCoords = avoidCoords.filter(coords => coords !== null);
        validAvoidCoords.forEach((coords, index) => {
            L.circle(coords, {
                color: 'red', fillColor: '#f03', fillOpacity: 0.3, radius: 5000
            }).addTo(routeLayer).bindPopup("No-Go Zone: " + avoidAddresses[index]);
        });
        
        // For the demo, the straight-line route will just use the first valid avoid point
        const firstAvoid = validAvoidCoords[0];
        const detourRoute = [
            [startCoords.lat, startCoords.lon],
            firstAvoid ? [firstAvoid.lat + 0.05, firstAvoid.lon + 0.05] : [startCoords.lat, startCoords.lon], // Simple angle
            [endCoords.lat, endCoords.lon]
        ];
        
        L.polyline(detourRoute, { color: '#ff007f', weight: 5 }).addTo(routeLayer);

        map.fitBounds(L.latLngBounds(detourRoute), { padding: [50, 50] });
        
        const randomMessage = peaceOfMindMessages[Math.floor(Math.random() * peaceOfMindMessages.length)];
        peaceOfMindElement.innerHTML = `<strong>Peace of Mind:</strong> ${randomMessage}`;
        summaryBox.classList.remove('hidden');
    }

    // --- Event Listeners ---
    routeForm.addEventListener('submit', plotRoute);
    addAvoidBtn.addEventListener('click', addAvoidInput); // New listener for the "add" button

    // --- Initial Load ---
    initMap();
});