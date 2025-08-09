# Detour 🗺️

**Plot your escape. A simple web app to find routes that avoid specified "No-Go Zones."**

### About The Project

**Detour** is a map-based tool designed for a unique purpose: to help you plan a journey from a starting point to a destination while actively avoiding one or more places along the way. Whether you're dodging a specific neighborhood, an old memory, or just a high-traffic area, Detour lets you define your "No-Go Zones" and visualizes a path that respects your boundaries.

This project was built as a proof-of-concept to demonstrate how multiple user-defined geographical inputs can be handled asynchronously and displayed on an interactive map.

### Features

* **Interactive Map**: Uses Leaflet.js with a sleek, dark theme from CartoDB.
* **Dynamic "No-Go Zones"**: Add or remove as many locations to avoid as you need. The UI updates instantly.
* **Address Geocoding**: Converts text-based addresses (e.g., "Kochi, Kerala") into map coordinates using the free Nominatim (OpenStreetMap) API.
* **Asynchronous API Calls**: Uses `Promise.all()` to efficiently fetch coordinates for all locations simultaneously, ensuring a fast user experience.
* **Visual Feedback**: Clearly marks the start point, destination, and all "No-Go Zones" on the map.
* **Responsive Sidebar**: The input form is housed in a sidebar that is designed to work alongside the map view.

### Built With

* **HTML5**: The structure of the web page.
* **CSS3**: Custom styling with a modern, dark-mode aesthetic using CSS Variables and Grid layout.
* **JavaScript (ES6+)**: Handles all the application logic, from DOM manipulation to API calls.
* [**Leaflet.js**](https://leafletjs.com/): An open-source JavaScript library for mobile-friendly interactive maps.
* [**Nominatim API**](https://nominatim.openstreetmap.org/): A free tool to search OpenStreetMap data by address and convert it to geographic coordinates.

