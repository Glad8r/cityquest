import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

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

export default function LeafletCheckpointMap() {
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
    <div style={{ width: '100%', maxWidth: 480, margin: '1em auto' }}>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      {!location && !error && <div>Loading map...</div>}
      {location && (
        <MapContainer center={[location.lat, location.lng]} zoom={15} style={{ height: '400px', width: '100%', borderRadius: '8px' }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />
          <Marker position={[location.lat, location.lng]}>
            <Popup>Your Location</Popup>
          </Marker>
          {checkpoints.map((cp, idx) => (
            <Marker key={idx} position={[cp.lat, cp.lng]}>
              <Popup>Checkpoint {idx+1}</Popup>
            </Marker>
          ))}
        </MapContainer>
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
