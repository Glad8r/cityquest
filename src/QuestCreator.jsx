import React, { useState } from 'react';
import { SERVER_URL } from './config.js';

const QuestCreator = ({ onClose }) => {
  const [questTitle, setQuestTitle] = useState('');
  const [waypoints, setWaypoints] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');

  const addWaypoint = () => {
    const newWaypoint = {
      id: waypoints.length + 1,
      name: '',
      clue: '',
      funFact: '',
      photos: [],
      coordinates: null,
      isExpanded: true
    };
    setWaypoints([...waypoints, newWaypoint]);
  };

  const removeWaypoint = (index) => {
    if (window.confirm('Are you sure you want to remove this waypoint?')) {
      const updatedWaypoints = waypoints.filter((_, i) => i !== index);
      // Reassign IDs
      updatedWaypoints.forEach((wp, i) => {
        wp.id = i + 1;
      });
      setWaypoints(updatedWaypoints);
    }
  };

  const updateWaypoint = (index, field, value) => {
    const updatedWaypoints = [...waypoints];
    updatedWaypoints[index] = { ...updatedWaypoints[index], [field]: value };
    setWaypoints(updatedWaypoints);
  };

  const toggleWaypointExpansion = (index) => {
    const updatedWaypoints = [...waypoints];
    updatedWaypoints[index] = { ...updatedWaypoints[index], isExpanded: !updatedWaypoints[index].isExpanded };
    setWaypoints(updatedWaypoints);
  };

  const saveCoordinates = async (index) => {
    const waypoint = waypoints[index];
    updateWaypoint(index, 'coordinates', 'Getting GPS...');

    try {
      const position = await getCurrentPosition();
      const coords = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      updateWaypoint(index, 'coordinates', coords);
    } catch (error) {
      console.error('Error getting GPS coordinates:', error);
      updateWaypoint(index, 'coordinates', 'Failed to get GPS');
    }
  };

  const getCurrentPosition = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported'));
        return;
      }

      let attempts = 0;
      const maxAttempts = 3;
      let bestPosition = null;
      let timeoutId;

      const successCallback = (position) => {
        attempts++;
        console.log(`GPS attempt ${attempts}: accuracy ${position.coords.accuracy}m`);
        
        if (position.coords.accuracy <= 10) {
          // Good accuracy, resolve immediately
          clearTimeout(timeoutId);
          resolve(position);
          return;
        }
        
        if (!bestPosition || position.coords.accuracy < bestPosition.coords.accuracy) {
          bestPosition = position;
        }
        
        if (attempts >= maxAttempts) {
          clearTimeout(timeoutId);
          resolve(bestPosition || position);
        }
      };

      const errorCallback = (error) => {
        console.error('GPS error:', error);
        clearTimeout(timeoutId);
        reject(error);
      };

      const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      };

      // Start watching position
      const watchId = navigator.geolocation.watchPosition(successCallback, errorCallback, options);
      
      // Overall timeout
      timeoutId = setTimeout(() => {
        navigator.geolocation.clearWatch(watchId);
        if (bestPosition) {
          resolve(bestPosition);
        } else {
          reject(new Error('GPS timeout'));
        }
      }, 15000);
    });
  };

  const handlePhotoUpload = (waypointIndex, photoIndex, event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const updatedWaypoints = [...waypoints];
        updatedWaypoints[waypointIndex].photos[photoIndex] = {
          file: file,
          dataUrl: e.target.result
        };
        setWaypoints(updatedWaypoints);
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = (waypointIndex, photoIndex) => {
    const updatedWaypoints = [...waypoints];
    updatedWaypoints[waypointIndex].photos[photoIndex] = null;
    setWaypoints(updatedWaypoints);
  };

  const validateQuest = () => {
    if (!questTitle.trim()) {
      alert('Please enter a quest title');
      return false;
    }

    if (waypoints.length === 0) {
      alert('Please add at least one waypoint');
      return false;
    }

    for (let i = 0; i < waypoints.length; i++) {
      const wp = waypoints[i];
      if (!wp.coordinates || typeof wp.coordinates === 'string') {
        alert(`Waypoint ${i + 1}: Please save GPS coordinates`);
        return false;
      }
      if (wp.photos.filter(p => p !== null).length === 0) {
        alert(`Waypoint ${i + 1}: Please add at least one photo`);
        return false;
      }
    }

    return true;
  };

  const submitQuest = async () => {
    if (!validateQuest()) return;

    setIsSubmitting(true);
    setSubmitMessage('Creating quest...');

    try {
      const formData = new FormData();
      formData.append('questData', JSON.stringify({
        name: questTitle,
        description: `Quest created on ${new Date().toLocaleDateString()}`,
        checkpoints: waypoints.map(wp => ({
          id: wp.id,
          name: wp.name || `Waypoint ${wp.id}`,
          clue: wp.clue || `Find waypoint ${wp.id}`,
          funFact: wp.funFact || '',
          lat: wp.coordinates.lat,
          lng: wp.coordinates.lng
        }))
      }));

      // Add photos to form data
      waypoints.forEach((wp, wpIndex) => {
        wp.photos.forEach((photo, photoIndex) => {
          if (photo && photo.file) {
            formData.append('photos', photo.file, `waypoint_${wpIndex + 1}_photo_${photoIndex + 1}.jpg`);
          }
        });
      });

      const response = await fetch(`${SERVER_URL}/api/submit-quest`, {
        method: 'POST',
        headers: {
          'ngrok-skip-browser-warning': 'true'
        },
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        setSubmitMessage(`Quest created successfully! Quest ID: ${result.quest_id}`);
        setTimeout(() => {
          onClose();
        }, 3000);
      } else {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        setSubmitMessage('Error creating quest. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting quest:', error);
      setSubmitMessage('Error creating quest. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        background: '#1a365d',
        padding: '2em',
        borderRadius: '12px',
        maxWidth: '95%',
        maxHeight: '90vh',
        overflow: 'auto',
        border: 'none',
        minWidth: '300px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1em' }}>
          <h1 style={{ color: 'white', margin: 0 }}>Quest Creator</h1>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              fontSize: '1.5em',
              cursor: 'pointer',
              padding: '0.5em'
            }}
          >
            ×
          </button>
        </div>

        <div style={{ marginBottom: '1.5em' }}>
          <label style={{ color: 'white', display: 'block', marginBottom: '0.5em' }}>
            Quest Title:
          </label>
          <input
            type="text"
            value={questTitle}
            onChange={(e) => setQuestTitle(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75em',
              borderRadius: '6px',
              border: '1px solid #4a5568',
              backgroundColor: '#2d3748',
              color: 'white',
              fontSize: '1em'
            }}
            placeholder="Enter quest title"
          />
        </div>

        <div style={{ marginBottom: '1.5em' }}>
          <button
            onClick={addWaypoint}
            style={{
              padding: '0.75em 1.5em',
              borderRadius: '6px',
              backgroundColor: '#68d391',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1em',
              fontWeight: 'bold'
            }}
          >
            + Add a waypoint
          </button>
        </div>

        {waypoints.map((waypoint, index) => (
          <div key={index} style={{
            border: '1px solid #4a5568',
            borderRadius: '8px',
            padding: '1em',
            marginBottom: '1em',
            backgroundColor: '#2d3748'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1em' }}>
              <h3 style={{ color: 'white', margin: 0 }}>Waypoint {waypoint.id}</h3>
              <div>
                <button
                  onClick={() => toggleWaypointExpansion(index)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'white',
                    cursor: 'pointer',
                    marginRight: '0.5em'
                  }}
                >
                  {waypoint.isExpanded ? '−' : '+'}
                </button>
                <button
                  onClick={() => removeWaypoint(index)}
                  style={{
                    background: '#e53e3e',
                    border: 'none',
                    color: 'white',
                    cursor: 'pointer',
                    padding: '0.25em 0.5em',
                    borderRadius: '4px',
                    fontSize: '0.8em'
                  }}
                >
                  Remove
                </button>
              </div>
            </div>

            {waypoint.isExpanded && (
              <div>
                <div style={{ marginBottom: '1em' }}>
                  <label style={{ color: 'white', display: 'block', marginBottom: '0.5em' }}>
                    Waypoint Name (optional):
                  </label>
                  <input
                    type="text"
                    value={waypoint.name}
                    onChange={(e) => updateWaypoint(index, 'name', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5em',
                      borderRadius: '4px',
                      border: '1px solid #4a5568',
                      backgroundColor: '#2d3748',
                      color: 'white'
                    }}
                    placeholder="Enter waypoint name"
                  />
                </div>

                <div style={{ marginBottom: '1em' }}>
                  <label style={{ color: 'white', display: 'block', marginBottom: '0.5em' }}>
                    Clue Text Field (optional):
                  </label>
                  <textarea
                    value={waypoint.clue}
                    onChange={(e) => updateWaypoint(index, 'clue', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5em',
                      borderRadius: '4px',
                      border: '1px solid #4a5568',
                      backgroundColor: '#2d3748',
                      color: 'white',
                      minHeight: '60px',
                      resize: 'vertical'
                    }}
                    placeholder="Enter clue text"
                  />
                </div>

                <div style={{ marginBottom: '1em' }}>
                  <label style={{ color: 'white', display: 'block', marginBottom: '0.5em' }}>
                    Fun Fact (optional):
                  </label>
                  <textarea
                    value={waypoint.funFact}
                    onChange={(e) => updateWaypoint(index, 'funFact', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5em',
                      borderRadius: '4px',
                      border: '1px solid #4a5568',
                      backgroundColor: '#2d3748',
                      color: 'white',
                      minHeight: '60px',
                      resize: 'vertical'
                    }}
                    placeholder="Enter fun fact"
                  />
                </div>

                <div style={{ marginBottom: '1em' }}>
                  <label style={{ color: 'white', display: 'block', marginBottom: '0.5em' }}>
                    Photos (max 4):
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5em' }}>
                    {[0, 1, 2, 3].map((photoIndex) => (
                      <div key={photoIndex} style={{ textAlign: 'center' }}>
                        {waypoint.photos[photoIndex] ? (
                          <div>
                            <img
                              src={waypoint.photos[photoIndex].dataUrl}
                              alt={`Photo ${photoIndex + 1}`}
                              style={{
                                width: '100%',
                                height: '80px',
                                objectFit: 'cover',
                                borderRadius: '4px',
                                marginBottom: '0.5em'
                              }}
                            />
                            <button
                              onClick={() => removePhoto(index, photoIndex)}
                              style={{
                                background: '#e53e3e',
                                border: 'none',
                                color: 'white',
                                cursor: 'pointer',
                                padding: '0.25em 0.5em',
                                borderRadius: '4px',
                                fontSize: '0.8em'
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <label style={{
                            display: 'block',
                            padding: '1em',
                            border: '2px dashed #4a5568',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            color: '#a0aec0'
                          }}>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handlePhotoUpload(index, photoIndex, e)}
                              style={{ display: 'none' }}
                            />
                            + Photo {photoIndex + 1}
                          </label>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: '1em' }}>
                  <button
                    onClick={() => saveCoordinates(index)}
                    disabled={typeof waypoint.coordinates === 'string' && waypoint.coordinates === 'Getting GPS...'}
                    style={{
                      padding: '0.75em 1.5em',
                      borderRadius: '6px',
                      backgroundColor: waypoint.coordinates && typeof waypoint.coordinates === 'object' ? '#68d391' : '#4a5568',
                      color: 'white',
                      border: 'none',
                      cursor: waypoint.coordinates && typeof waypoint.coordinates === 'object' ? 'pointer' : 'not-allowed',
                      fontSize: '1em',
                      fontWeight: 'bold'
                    }}
                  >
                    {typeof waypoint.coordinates === 'string' ? waypoint.coordinates : 
                     waypoint.coordinates ? '✓ Coordinates Saved' : '+ Save Coordinates'}
                  </button>
                  {waypoint.coordinates && typeof waypoint.coordinates === 'object' && (
                    <div style={{ color: '#a0aec0', fontSize: '0.9em', marginTop: '0.5em' }}>
                      Lat: {waypoint.coordinates.lat.toFixed(6)}, Lng: {waypoint.coordinates.lng.toFixed(6)}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {submitMessage && (
          <div style={{
            padding: '1em',
            borderRadius: '6px',
            backgroundColor: submitMessage.includes('Error') ? '#fed7d7' : '#c6f6d5',
            color: submitMessage.includes('Error') ? '#c53030' : '#22543d',
            marginBottom: '1em'
          }}>
            {submitMessage}
          </div>
        )}

        <div style={{ display: 'flex', gap: '1em', justifyContent: 'center' }}>
          <button
            onClick={submitQuest}
            disabled={isSubmitting || waypoints.length === 0}
            style={{
              padding: '0.75em 1.5em',
              borderRadius: '6px',
              backgroundColor: waypoints.length > 0 ? '#68d391' : '#4a5568',
              color: 'white',
              border: 'none',
              cursor: waypoints.length > 0 ? 'pointer' : 'not-allowed',
              fontSize: '1em',
              fontWeight: 'bold'
            }}
          >
            {isSubmitting ? 'Creating Quest...' : 'Submit'}
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '0.75em 1.5em',
              borderRadius: '6px',
              backgroundColor: '#4a5568',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1em'
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuestCreator;
