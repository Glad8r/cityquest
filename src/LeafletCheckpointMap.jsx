import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { userIcon, checkpointIcon } from './customIcons';
function CenterMap({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.setView(position, map.getZoom(), { animate: true });
    }
  }, [position, map]);
  return null;
}
import 'leaflet/dist/leaflet.css';

const RADIUS_MILES = 0.25;
const CHECKPOINTS = 10;

function getRandomClue() {
  const clues = [
    [
      "Look for the old clock tower, where time stands still and secrets linger in the shadows.",
      "Nearby, a mural tells the story of the city's founding. Can you find the hidden symbol?"
    ],
    [
      "A fountain bubbles in the heart of the square. Beneath its waters, legends are whispered.",
      "Follow the cobblestone path to a bench with a plaque. What does it commemorate?"
    ],
    [
      "The aroma of fresh bread leads you to a bakery. What is the name of the baker?",
      "Across the street, a blue door hides a secret. Knock and listen carefully."
    ],
    [
      "A statue of a famous explorer points the way. Where is he looking?",
      "Find the lamppost with a red ribbon tied around it. What does it mark?"
    ],
    [
      "A garden blooms behind iron gates. Which flower is most abundant?",
      "Listen for the chimes at noon. Where do they come from?"
    ],
    [
      "A bridge arches over a gentle stream. What is carved into its stone?",
      "Nearby, a tree stands alone. What makes it unique?"
    ],
    [
      "A painted window shows a scene from history. What year is depicted?",
      "Find the mailbox with a golden handle. Who does it belong to?"
    ],
    [
      "A hidden alley leads to a secret courtyard. What color are the tiles?",
      "Count the steps up to the library entrance. How many are there?"
    ],
    [
      "A bell tower rises above the rooftops. What animal is carved on its door?",
      "Look for the sign with a riddle. Can you solve it?"
    ],
    [
      "A weather vane spins atop a building. What shape does it take?",
      "Find the oldest tree in the park. What stories could it tell?"
    ],
  ];
  const idx = Math.floor(Math.random() * clues.length);
  return clues[idx].join(' ');
}

function getUniqueNames(count) {
  const names = [
    "Whispering Fountain",
    "Clocktower Square",
    "Hidden Courtyard",
    "Explorer's Statue",
    "Mural Lane",
    "Baker's Alley",
    "Chiming Garden",
    "Red Ribbon Post",
    "Blue Door Bend",
    "Golden Mailbox"
  ];
  // Shuffle names
  for (let i = names.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [names[i], names[j]] = [names[j], names[i]];
  }
  return names.slice(0, count);
}

function getRandomCheckpoints(lat, lng, count, radiusMiles) {
  const checkpoints = [];
  const radiusKm = radiusMiles * 1.60934;
  const uniqueNames = getUniqueNames(count);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * 2 * Math.PI;
    const distance = Math.random() * radiusKm;
    const dx = distance * Math.cos(angle);
    const dy = distance * Math.sin(angle);
    const earthRadius = 6371;
    const newLat = lat + (dy / earthRadius) * (180 / Math.PI);
    const newLng = lng + (dx / earthRadius) * (180 / Math.PI) / Math.cos(lat * Math.PI / 180);
    checkpoints.push({ lat: newLat, lng: newLng, clue: getRandomClue(), name: uniqueNames[i] });
  }
  return checkpoints;
}

export default function LeafletCheckpointMap() {
  const [location, setLocation] = useState(null);
  const [checkpoints, setCheckpoints] = useState([]);
  const [error, setError] = useState(null);
  const [center, setCenter] = useState(null);
  const [photos, setPhotos] = useState({}); // { idx: dataUrl }
  const [aiResults, setAiResults] = useState({}); // { idx: true/false }

  const fileInputs = useRef({});

  // Placeholder answer images
  const answerImages = [
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1465101046530-73398c7f28ca?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1465101178521-c1a9136a3c8b?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1465101046530-73398c7f28ca?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1465101178521-c1a9136a3c8b?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1465101046530-73398c7f28ca?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80',
  ];

async function compareImages(img1DataUrl, img2DataUrl) {
  try {
    const response = await fetch('http://192.168.0.5:5000/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ img1: img1DataUrl, img2: img2DataUrl })
    });
    if (!response.ok) {
      throw new Error('API error: ' + response.status + ' ' + response.statusText);
    }
    const result = await response.json();
    return result.similarity;
  } catch (err) {
    window.alert('Error: ' + err.message);
    return null;
  }
}

  function handlePhoto(idx, event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotos(prev => ({ ...prev, [idx]: e.target.result }));
        setAiResults(prev => ({ ...prev, [idx]: undefined })); // reset AI result
      };
      reader.readAsDataURL(file);
    }
  }

  function triggerFileInput(idx) {
    if (fileInputs.current[idx]) {
      fileInputs.current[idx].click();
    }
  }

  async function checkAnswer(idx) {
    const userPhoto = photos[idx];
    const answerPhoto = answerImages[idx % answerImages.length];
    const similarity = await compareImages(userPhoto, answerPhoto);
    if (similarity === null) return;
    const isCorrect = similarity > 0.5;
    setAiResults(prev => ({ ...prev, [idx]: isCorrect }));
    window.alert(isCorrect ? 'Correct!' : 'Incorrect!');
  }

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported');
      return;
    }
    let watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLocation((prev) => {
          // Only regenerate checkpoints on first location
          if (!prev) {
            setCheckpoints(getRandomCheckpoints(latitude, longitude, CHECKPOINTS, RADIUS_MILES));
          }
          return { lat: latitude, lng: longitude };
        });
      },
      (err) => setError('Unable to get location'),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    );
    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  return (
    <div style={{ width: '100%', maxWidth: 480, margin: '1em auto' }}>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      {!location && !error && <div>Loading map...</div>}
      {location && (
        <MapContainer center={center || [location.lat, location.lng]} zoom={15} style={{ height: '400px', width: '100%', borderRadius: '8px' }}>
          <CenterMap position={center || [location.lat, location.lng]} />
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />
          <Marker position={[location.lat, location.lng]} icon={userIcon}>
            <Popup>Your Location</Popup>
          </Marker>
          {checkpoints.map((cp, idx) => (
            <Marker key={idx} position={[cp.lat, cp.lng]} icon={checkpointIcon}>
              <Popup>
                <strong>Checkpoint {idx+1}</strong>
                <details style={{ marginTop: '0.5em' }}>
                  <summary>Show Clue</summary>
                  <div style={{ marginTop: '0.5em', fontSize: '0.95em' }}>{cp.clue}</div>
                </details>
                <div style={{ marginTop: '1em' }}>
                  <div style={{ display: 'block', marginBottom: '0.5em' }}>
                    <button style={{ padding: '0.5em 1em', borderRadius: 4 }} type="button" onClick={() => triggerFileInput(idx)}>
                      Take a picture
                    </button>
                    <input
                      ref={el => fileInputs.current[idx] = el}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      style={{ display: 'none' }}
                      onChange={e => handlePhoto(idx, e)}
                    />
                  </div>
                  {photos[idx] && (
                    <div style={{ marginTop: '0.5em' }}>
                      <div style={{ marginBottom: '0.5em' }}>
                        <img src={photos[idx]} alt={`Checkpoint ${idx+1} photo`} style={{ maxWidth: '100%', borderRadius: '8px' }} />
                      </div>
                      <div style={{ marginBottom: '0.5em' }}>
                        <strong>Answer Image:</strong>
                        <img src={answerImages[idx % answerImages.length]} alt={`Answer for checkpoint ${idx+1}`} style={{ maxWidth: '100%', borderRadius: '8px', marginTop: '0.5em' }} />
                      </div>
                      <button style={{ padding: '0.5em 1em', borderRadius: 4 }} type="button" onClick={() => checkAnswer(idx)}>
                        Check Answer
                      </button>
                      {aiResults[idx] !== undefined && (
                        <div style={{ marginTop: '0.5em', color: aiResults[idx] ? 'green' : 'red', fontWeight: 'bold' }}>
                          {aiResults[idx] ? 'Correct!' : 'Try again.'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      )}
      {location && checkpoints.length > 0 && (
        <div style={{ marginTop: '1em' }}>
          <h3>Checkpoints</h3>
          <ul style={{ background: '#f9f9f9', borderRadius: '8px', padding: '1em', listStyle: 'none', color: '#222', border: '1px solid #bbb' }}>
            {checkpoints.map((cp, idx) => (
              <li key={idx} style={{ marginBottom: '0.5em', color: '#222', background: '#fff', borderRadius: '4px', padding: '0.5em', border: '1px solid #ddd', cursor: 'pointer' }}
                  onClick={() => setCenter([cp.lat, cp.lng])}>
                <strong style={{ color: '#0057b7' }}>Checkpoint {idx+1}:</strong> {cp.name}
                <details style={{ marginTop: '0.5em' }}>
                  <summary>Show Clue</summary>
                  <div style={{ marginTop: '0.5em', fontSize: '0.95em' }}>{cp.clue}</div>
                </details>
                <div style={{ marginTop: '1em' }}>
                  <label style={{ display: 'block', marginBottom: '0.5em' }}>
                    <button style={{ padding: '0.5em 1em', borderRadius: 4 }}>
                      Take a picture
                    </button>
                    <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => handlePhoto(idx, e)} />
                  </label>
                  {photos[idx] && (
                    <div style={{ marginTop: '0.5em' }}>
                      <div style={{ marginBottom: '0.5em' }}>
                        <img src={photos[idx]} alt={`Checkpoint ${idx+1} photo`} style={{ maxWidth: '100%', borderRadius: '8px' }} />
                      </div>
                      <div style={{ marginBottom: '0.5em' }}>
                        <strong>Answer Image:</strong>
                        <img src={answerImages[idx % answerImages.length]} alt={`Answer for checkpoint ${idx+1}`} style={{ maxWidth: '100%', borderRadius: '8px', marginTop: '0.5em' }} />
                      </div>
                      <button style={{ padding: '0.5em 1em', borderRadius: 4 }} type="button" onClick={() => checkAnswer(idx)}>
                        Check Answer
                      </button>
                      {aiResults[idx] !== undefined && (
                        <div style={{ marginTop: '0.5em', color: aiResults[idx] ? 'green' : 'red', fontWeight: 'bold' }}>
                          {aiResults[idx] ? 'Correct!' : 'Try again.'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
