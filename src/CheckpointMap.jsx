import { useEffect, useState } from 'react';

const RADIUS_MILES = 0.25;
const CHECKPOINTS = 10;

function getRandomCheckpoints(lat, lng, count, radiusMiles) {
  const checkpoints = [];
  const radiusKm = radiusMiles * 1.60934;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * 2 * Math.PI;
    const distance = Math.random() * radiusKm;
    const dx = distance * Math.cos(angle);
    const dy = distance * Math.sin(angle);
    const earthRadius = 6371;
    const newLat = lat + (dy / earthRadius) * (180 / Math.PI);
    const newLng = lng + (dx / earthRadius) * (180 / Math.PI) / Math.cos(lat * Math.PI / 180);
    checkpoints.push({ lat: newLat, lng: newLng });
  }
  return checkpoints;
}

export default function CheckpointMap() {
  const [location, setLocation] = useState(null);
  const [checkpoints, setCheckpoints] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLocation({ lat: latitude, lng: longitude });
        setCheckpoints(getRandomCheckpoints(latitude, longitude, CHECKPOINTS, RADIUS_MILES));
      },
      (err) => setError('Unable to get location')
    );
  }, []);

  // Build the OpenStreetMap static map URL with pins
  function getMapUrl() {
    if (!location) return '';
    const base = 'https://www.openstreetmap.org/export/embed.html';
    const bbox = `${location.lng-0.005},${location.lat-0.005},${location.lng+0.005},${location.lat+0.005}`;
    // Marker for user location
    let markers = `&marker=${location.lat},${location.lng}`;
    // Add checkpoint pins
    checkpoints.forEach(cp => {
      markers += `&marker=${cp.lat},${cp.lng}`;
    });
    return `${base}?bbox=${bbox}&layer=mapnik${markers}`;
  }

  return (
    <div style={{ width: '100%', maxWidth: 480, margin: '1em auto' }}>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      {!location && !error && <div>Loading map...</div>}
      {location && (
        <iframe
          title="Map"
          width="100%"
          height="400"
          style={{ border: 0, borderRadius: '8px' }}
          src={getMapUrl()}
          allowFullScreen
        ></iframe>
      )}
      {location && checkpoints.length > 0 && (
        <div style={{ marginTop: '1em' }}>
          <h3>Checkpoints</h3>
          <ul style={{ background: '#f9f9f9', borderRadius: '8px', padding: '1em', listStyle: 'none', color: '#222', border: '1px solid #bbb' }}>
            {checkpoints.map((cp, idx) => (
              <li key={idx} style={{ marginBottom: '0.5em', color: '#222', background: '#fff', borderRadius: '4px', padding: '0.5em', border: '1px solid #ddd' }}>
                <strong style={{ color: '#0057b7' }}>Checkpoint {idx+1}:</strong> {cp.lat.toFixed(5)}, {cp.lng.toFixed(5)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
