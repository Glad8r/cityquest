import React, { useState } from 'react';
import { SERVER_URL } from './config.js';

const QuestDesigner = ({ onClose }) => {
  const [questTitle, setQuestTitle] = useState('');
  const [questDescription, setQuestDescription] = useState('');
  const [difficulty, setDifficulty] = useState('Medium');
  const [ageGroup, setAgeGroup] = useState('All Ages');
  const [distance, setDistance] = useState('Walk');
  const [waypoints, setWaypoints] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');

  const addWaypoint = () => {
    const newWaypoint = {
      id: waypoints.length + 1,
      name: '',
      clue: '',
      funFact: '',
      photos: [null, null, null, null], // Initialize with 4 null values for 4 photo slots
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
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy
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
      const maxAttempts = 10;
      let bestPosition = null;
      let timeoutId;
      let watchId;

      const successCallback = (position) => {
        attempts++;
        console.log(`GPS attempt ${attempts}: accuracy ${position.coords.accuracy}m`);
        
        // Update best position if this one is better
        if (!bestPosition || position.coords.accuracy < bestPosition.coords.accuracy) {
          bestPosition = position;
        }
        
        // If we get good accuracy (≤ 5m), resolve immediately
        if (position.coords.accuracy <= 5) {
          clearTimeout(timeoutId);
          if (watchId) navigator.geolocation.clearWatch(watchId);
          resolve(position);
          return;
        }
        
        // If we've tried enough times, resolve with best position
        if (attempts >= maxAttempts) {
          clearTimeout(timeoutId);
          if (watchId) navigator.geolocation.clearWatch(watchId);
          resolve(bestPosition || position);
        }
      };

      const errorCallback = (error) => {
        console.error('GPS error:', error);
        attempts++;
        
        // If we've tried enough times, resolve with best position or reject
        if (attempts >= maxAttempts) {
          clearTimeout(timeoutId);
          if (watchId) navigator.geolocation.clearWatch(watchId);
          if (bestPosition) {
            resolve(bestPosition);
          } else {
            reject(error);
          }
        }
      };

      const options = {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 0
      };

      // Start watching position
      watchId = navigator.geolocation.watchPosition(successCallback, errorCallback, options);
      
      // Overall timeout (30 seconds)
      timeoutId = setTimeout(() => {
        if (watchId) navigator.geolocation.clearWatch(watchId);
        if (bestPosition) {
          resolve(bestPosition);
        } else {
          reject(new Error('GPS timeout after 30 seconds'));
        }
      }, 30000);
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
    const trimmedTitle = questTitle.trim();
    if (!trimmedTitle) {
      alert('Please enter a quest title');
      return false;
    }
    
    if (trimmedTitle.length < 3) {
      alert('Quest title must be at least 3 characters long');
      return false;
    }
    
    if (trimmedTitle.length > 100) {
      alert('Quest title must be less than 100 characters');
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
               // Prepare quest data
        const questData = {
          name: questTitle.trim(),
          description: questDescription || `Quest created on ${new Date().toLocaleDateString()}`,
          difficulty: difficulty,
          ageGroup: ageGroup,
          distance: distance,
          rating: 0,
          enabled: true,
          checkpoints: waypoints.map(wp => ({
            id: wp.id,
            name: wp.name || `Waypoint ${wp.id}`,
            clue: wp.clue || `Find waypoint ${wp.id}`,
            funFact: wp.funFact || '',
            lat: wp.coordinates.lat,
            lng: wp.coordinates.lng
          })),
          leaderboard: {
            entries: [],
            stats: {
              total_completions: 0,
              average_time: 0,
              best_time: null,
              last_updated: null
            },
            ratings: []
          }
        };

       // Prepare photos data
       const photosData = {};
       waypoints.forEach((wp, wpIndex) => {
         photosData[wpIndex] = {};
         wp.photos.forEach((photo, photoIndex) => {
           if (photo && photo.dataUrl) {
             photosData[wpIndex][photoIndex] = {
               data: photo.dataUrl
             };
           }
         });
       });

       const requestData = {
         questData: questData,
         zipData: {
           photos: photosData
         }
       };

       const response = await fetch(`${SERVER_URL}/api/submit-quest`, {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
           'ngrok-skip-browser-warning': 'true'
         },
         body: JSON.stringify(requestData)
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
       zIndex: 1000
     }}>
             <div style={{
         background: '#1a365d',
         padding: '2em',
         paddingTop: '4em',
         paddingBottom: '4em',
         height: '100vh',
         overflow: 'auto',
         border: 'none',
         width: '100%',
         boxSizing: 'border-box'
       }}>
        <div style={{ marginBottom: '1em' }}>
          <h1 style={{ color: 'white', margin: 0 }}>Quest Designer</h1>
        </div>

        <div style={{ marginBottom: '1.5em' }}>
          <label style={{ color: 'white', display: 'block', marginBottom: '0.5em' }}>
            Quest Title: <span style={{ color: '#e53e3e' }}>*</span>
          </label>
          <input
            type="text"
            value={questTitle}
            onChange={(e) => setQuestTitle(e.target.value)}
            required
            minLength="3"
            maxLength="100"
                         style={{
               width: '100%',
               padding: '0.75em',
               borderRadius: '6px',
               border: '1px solid #4a5568',
               backgroundColor: '#2d3748',
               color: 'white',
               fontSize: '1em',
               boxSizing: 'border-box'
             }}
            placeholder="Enter quest title (required)"
          />
        </div>

                 <div style={{ marginBottom: '1.5em' }}>
           <label style={{ color: 'white', display: 'block', marginBottom: '0.5em' }}>
             Quest Description:
           </label>
           <textarea
             value={questDescription}
             onChange={(e) => setQuestDescription(e.target.value)}
                          style={{
                width: '100%',
                padding: '0.75em',
                borderRadius: '6px',
                border: '1px solid #4a5568',
                backgroundColor: '#2d3748',
                color: 'white',
                fontSize: '1em',
                minHeight: '80px',
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
             placeholder="Enter quest description"
           />
         </div>

         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1em', marginBottom: '1.5em' }}>
           <div>
             <label style={{ color: 'white', display: 'block', marginBottom: '0.5em' }}>
               Difficulty:
             </label>
             <select
               value={difficulty}
               onChange={(e) => setDifficulty(e.target.value)}
               style={{
                 width: '100%',
                 padding: '0.75em',
                 borderRadius: '6px',
                 border: '1px solid #4a5568',
                 backgroundColor: '#2d3748',
                 color: 'white',
                 fontSize: '1em',
                 boxSizing: 'border-box'
               }}
             >
               <option value="Easy">Easy</option>
               <option value="Medium">Medium</option>
               <option value="Hard">Hard</option>
             </select>
           </div>

           <div>
             <label style={{ color: 'white', display: 'block', marginBottom: '0.5em' }}>
               Age Group:
             </label>
             <select
               value={ageGroup}
               onChange={(e) => setAgeGroup(e.target.value)}
               style={{
                 width: '100%',
                 padding: '0.75em',
                 borderRadius: '6px',
                 border: '1px solid #4a5568',
                 backgroundColor: '#2d3748',
                 color: 'white',
                 fontSize: '1em',
                 boxSizing: 'border-box'
               }}
             >
               <option value="Kids">Kids</option>
               <option value="Teens">Teens</option>
               <option value="Families">Families</option>
               <option value="All Ages">All Ages</option>
               <option value="Adults">Adults</option>
             </select>
           </div>

           <div>
             <label style={{ color: 'white', display: 'block', marginBottom: '0.5em' }}>
               Distance:
             </label>
             <select
               value={distance}
               onChange={(e) => setDistance(e.target.value)}
               style={{
                 width: '100%',
                 padding: '0.75em',
                 borderRadius: '6px',
                 border: '1px solid #4a5568',
                 backgroundColor: '#2d3748',
                 color: 'white',
                 fontSize: '1em',
                 boxSizing: 'border-box'
               }}
             >
               <option value="Walk">Walk</option>
               <option value="Drive">Drive</option>
             </select>
           </div>
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
               <div style={{ display: 'flex', alignItems: 'center' }}>
                 <button
                   onClick={() => toggleWaypointExpansion(index)}
                   style={{
                     background: 'none',
                     border: 'none',
                     color: 'white',
                     cursor: 'pointer',
                     marginRight: '0.5em',
                     fontSize: '0.8em',
                     transform: waypoint.isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                     transition: 'transform 0.2s ease'
                   }}
                 >
                   ▶
                 </button>
                 <h3 style={{ color: 'white', margin: 0 }}>Waypoint {waypoint.id}</h3>
               </div>
               <div>
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
                       color: 'white',
                       fontSize: '16px',
                       boxSizing: 'border-box'
                     }}
                    placeholder="Enter waypoint name"
                  />
                </div>

                <div style={{ marginBottom: '1em' }}>
                  <label style={{ color: 'white', display: 'block', marginBottom: '0.5em' }}>
                    Clue (optional):
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
                       fontSize: '16px',
                       minHeight: '60px',
                       resize: 'vertical',
                       boxSizing: 'border-box'
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
                       fontSize: '16px',
                       minHeight: '60px',
                       resize: 'vertical',
                       boxSizing: 'border-box'
                     }}
                     placeholder="Enter fun fact"
                   />
                </div>

                                 <div style={{ marginBottom: '1em' }}>
                   <label style={{ color: 'white', display: 'block', marginBottom: '0.5em' }}>
                     Photos (max 4):
                   </label>
                                       <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5em', justifyContent: 'center' }}>
                      {[0, 1, 2, 3].map((photoIndex) => (
                        <div key={photoIndex} style={{ width: '150px', height: '150px', flexShrink: 0 }}>
                          {waypoint.photos[photoIndex] ? (
                            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                              <img
                                src={waypoint.photos[photoIndex].dataUrl}
                                alt={`Photo ${photoIndex + 1}`}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                  borderRadius: '4px',
                                  display: 'block'
                                }}
                              />
                             <button
                               onClick={() => removePhoto(index, photoIndex)}
                               style={{
                                 position: 'absolute',
                                 top: '-6px',
                                 right: '-6px',
                                 background: '#e53e3e',
                                 border: 'none',
                                 color: 'white',
                                 cursor: 'pointer',
                                 width: '20px',
                                 height: '20px',
                                 borderRadius: '50%',
                                 fontSize: '12px',
                                 fontWeight: 'bold',
                                 display: 'flex',
                                 alignItems: 'center',
                                 justifyContent: 'center',
                                 boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                                 outline: 'none'
                               }}
                             >
                               ×
                             </button>
                           </div>
                                                   ) : (
                            <label style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '0.5em',
                              border: '2px dashed #4a5568',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              color: '#a0aec0',
                              height: '100%',
                              width: '100%',
                              boxSizing: 'border-box'
                            }}>
                             <input
                               type="file"
                               accept="image/*"
                               onChange={(e) => handlePhotoUpload(index, photoIndex, e)}
                               style={{ display: 'none' }}
                             />
                             <div style={{ fontSize: '1.2em', marginBottom: '0.25em' }}>📷</div>
                             <div style={{ fontSize: '0.7em' }}>Photo {photoIndex + 1}</div>
                           </label>
                         )}
                       </div>
                     ))}
                   </div>
                 </div>

                <div style={{ marginBottom: '1em' }}>
                  <div style={{ display: 'flex', gap: '0.5em', alignItems: 'center' }}>
                                         <button
                       onClick={() => saveCoordinates(index)}
                       disabled={typeof waypoint.coordinates === 'string' && waypoint.coordinates === 'Getting GPS...'}
                       style={{
                         padding: '0.75em 1.5em',
                         borderRadius: '6px',
                         backgroundColor: typeof waypoint.coordinates === 'string' && waypoint.coordinates === 'Getting GPS...' ? '#4a5568' : 
                                        waypoint.coordinates && typeof waypoint.coordinates === 'object' ? '#68d391' : '#4299e1',
                         color: 'white',
                         border: 'none',
                         cursor: typeof waypoint.coordinates === 'string' && waypoint.coordinates === 'Getting GPS...' ? 'not-allowed' : 'pointer',
                         fontSize: '1em',
                         fontWeight: 'bold',
                         flex: 1
                       }}
                     >
                                               {typeof waypoint.coordinates === 'string' ? waypoint.coordinates : 
                         waypoint.coordinates ? '✓ Location Saved' : '📍 Save Location'}
                     </button>
                    {waypoint.coordinates && typeof waypoint.coordinates === 'object' && (
                      <button
                        onClick={() => saveCoordinates(index)}
                        style={{
                          padding: '0.75em 1em',
                          borderRadius: '6px',
                          backgroundColor: '#f6ad55',
                          color: 'white',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '0.9em'
                        }}
                      >
                        🔄 Retake
                      </button>
                    )}
                  </div>
                  {waypoint.coordinates && typeof waypoint.coordinates === 'object' && (
                    <div style={{ color: '#a0aec0', fontSize: '0.9em', marginTop: '0.5em' }}>
                      <div>📍 Lat: {waypoint.coordinates.lat.toFixed(6)}</div>
                      <div>📍 Lng: {waypoint.coordinates.lng.toFixed(6)}</div>
                      <div>🎯 Accuracy: {waypoint.coordinates.accuracy ? `${waypoint.coordinates.accuracy.toFixed(1)}m` : 'Unknown'}</div>
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

export default QuestDesigner;
