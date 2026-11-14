export function initMap(onSelect, onFarmSelect = () => {}) {
  const status = document.querySelector('#map-status');
  if (!window.L) {
    status.textContent = 'Map library unavailable. Enter coordinates below to continue.';
    return { setLocation() {}, setFarms() {}, highlightFarm() {}, clearFarms() {}, clearLocation() {} };
  }
  const L = window.L;
  const map = L.map('map', { worldCopyJump: true }).setView([12, 0], 2);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).on('tileerror', () => { status.textContent = 'Some map tiles could not load. You can still select or enter coordinates; NASA retrieval is independent.'; }).addTo(map);
  let marker;
  const support = L.layerGroup().addTo(map);
  const farms = L.layerGroup().addTo(map);
  const farmLayers = new Map();
  window.addEventListener('fieldshift:tabchange', () => map.invalidateSize({ animate: false }));
  map.on('click', event => {
    const longitude = ((event.latlng.lng + 180) % 360 + 360) % 360 - 180;
    onSelect(Number(Math.max(-90, Math.min(90, event.latlng.lat)).toFixed(5)), Number(longitude.toFixed(5)));
  });
  status.textContent = 'No location selected. Click the map or enter coordinates below. Keyboard users can use the coordinate fields.';
  return {
    clearLocation() {
      support.clearLayers();
      if (marker) { map.removeLayer(marker); marker = null; }
      status.textContent = 'No point selected. Choose a town, click the map or enter coordinates.';
    },
    clearFarms() { farms.clearLayers(); farmLayers.clear(); },
    setFarms(records) {
      farms.clearLayers(); farmLayers.clear();
      records.forEach(farm => {
        const layer = L.geoJSON(farm.geometry, { style: { color: '#9c6b20', weight: 2, fillOpacity: .18 } }).addTo(farms);
        const label = document.createElement('span'); label.textContent = farm.name;
        layer.bindTooltip(label).on('click', event => { L.DomEvent.stopPropagation(event); onFarmSelect(farm.id); });
        farmLayers.set(farm.id, layer);
      });
    },
    highlightFarm(id) {
      farmLayers.forEach((layer, key) => layer.setStyle({ color: key === id ? '#126d35' : '#9c6b20', weight: key === id ? 4 : 2, fillOpacity: key === id ? .3 : .15 }));
      const layer = farmLayers.get(id);
      if (layer) map.fitBounds(layer.getBounds().pad(.4), { maxZoom: 16, animate: false });
    },
    setLocation(latitude, longitude, pan = false) {
    support.clearLayers();
    if (marker) map.removeLayer(marker);
    marker = L.marker([latitude, longitude], { title: 'Selected coordinate' }).addTo(map);
    for (const [height, width, color] of [[1, 1, '#9c6b20'], [.5, .625, '#245a3a']]) {
      const west = longitude - width / 2, east = longitude + width / 2;
      const spans = west < -180 ? [[west + 360, 180], [-180, east]] : east > 180 ? [[west, 180], [-180, east - 360]] : [[west, east]];
      spans.forEach(([w, e]) => L.rectangle([[Math.max(-90, latitude - height / 2), w], [Math.min(90, latitude + height / 2), e]],
        { color, weight: 2, fillOpacity: .08, interactive: false }).addTo(support));
    }
    if (pan) map.setView([Math.max(-85, Math.min(85, latitude)), longitude], 14, { animate: false });
    status.textContent = `Selected ${latitude}°, ${longitude}°. Weather rectangles show regional support; field outlines are separate OpenStreetMap records.`;
  } };
}
