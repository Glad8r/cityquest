import { useEffect, useState } from 'react';

const RADIUS_MILES = 0.25;
const CHECKPOINTS = 10;

function getRandomCheckpoints(lat, lng, count, radiusMiles) {
  const checkpoints = [];
  const radiusKm = radiusMiles * 1.60934;
  for (let i = 0; i < count; i++) {
    // Random angle and distance
    const angle = Math.random() * 2 * Math.PI;
    const distance = Math.random() * radiusKm;
    // Offset in km
    const dx = distance * Math.cos(angle);
    const dy = distance * Math.sin(angle);
    // Earth's radius in km
    const earthRadius = 6371;
    // Offset in degrees
    const newLat = lat + (dy / earthRadius) * (180 / Math.PI);
    const newLng = lng + (dx / earthRadius) * (180 / Math.PI) / Math.cos(lat * Math.PI / 180);
    checkpoints.push({ lat: newLat, lng: newLng });
  }
  return checkpoints;
}

export default function MapView() {
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

  return (
    <div style={{ width: '100%', height: '400px', position: 'relative', margin: '1em 0' }}>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      {!location && !error && <div>Loading map...</div>}
      {location && (
        <iframe
          title="Map"
          width="100%"
          height="400"
          style={{ border: 0 }}
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${location.lng-0.005},${location.lat-0.005},${location.lng+0.005},${location.lat+0.005}&layer=mapnik&marker=${location.lat},${location.lng}`}
          allowFullScreen
        ></iframe>
      )}
      {location && checkpoints.length > 0 && (
        <ul style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(255,255,255,0.8)', padding: '0.5em', borderRadius: '8px', listStyle: 'none' }}>
          <li><strong>Your Location:</strong> {location.lat.toFixed(5)}, {location.lng.toFixed(5)}</li>
          {checkpoints.map((cp, idx) => (
            <li key={idx}>Checkpoint {idx+1}: {cp.lat.toFixed(5)}, {cp.lng.toFixed(5)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
