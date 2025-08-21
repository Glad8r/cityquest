import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { userIcon, checkpointIcon, createCompassIcon } from './customIcons';
import { SERVER_URL } from './config';
import expandIcon from './assets/expand.png';
import OdysseusLogo from './assets/Odysseus.png';


function CenterMap({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.setView(position, map.getZoom(), { animate: true });
    }
  }, [position, map]);
  return null;
}

// Component to handle map clicks for popup toggle
function MapClickHandler({ isMapFullscreen, setIsMapFullscreen, isMapPopupOpen, setIsMapPopupOpen }) {
  const map = useMap();
  
  useEffect(() => {
    const handleMapClick = (e) => {
      // Only handle clicks if not already fullscreen or popup open
      if (!isMapFullscreen && !isMapPopupOpen) {
        setIsMapPopupOpen(true);
      }
    };

    map.on('click', handleMapClick);
    
    return () => {
      map.off('click', handleMapClick);
    };
  }, [map, isMapFullscreen, isMapPopupOpen, setIsMapFullscreen, setIsMapPopupOpen]);
  
  return null;
}
import 'leaflet/dist/leaflet.css';

const RADIUS_MILES = 0.25;
const CHECKPOINTS = 10;

function getRandomClue() {
  const clues = [
    [
      "Seek the giant painted blue, it will make a drink for you.", 
      "Though it stands and makes no sound, H2O here is always found."
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
    if (i == 0) {
      const blue = "Seek the giant painted blue, it will make a drink for you. Though it stands and makes no sound, H2O here is always found."
      checkpoints.push({ lat: 45.475194, lng: -122.855602, clue: blue, name: "Blue Giant" });
    }else {
      const angle = Math.random() * 2 * Math.PI;
      const distance = Math.random() * radiusKm;
      const dx = distance * Math.cos(angle);
      const dy = distance * Math.sin(angle);
      const earthRadius = 6371;
      const newLat = lat + (dy / earthRadius) * (180 / Math.PI);
      const newLng = lng + (dx / earthRadius) * (180 / Math.PI) / Math.cos(lat * Math.PI / 180);
      checkpoints.push({ lat: newLat, lng: newLng, clue: getRandomClue(), name: uniqueNames[i] });
    }
  }
  return checkpoints;
}

export default function LeafletCheckpointMap({ quest, onQuestComplete, questStartTime, setQuestEndTime, teamName, questProgress, updateQuestProgress }) {
  const [location, setLocation] = useState(null);
  const [heading, setHeading] = useState(0);
  const [checkpoints, setCheckpoints] = useState([]);
  const [error, setError] = useState(null);
  const [center, setCenter] = useState(null);
  const [photos, setPhotos] = useState(questProgress?.photos || {}); // { idx: dataUrl }
  const [aiResults, setAiResults] = useState(questProgress?.aiResults || {}); // { idx: true/false }
  const [currentCheckpointIndex, setCurrentCheckpointIndex] = useState(0);
  const [completedCheckpoints, setCompletedCheckpoints] = useState(questProgress?.completedCheckpoints || new Set());
  const [isCheckingAnswer, setIsCheckingAnswer] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [logEntries, setLogEntries] = useState([]); // Array to store log entries
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState('success'); // 'success' or 'error'
  const [completionLogged, setCompletionLogged] = useState(false); // Flag to prevent duplicate completion logs
  const [lastInRangeState, setLastInRangeState] = useState(false); // Track previous in-range state for haptic feedback
  const [skippedCheckpoints, setSkippedCheckpoints] = useState(questProgress?.skippedCheckpoints || new Set()); // Track skipped waypoints
  const [skipsUsed, setSkipsUsed] = useState(questProgress?.skipsUsed || 0); // Track number of skips used
  const [showSkipConfirmation, setShowSkipConfirmation] = useState(false); // Show skip confirmation dialog
  const [showEarlyCompletionConfirmation, setShowEarlyCompletionConfirmation] = useState(false); // Show early completion confirmation
  const [userHasInteracted, setUserHasInteracted] = useState(false); // Track if user has interacted (required for iOS vibration)
  const [isMapFullscreen, setIsMapFullscreen] = useState(false); // Track if map is in fullscreen mode
  const [isMapPopupOpen, setIsMapPopupOpen] = useState(false); // Track if map popup is open
  const [debugMode, setDebugMode] = useState(false); // Debug mode to disable distance checks
  const [showWaypointList, setShowWaypointList] = useState(false); // Collapsible waypoint list

  const fileInputs = useRef({});
  const mapRef = useRef(null); // Track the Leaflet map instance
  const photoSectionRef = useRef(null); // Ref for scrolling to photo section
  const progressSectionRef = useRef(null); // Ref for scrolling to progress section

  // Initialize log when quest starts
  useEffect(() => {
    if (questStartTime && quest) {
      const startTime = new Date(questStartTime).toLocaleString();
             const initialLog = [
         `=== QUEST LOG ===`,
         `Quest Name: ${quest.name}`,
         `Start Time: ${startTime}`,
         `Team Name: ${teamName || 'Unknown'}`,
         `Total Waypoints: ${quest.checkpoints.length}`,
         ``,
         `=== WAYPOINT ATTEMPTS ===`
       ];
      setLogEntries(initialLog);
    }
  }, [questStartTime, quest, teamName]);

  // Function to add log entry
  const addLogEntry = (checkpointName, checkpointNumber, isCorrect, similarity) => {
    const timestamp = new Date().toLocaleString();
    const result = isCorrect ? 'CORRECT' : 'INCORRECT';
    const entry = `${timestamp} - Waypoint ${checkpointNumber}: ${checkpointName} - ${result} (Similarity: ${similarity.toFixed(3)})`;
    setLogEntries(prev => [...prev, entry]);
  };

  // Function to handle user interaction (required for iOS vibration)
  const handleUserInteraction = () => {
    setUserHasInteracted(true);
    console.log('🔔 User interaction detected - vibration should now work on iOS');
  };

  // Function to trigger haptic feedback
  const triggerHapticFeedback = () => {
    try {
      // Check if device supports vibration
      if ('vibrate' in navigator) {
        // For iOS, we need to be more careful with timing and patterns
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        
        if (isIOS) {
          // iOS requires user interaction before vibration works
          if (!userHasInteracted) {
            console.log('🔔 iOS: User interaction required before vibration');
            return;
          }
          
          // iOS-specific vibration approach
          // Use a shorter, simpler vibration that iOS handles better
          navigator.vibrate(50);
          
          // iOS sometimes needs a small delay before another vibration
          setTimeout(() => {
            navigator.vibrate(50);
          }, 100);
          
          console.log('🔔 iOS haptic feedback triggered - in range of waypoint');
        } else {
          // Android and other devices can handle longer vibrations
          navigator.vibrate(100);
          console.log('🔔 Android haptic feedback triggered - in range of waypoint');
        }
      } else {
        console.log('🔔 Vibration not supported on this device');
      }
    } catch (error) {
      console.log('🔔 Vibration failed:', error);
      
      // Fallback for iOS - try alternative approach
      try {
        if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
          // iOS fallback - try with different timing
          navigator.vibrate(25);
          console.log('🔔 iOS fallback vibration attempted');
        }
      } catch (fallbackError) {
        console.log('🔔 iOS fallback vibration also failed:', fallbackError);
      }
    }
  };

  // Function to update parent component with current progress
  const updateParentProgress = () => {
    if (updateQuestProgress) {
      updateQuestProgress({
        completedCheckpoints,
        skippedCheckpoints,
        skipsUsed,
        photos,
        aiResults
      });
    }
  };

  // Function to skip current waypoint
  const skipWaypoint = () => {
    if (closestCheckpoint && skipsUsed < 3) {
      const newSkippedCheckpoints = new Set([...skippedCheckpoints, closestCheckpoint.index]);
      const newSkipsUsed = skipsUsed + 1;
      setSkippedCheckpoints(newSkippedCheckpoints);
      setSkipsUsed(newSkipsUsed);
      setShowSkipConfirmation(false);
      showCustomAlert('Waypoint skipped!\nMoving to next available waypoint.', 'success');
      
      // Update parent component
      updateQuestProgress({
        completedCheckpoints,
        skippedCheckpoints: newSkippedCheckpoints,
        skipsUsed: newSkipsUsed,
        photos,
        aiResults
      });
    }
  };

  // Function to return to a skipped waypoint
  const returnToSkippedWaypoint = (waypointIndex) => {
    const newSkippedCheckpoints = new Set(skippedCheckpoints);
    newSkippedCheckpoints.delete(waypointIndex);
    const newSkipsUsed = skipsUsed - 1;
    setSkippedCheckpoints(newSkippedCheckpoints);
    setSkipsUsed(newSkipsUsed);
    showCustomAlert('Returning to skipped waypoint!', 'success');
    
    // Update parent component
    updateQuestProgress({
      completedCheckpoints,
      skippedCheckpoints: newSkippedCheckpoints,
      skipsUsed: newSkipsUsed,
      photos,
      aiResults
    });
  };

  // Function to finish quest early
  const finishQuestEarly = () => {
    const totalProgress = completedCheckpoints.size + skippedCheckpoints.size;
    const completionPercentage = totalProgress / checkpoints.length;
    
    if (completionPercentage >= 0.8) {
      setShowEarlyCompletionConfirmation(false);
      // Mark all remaining waypoints as skipped to complete the quest
      const remainingWaypoints = new Set();
      checkpoints.forEach((_, index) => {
        if (!completedCheckpoints.has(index) && !skippedCheckpoints.has(index)) {
          remainingWaypoints.add(index);
        }
      });
      const newSkippedCheckpoints = new Set([...skippedCheckpoints, ...remainingWaypoints]);
      setSkippedCheckpoints(newSkippedCheckpoints);
      
      // Update parent component
      updateQuestProgress({
        completedCheckpoints,
        skippedCheckpoints: newSkippedCheckpoints,
        skipsUsed,
        photos,
        aiResults
      });
      showCustomAlert('Quest completed early!\nCongratulations!', 'success');
      
      // Trigger quest completion for early finish
      if (questStartTime && onQuestComplete) {
        const completionTime = Date.now() - questStartTime;
        setQuestEndTime(Date.now());
        onQuestComplete(completionTime, completedCheckpoints.size);
      }
    } else {
      showCustomAlert('You need at least 80% completion to finish early.\nComplete more waypoints first.', 'error');
    }
  };

  // Function to show custom alert
  const showCustomAlert = (message, type = 'success', autoHide = true) => {
    setAlertMessage(message);
    setAlertType(type);
    setShowAlert(true);
    if (autoHide) {
      setTimeout(() => setShowAlert(false), 3000); // Auto-hide after 3 seconds
    }
  };

  // Add event listener for debug mode changes from popup
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data && event.data.type === 'debugMode') {
        setDebugMode(event.data.enabled);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Function to display log in popup
  const displayLog = () => {
    // Only show completion section if quest is actually complete
    const logContent = logEntries.join('\n');
    
    const popup = window.open('', '_blank', 'width=400,height=600,scrollbars=yes,resizable=yes');
    popup.document.write(`
      <html>
        <head>
          <title>Quest Log - ${quest.name}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: 'Courier New', monospace;
              background-color: #1a365d;
              color: #e2e8f0;
              padding: 10px;
              margin: 0;
              line-height: 1.4;
              font-size: 12px;
            }
            .log-container {
              background-color: #2d3748;
              border: 1px solid #4a5568;
              border-radius: 8px;
              padding: 15px;
              white-space: pre-wrap;
              font-size: 11px;
              max-height: 500px;
              overflow-y: auto;
            }
            h1 {
              color: #63b3ed;
              margin-bottom: 15px;
              text-align: center;
              font-size: 16px;
            }
            .close-btn {
              position: fixed;
              top: 5px;
              right: 5px;
              background-color: #e53e3e;
              color: white;
              border: none;
              padding: 6px 12px;
              border-radius: 4px;
              cursor: pointer;
              font-size: 12px;
            }
            .close-btn:hover {
              background-color: #c53030;
            }
            .debug-section {
              background-color: #2d3748;
              border: 1px solid #4a5568;
              border-radius: 8px;
              padding: 15px;
              margin-bottom: 15px;
            }
            .debug-toggle {
              display: flex;
              align-items: center;
              gap: 10px;
              margin-bottom: 10px;
            }
            .debug-toggle input[type="radio"] {
              margin: 0;
            }
            .debug-toggle label {
              cursor: pointer;
              font-weight: bold;
            }
            .debug-info {
              font-size: 10px;
              color: #a0aec0;
              font-style: italic;
            }
            @media (max-width: 480px) {
              body {
                padding: 5px;
                font-size: 10px;
              }
              .log-container {
                padding: 10px;
                font-size: 10px;
              }
              h1 {
                font-size: 14px;
              }
            }
          </style>
        </head>
        <body>
          <button class="close-btn" onclick="window.close()">Close</button>
          <h1>Quest Log - ${quest.name}</h1>
          <div class="debug-section">
            <div class="debug-toggle">
              <input type="radio" id="debug-off" name="debug" value="off" ${!debugMode ? 'checked' : ''} onchange="window.opener.postMessage({type: 'debugMode', enabled: false}, '*')">
              <label for="debug-off">Normal Mode</label>
            </div>
            <div class="debug-toggle">
              <input type="radio" id="debug-on" name="debug" value="on" ${debugMode ? 'checked' : ''} onchange="window.opener.postMessage({type: 'debugMode', enabled: true}, '*')">
              <label for="debug-on">Debug Mode</label>
            </div>
            <div class="debug-info">
              Debug Mode: Disables 50-foot distance requirement for testing quests from any location.
            </div>
          </div>
          <div class="log-container">${logContent}</div>
        </body>
      </html>
    `);
    popup.document.close();
  };

  async function compareImages(playerImageDataUrl, answerImageFilename) {
    try {
      const response = await fetch(`${SERVER_URL}/compare`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ 
          playerImage: playerImageDataUrl, 
          answerImage: answerImageFilename 
        })
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
        const newPhotos = { ...photos, [idx]: e.target.result };
        const newAiResults = { ...aiResults, [idx]: undefined }; // reset AI result
        setPhotos(newPhotos);
        setAiResults(newAiResults);
        
        // Update parent component
        updateQuestProgress({
          completedCheckpoints,
          skippedCheckpoints,
          skipsUsed,
          photos: newPhotos,
          aiResults: newAiResults
        });
        
        // Scroll to photo section after a short delay to ensure state is updated
        setTimeout(() => {
          if (photoSectionRef.current) {
            photoSectionRef.current.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center' 
            });
          }
        }, 100);
        
        // Automatically check answer after photo is taken
        setTimeout(() => {
          checkAnswer(idx, e.target.result);
        }, 500); // Small delay to ensure photo is loaded
      };
      reader.readAsDataURL(file);
    }
  }

  function triggerFileInput(idx) {
    if (fileInputs.current[idx]) {
      fileInputs.current[idx].click();
    }
  }

  // Calculate distance between two GPS coordinates in feet
  function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 20902231; // Earth's radius in feet
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Calculate bearing (direction) between two GPS coordinates
  function calculateBearing(lat1, lng1, lat2, lng2) {
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
    const bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
  }

  // Get direction name from bearing
  function getDirectionName(bearing) {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(bearing / 45) % 8;
    return directions[index];
  }

  // Find the closest checkpoint to current location
  function findClosestCheckpoint() {
    if (!location || checkpoints.length === 0) return null;
    
    let closest = null;
    let minDistance = Infinity;
    
    checkpoints.forEach((checkpoint, index) => {
      if (!completedCheckpoints.has(index) && !skippedCheckpoints.has(index)) {
        const distance = calculateDistance(location.lat, location.lng, checkpoint.lat, checkpoint.lng);
        if (distance < minDistance) {
          minDistance = distance;
          closest = { ...checkpoint, index, distance };
        }
      }
    });
    
    return closest;
  }

  async function checkAnswer(idx, userPhotoData = null) {
    setIsCheckingAnswer(true);
    
    // Scroll to photo section when checking starts
    setTimeout(() => {
      if (photoSectionRef.current) {
        photoSectionRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }
    }, 100);
    
    try {
      const userPhoto = userPhotoData || photos[idx];
      const checkpoint = checkpoints[idx];
      const answerImage = checkpoint?.answerImage;
      
      if (!answerImage) {
        throw new Error('No answer image found for this waypoint');
      }
      
      const similarity = await compareImages(userPhoto, answerImage);
      if (similarity === null) return;
      const isCorrect = similarity > 0.75;
      setAiResults(prev => ({ ...prev, [idx]: isCorrect }));
      
             // Add log entry
       const checkpointName = checkpoints[idx]?.name || `Waypoint ${idx + 1}`;
       addLogEntry(checkpointName, idx + 1, isCorrect, similarity);
      
                                       if (isCorrect) {
                      // Mark checkpoint as completed and move to next
                      const newCompletedCheckpoints = new Set([...completedCheckpoints, idx]);
                      setCompletedCheckpoints(newCompletedCheckpoints);
                      setCurrentCheckpointIndex(prev => prev + 1);
                      
                      // Update parent component
                      updateQuestProgress({
                        completedCheckpoints: newCompletedCheckpoints,
                        skippedCheckpoints,
                        skipsUsed,
                        photos,
                        aiResults: { ...aiResults, [idx]: isCorrect }
                      });
                      
                      // Check if this was the last waypoint to complete
                      const remainingWaypoints = checkpoints.length - (newCompletedCheckpoints.size) - skippedCheckpoints.size;
                      
                      // Check if this waypoint has a fun fact
                      const currentWaypoint = checkpoints[idx];
                      const hasFunFact = currentWaypoint && currentWaypoint.funFact;
                      
                                             if (remainingWaypoints === 0) {
                         if (hasFunFact) {
                           showCustomAlert(`Correct!\n🎉 Congratulations! You've completed the quest!\n\n💡 Fun Fact:\n${currentWaypoint.funFact}`, 'success', false);
                         } else {
                           showCustomAlert('Correct!\n🎉 Congratulations! You\'ve completed the quest!', 'success');
                         }
                       } else {
                         if (hasFunFact) {
                           showCustomAlert(`Correct!\nMoving to next waypoint!\n\n💡 Fun Fact:\n${currentWaypoint.funFact}`, 'success', false);
                         } else {
                           showCustomAlert('Correct!\nMoving to next waypoint!', 'success');
                         }
                       }
                       
                       // Scroll to progress section to show the updated progress
                       setTimeout(() => {
                         if (progressSectionRef.current) {
                           progressSectionRef.current.scrollIntoView({ 
                             behavior: 'smooth', 
                             block: 'center' 
                           });
                         }
                       }, 200);
                    } else {
                      // Update parent component with incorrect result
                      updateQuestProgress({
                        completedCheckpoints,
                        skippedCheckpoints,
                        skipsUsed,
                        photos,
                        aiResults: { ...aiResults, [idx]: isCorrect }
                      });
                      showCustomAlert('Incorrect!\nTry zooming in.', 'error');
                      
                      // Scroll to photo section to show the result
                      setTimeout(() => {
                        if (photoSectionRef.current) {
                          photoSectionRef.current.scrollIntoView({ 
                            behavior: 'smooth', 
                            block: 'center' 
                          });
                        }
                      }, 200);
                    }
    } finally {
      setIsCheckingAnswer(false);
    }
  }

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported');
      return;
    }
    let watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, heading } = pos.coords;
        setLocation((prev) => {
          // Only set checkpoints on first location
          if (!prev) {
            setCheckpoints(quest.checkpoints);
          }
          return { lat: latitude, lng: longitude };
        });
        // Update heading if available
        if (heading !== null && !isNaN(heading)) {
          setHeading(heading);
        }
      },
      (err) => setError('Unable to get location'),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    );
    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [quest]);

  // Get current closest checkpoint info
  const closestCheckpoint = findClosestCheckpoint();
  const isWithinRange = debugMode || (closestCheckpoint && closestCheckpoint.distance <= 50); // Debug mode disables distance check
  // Only auto-complete if ALL waypoints are completed (no skips)
  const isGameComplete = completedCheckpoints.size === checkpoints.length && checkpoints.length > 0;

  // Haptic feedback when entering waypoint range
  useEffect(() => {
    if (isWithinRange && !lastInRangeState) {
      triggerHapticFeedback();
    }
    setLastInRangeState(isWithinRange);
  }, [isWithinRange, lastInRangeState]);

  // Update current time every second
  useEffect(() => {
    if (questStartTime && !isGameComplete) {
      const interval = setInterval(() => {
        setCurrentTime(Date.now() - questStartTime);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [questStartTime, isGameComplete]);

  // Handle quest completion
  useEffect(() => {
    // Only add completion log when quest is actually complete and not already logged
    // Also ensure we have a valid quest start time and some time has passed
    if (isGameComplete && questStartTime && onQuestComplete && !completionLogged && 
        checkpoints.length > 0 && completedCheckpoints.size > 0) {
      
      const completionTime = Date.now() - questStartTime;
      setQuestEndTime(Date.now());
      
             // Add completion log entry
       const endTime = new Date().toLocaleString();
       const totalTime = formatTime(completionTime);
               const completionEntry = [
          ``,
          `=== QUEST COMPLETION ===`,
          `End Time: ${endTime}`,
          `Total Time: ${totalTime}`,
          `Completed Waypoints: ${completedCheckpoints.size}/${checkpoints.length}`,
          `Skipped Waypoints: ${skippedCheckpoints.size}`,
          `Skips Used: ${skipsUsed}/3`
        ];
      setLogEntries(prev => [...prev, ...completionEntry]);
      setCompletionLogged(true); // Mark as logged to prevent duplicates
      
             onQuestComplete(completionTime, completedCheckpoints.size);
    }
  }, [isGameComplete, questStartTime, onQuestComplete, setQuestEndTime, completedCheckpoints.size, checkpoints.length, completionLogged]);

  // Handle fullscreen toggle and map size invalidation
  useEffect(() => {
    // lock page scroll when fullscreen to avoid "half screen" effects
    if (isMapFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    // force Leaflet to recompute dimensions
    if (mapRef.current) {
      // next tick is enough; a tiny delay helps on iOS
      setTimeout(() => mapRef.current.invalidateSize(), 50);
    }
  }, [isMapFullscreen]);

  // Handle popup toggle and map size invalidation
  useEffect(() => {
    // lock page scroll when popup is open to avoid scrolling issues
    if (isMapPopupOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    // force Leaflet to recompute dimensions when popup opens/closes
    if (mapRef.current) {
      // next tick is enough; a tiny delay helps on iOS
      setTimeout(() => mapRef.current.invalidateSize(), 50);
    }
  }, [isMapPopupOpen]);

  const formatTime = (milliseconds) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ 
      width: '95%', 
      maxWidth: '95%', 
      margin: '0 auto',
      backgroundColor: 'rgb(22, 86, 113)',
      minHeight: '100vh',
      color: 'white'
    }}>
      {/* Quest Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1em',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        {/* Logo */}
        <img 
          src={OdysseusLogo} 
          alt="Odysseus" 
          style={{ 
            width: '80px', 
            height: '80px', 
            objectFit: 'contain' 
          }} 
        />
        
        {/* Back Button */}
        <button 
          onClick={() => {
            // Call the parent's return function to preserve quest state
            if (window.returnToStartScreen) {
              window.returnToStartScreen();
            } else {
              // Fallback to history back if function not available
              window.history.back();
            }
          }}
          style={{ 
            padding: '0.5em 1em',
            borderRadius: 4,
            backgroundColor: '#2d3748',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1.1em'
          }}
        >
          ← Back
        </button>
      </div>
             <style>
         {`
           @keyframes spin {
             0% { transform: rotate(0deg); }
             100% { transform: rotate(360deg); }
           }
                       @keyframes fadeIn {
              0% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
              100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            }
           body {
             background-color: rgb(22, 86, 113) !important;
             margin: 0;
             padding: 0;
             display: block !important;
             place-items: initial !important;
           }
           .compass-icon {
             transition: transform 0.3s ease-out;
           }
         `}
       </style>
       

                             {/* Custom Alert */}
        {showAlert && (
                     <div style={{
             position: 'fixed',
             top: '50%',
             left: '50%',
             transform: 'translate(-50%, -50%)',
             zIndex: 9999,
             background: alertType === 'success' ? '#22543d' : '#744210',
             padding: '1.5em 2em',
             borderRadius: '12px',
             border: `3px solid ${alertType === 'success' ? '#68d391' : '#f6ad55'}`,
             boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
             fontSize: '1.2em',
             textAlign: 'center',
             whiteSpace: 'pre-line',
             width: alertMessage.includes('💡 Fun Fact:') ? '75%' : '50%',
             maxWidth: '90%',
             maxHeight: '80vh',
             overflow: 'auto',
             animation: 'fadeIn 0.3s ease-out'
           }}>
            <div style={{ 
              textAlign: 'left',
              lineHeight: '1.4'
            }}>
                             {alertMessage.split('\n').map((line, index) => {
                 if (line.includes('💡 Fun Fact:')) {
                   // Split the line to separate "💡 Fun Fact:" from the actual text
                   const parts = line.split('💡 Fun Fact:');
                   if (parts.length === 2) {
                     return (
                       <div key={index} style={{ 
                         marginTop: '1em',
                         textAlign: 'center'
                       }}>
                         <span style={{ 
                           color: '#68d391',
                           fontWeight: 'bold',
                           fontSize: '1em'
                         }}>
                           💡 Fun Fact:
                         </span>
                         <div style={{ 
                           color: 'white',
                           fontWeight: 'normal',
                           fontSize: '1em',
                           lineHeight: '1.5',
                           marginTop: '0.5em'
                         }}>
                           {parts[1].trim()}
                         </div>
                       </div>
                     );
                   } else {
                     // If splitting didn't work as expected, treat the whole line as fun fact text
                     return (
                       <div key={index} style={{ 
                         marginTop: '1em',
                         textAlign: 'left'
                       }}>
                         <span style={{ 
                           color: '#68d391',
                           fontWeight: 'bold',
                           fontSize: '1em'
                         }}>
                           💡 Fun Fact:
                         </span>
                         <div style={{ 
                           color: 'white',
                           fontWeight: 'normal',
                           fontSize: '1em',
                           lineHeight: '1.5',
                           marginTop: '0.5em'
                         }}>
                           {line.replace('💡 Fun Fact:', '').trim()}
                         </div>
                       </div>
                     );
                   }
                 } else {
                   return (
                     <div key={index} style={{ 
                       color: alertType === 'success' ? '#68d391' : '#f6ad55',
                       fontWeight: 'bold',
                       textAlign: 'center',
                       marginBottom: '0.5em'
                     }}>
                       {line}
                     </div>
                   );
                 }
               })}
            </div>
            {alertMessage.includes('💡 Fun Fact:') && (
              <div style={{ marginTop: '1em', textAlign: 'center' }}>
                <button
                  onClick={() => setShowAlert(false)}
                  style={{
                    padding: '0.5em 1em',
                    borderRadius: '6px',
                    backgroundColor: alertType === 'success' ? '#68d391' : '#f6ad55',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.9em',
                    fontWeight: 'bold'
                  }}
                >
                  Got it!
                </button>
              </div>
            )}
          </div>
        )}

                 {/* Skip Confirmation Dialog */}
         {showSkipConfirmation && (
           <div style={{
             position: 'fixed',
             top: '50%',
             left: '50%',
             transform: 'translate(-50%, -50%)',
             zIndex: 9999,
             background: '#744210',
             color: '#f6ad55',
             padding: '1.5em 2em',
             borderRadius: '12px',
             border: '3px solid #f6ad55',
             boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
             fontSize: '1.1em',
             textAlign: 'center',
             maxWidth: '90%',
             animation: 'fadeIn 0.3s ease-out'
           }}>
            <div style={{ marginBottom: '1em', fontWeight: 'bold' }}>
              Skip Waypoint?
            </div>
            <div style={{ marginBottom: '1em', fontSize: '0.9em' }}>
              Are you sure you want to skip this waypoint?<br/>
              You can return to it later, but this will use 1 of your 3 skips.
            </div>
            <div style={{ display: 'flex', gap: '1em', justifyContent: 'center' }}>
              <button
                style={{
                  padding: '0.5em 1em',
                  borderRadius: '6px',
                  backgroundColor: '#f6ad55',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1em',
                  fontWeight: 'bold'
                }}
                onClick={skipWaypoint}
              >
                Skip Waypoint
              </button>
              <button
                style={{
                  padding: '0.5em 1em',
                  borderRadius: '6px',
                  backgroundColor: '#4a5568',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1em'
                }}
                onClick={() => setShowSkipConfirmation(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

                 {/* Early Completion Confirmation Dialog */}
         {showEarlyCompletionConfirmation && (
           <div style={{
             position: 'fixed',
             top: '50%',
             left: '50%',
             transform: 'translate(-50%, -50%)',
             zIndex: 9999,
             background: '#805ad5',
             color: 'white',
             padding: '1.5em 2em',
             borderRadius: '12px',
             border: '3px solid #805ad5',
             boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
             fontSize: '1.1em',
             textAlign: 'center',
             maxWidth: '90%',
             animation: 'fadeIn 0.3s ease-out'
           }}>
            <div style={{ marginBottom: '1em', fontWeight: 'bold' }}>
              Finish Quest Early?
            </div>
            <div style={{ marginBottom: '1em', fontSize: '0.9em' }}>
              You have completed {(completedCheckpoints.size + skippedCheckpoints.size)}/{checkpoints.length} waypoints.<br/>
              Are you sure you want to finish the quest now?
            </div>
            <div style={{ display: 'flex', gap: '1em', justifyContent: 'center' }}>
              <button
                style={{
                  padding: '0.5em 1em',
                  borderRadius: '6px',
                  backgroundColor: '#805ad5',
                  color: 'white',
                  border: '2px solid white',
                  cursor: 'pointer',
                  fontSize: '1em',
                  fontWeight: 'bold'
                }}
                onClick={finishQuestEarly}
              >
                Finish Quest
              </button>
              <button
                style={{
                  padding: '0.5em 1em',
                  borderRadius: '6px',
                  backgroundColor: '#4a5568',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1em'
                }}
                onClick={() => setShowEarlyCompletionConfirmation(false)}
              >
                Continue Playing
              </button>
            </div>
          </div>
        )}

       {error && <div style={{ color: '#ff6b6b', backgroundColor: '#2d3748', padding: '1em', borderRadius: '8px', marginBottom: '1em' }}>{error}</div>}
       {!location && !error && <div style={{ color: 'white', textAlign: 'center', padding: '2em' }}>Loading map...</div>}
      
             {/* Team Name Display */}
       {teamName && (
         <div style={{ 
           background: '#2d3748', 
           padding: '0.75em 1em', 
           borderRadius: '8px', 
           marginBottom: '1em',
           border: 'none',
           textAlign: 'center'
         }}>
                  {/* Quest Name */}
           <div style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '1.1em', textAlign: 'center', marginBottom: '0.3em' }}>
             🗺️ Quest: {quest.name}
           </div>
           <div style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '1.1em', textAlign: 'center' }}>
             🏆 Team: {teamName}
           </div>
           {debugMode && (
             <div style={{ 
               marginTop: '0.5em', 
               color: '#f6ad55', 
               fontSize: '0.9em', 
               fontWeight: 'bold' 
             }}>
               🐛 DEBUG MODE ACTIVE
             </div>
           )}
         </div>
       )}
       
       
      
      {/* Progress indicator */}
      {location && checkpoints.length > 0 && (
        <div ref={progressSectionRef} style={{ 
          background: '#2d3748', 
          padding: '1em', 
          borderRadius: '8px', 
          marginBottom: '1em',
          border: 'none',
          color: 'white'
        }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'stretch', marginBottom: '0.5em', gap: '0.5em' }}>
                <div style={{ 
                  color: '#white', 
                  fontWeight: 'bold', 
                  fontSize: '1.1em',
                  background: '#4a5568',
                  padding: '0.5em 1em',
                  borderRadius: '4px',
                  border: 'none',
                  flex: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '0.5em'
                }}>
                  {/* Completed Progress Bar */}
                  <div style={{ width: '100%' }}>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      marginBottom: '0.2em'
                    }}>
                      <span>Completed</span>
                      <span>{completedCheckpoints.size}/{checkpoints.length}</span>
                    </div>
                    <div style={{ 
                      width: '100%', 
                      height: '8px', 
                      backgroundColor: '#2d3748', 
                      borderRadius: '4px',
                      overflow: 'hidden'
                    }}>
                      <div style={{ 
                        width: `${(completedCheckpoints.size / checkpoints.length) * 100}%`, 
                        height: '100%', 
                        backgroundColor: '#68d391',
                        transition: 'width 0.3s ease'
                      }}></div>
                    </div>
                  </div>
                  
                  {/* Skipped Progress Bar */}
                  <div style={{ width: '100%' }}>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      marginBottom: '0.2em'
                    }}>
                      <span>Skipped</span>
                      <span>{skippedCheckpoints.size}/3</span>
                    </div>
                    <div style={{ 
                      width: '100%', 
                      height: '8px', 
                      backgroundColor: '#2d3748', 
                      borderRadius: '4px',
                      overflow: 'hidden'
                    }}>
                      <div style={{ 
                        width: `${(skippedCheckpoints.size / 3) * 100}%`, 
                        height: '100%', 
                        backgroundColor: '#f6ad55',
                        transition: 'width 0.3s ease'
                      }}></div>
                    </div>
                  </div>
                </div>
               <div style={{ 
                 color: 'white', 
                 fontWeight: 'bold', 
                 fontSize: '1.1em',
                 background: '#4a5568',
                 padding: '0.5em 1em',
                 borderRadius: '4px',
                 border: 'none',
                 flex: 1,
                 display: 'flex',
                 alignItems: 'center',
                 justifyContent: 'center'
               }}>
                 ⏱️ {formatTime(currentTime)}
               </div>
             </div>
           
                       {/* Early completion button */}
            {!isGameComplete && (
              (completedCheckpoints.size + skippedCheckpoints.size) / checkpoints.length >= 0.8 || 
              (completedCheckpoints.size + skippedCheckpoints.size) === checkpoints.length
            ) && (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5em' }}>
                <button
                  style={{
                    padding: '0.3em 0.8em',
                    borderRadius: '4px',
                    backgroundColor: '#805ad5',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.9em',
                    fontWeight: 'bold'
                  }}
                  onClick={() => setShowEarlyCompletionConfirmation(true)}
                >
                  🏁 Finish Quest Early
                </button>
              </div>
            )}
          
                     {isGameComplete ? (
             <div style={{ color: '#68d391', fontWeight: 'bold', fontSize: '1.2em' }}>
               🎉 Congratulations! You've completed the quest!
             </div>
           ) : closestCheckpoint ? (
            <div>
               <div style={{ fontWeight: 'bold', marginBottom: '0.5em', color: '#e2e8f0', fontSize: '1.4em' }}>
               <span style={{ color: '#f6e05e' }}>——</span> &nbsp;{closestCheckpoint.name}&nbsp; <span style={{ color: '#f6e05e' }}>——</span>
               </div>
               <div style={{ fontWeight: 'bold', marginBottom: '1.5em', color: '#f6e05e', fontSize: '1.2em' }}>
                 {closestCheckpoint.clue}
               </div>
               
               {/* Waypoint Info and Map Section */}
               <div style={{ display: 'flex', gap: '1em', alignItems: 'flex-start' }}>
                 {/* Left Side - Distance, Direction, and Proximity Messages */}
                 <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5em' }}>
                   <div style={{ color: '#e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.3em' }}>
                     <div>
                       <strong style={{ fontSize: '1.1em' }}>Distance:</strong><br/>
                       <div style={{ fontSize: '1.1em', marginBottom: '0.3em' }}>{Math.round(closestCheckpoint.distance)} feet</div>
                     </div>
                     <div>
                       <strong style={{ fontSize: '1.1em' }}>Direction:</strong><br/>
                       <div style={{ fontSize: '1.1em' }}>{getDirectionName(calculateBearing(location.lat, location.lng, closestCheckpoint.lat, closestCheckpoint.lng))}</div>
                     </div>
                   </div>
                   {isWithinRange ? (
                     <div style={{ color: '#68d391', fontWeight: 'bold' }}>
                       ✅ You can solve the riddle now!
                     </div>
                   ) : (
                     <div style={{ color: '#f6ad55', fontWeight: 'bold' }}>
                       ⚠️ Get within 50 feet to take a picture
                     </div>
                   )}
                   
                   {/* Skip button */}
                   {skipsUsed < 3 && (
                     <button 
                       style={{ 
                         padding: '0.5em 1em', 
                         borderRadius: 4,
                         backgroundColor: '#f6ad55',
                         color: 'white',
                         border: 'none',
                         cursor: 'pointer',
                         fontSize: '0.9em',
                         marginTop: '1em',
                         width: '100%'
                       }} 
                       type="button" 
                       onClick={() => {
                         handleUserInteraction();
                         setShowSkipConfirmation(true);
                       }}
                     >
                       ⏭️ Skip
                     </button>
                   )}
                 </div>
                 
                 {/* Right Side - Mini Map */}
                 <div style={{ 
                   width: '60%',
                   height: '250px',
                   position: 'relative',
                   borderRadius: '8px',
                   overflow: 'hidden',
                   marginLeft: '0.5em'
                 }}>
                   {/* Expand Map Button */}
                   <button
                     onClick={() => setIsMapPopupOpen(true)}
                     style={{
                       position: 'absolute',
                       top: '10px',
                       right: '10px',
                       zIndex: 1000,
                       width: '32px',
                       height: '32px',
                       backgroundColor: 'white',
                       border: 'none',
                       borderRadius: '0px',
                       cursor: 'pointer',
                       padding: '0',
                       display: 'flex',
                       alignItems: 'center',
                       justifyContent: 'center',
                       boxShadow: '0 1px 2px rgba(0, 0, 0, 0.3)'
                     }}
                     title="Expand map"
                   >
                     <img 
                       src={expandIcon} 
                       alt="Expand map" 
                       style={{ 
                         width: '32px', 
                         height: '32px',
                         objectFit: 'contain'
                       }} 
                     />
                   </button>
                   <MapContainer 
                     center={center || [location.lat, location.lng]} 
                     zoom={18} 
                     whenCreated={(m) => (mapRef.current = m)}
                     style={{ 
                       height: '100%', 
                       width: '100%', 
                       borderRadius: '8px',
                       cursor: 'pointer'
                     }}
                   >
                     <CenterMap position={center || [location.lat, location.lng]} />
                     <MapClickHandler isMapFullscreen={isMapFullscreen} setIsMapFullscreen={setIsMapFullscreen} isMapPopupOpen={isMapPopupOpen} setIsMapPopupOpen={setIsMapPopupOpen} />
                     <TileLayer
                       url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                       attribution=""
                     />
                     <Marker position={[location.lat, location.lng]} icon={createCompassIcon(heading)}>
                       <Popup>Your Location</Popup>
                     </Marker>
                     
                     {/* Show only the current closest waypoint */}
                     {closestCheckpoint && (
                       <Marker 
                         position={[closestCheckpoint.lat, closestCheckpoint.lng]} 
                         icon={checkpointIcon}
                       >
                         <Popup>
                           <strong>Waypoint {closestCheckpoint.index + 1}</strong>
                           <div style={{ marginTop: '0.5em' }}>
                             <strong>Distance:</strong> {closestCheckpoint.distance.toFixed(1)} feet
                           </div>
                           <details style={{ marginTop: '0.5em' }}>
                             <summary>Show Clue</summary>
                             <div style={{ marginTop: '0.5em', fontSize: '0.95em' }}>{closestCheckpoint.clue}</div>
                           </details>
                         </Popup>
                       </Marker>
                     )}
                   </MapContainer>
                   
                   {/* Tap to expand hint */}
                   <div style={{
                     position: 'absolute',
                     bottom: '10px',
                     left: '0',
                     right: '0',
                     backgroundColor: '#4a5568',
                     color: '#e2e8f0',
                     padding: '0.5em',
                     borderRadius: '6px',
                     border: 'none',
                     fontSize: '0.8em',
                     fontStyle: 'italic',
                     textAlign: 'center',
                     pointerEvents: 'none'
                   }}>
                     💡 <strong>Tap to expand</strong>
                   </div>
                 </div>
               </div>
            </div>
                     ) : (
             <div style={{ color: '#e2e8f0' }}>No more waypoints available</div>
           )}
        </div>
      )}

      {/* Waypoint Section */}
      {location && closestCheckpoint && isWithinRange && (
        <div style={{ 
          background: '#2d3748', 
          padding: '1em', 
          borderRadius: '8px', 
          border: 'none',
          color: 'white',
          marginBottom: '1em',
          height: 'auto',
          overflowY: 'auto'
        }}>
          {/*<h3 style={{ margin: '0 0 0.5em 0', color: '#68d391' }}>
            📍 Solve the Clue for Waypoint {closestCheckpoint.index + 1} 📍
          </h3> */}
          
          <div style={{ display: 'flex', gap: '0.5em', marginBottom: '0.5em', flexDirection: 'column' }}>
            <button 
              style={{ 
                padding: '1em 0.5em', 
                borderRadius: 4,
                backgroundColor: '#228ebb',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontSize: '2em',
                width: '100%'
              }} 
              type="button" 
              onClick={() => {
                handleUserInteraction();
                triggerFileInput(closestCheckpoint.index);
              }}
            >
              📸 Take a picture
            </button>
            

            
            <input
              ref={el => fileInputs.current[closestCheckpoint.index] = el}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={e => handlePhoto(closestCheckpoint.index, e)}
            />
          </div>
          
          {photos[closestCheckpoint.index] && (
            <>
              {isCheckingAnswer ? (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5em',
                  padding: '0.5em 1em',
                  backgroundColor: '#4a5568',
                  borderRadius: 4,
                  border: 'none',
                  marginTop: '1em'
                }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    border: '2px solid #63b3ed',
                    borderTop: '2px solid transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                  <span style={{ color: '#63b3ed', fontWeight: 'bold' }}>
                    Checking answer...
                  </span>
                </div>
              ) : null}
              
              {aiResults[closestCheckpoint.index] !== undefined && !isCheckingAnswer && (
                <div style={{ marginTop: '0.5em', color: aiResults[closestCheckpoint.index] ? '#68d391' : '#fc8181', fontWeight: 'bold' }}>
                  {aiResults[closestCheckpoint.index] ? 'Correct!' : 'Try again.'}
                </div>
              )}
            </>
          )}
          
          {photos[closestCheckpoint.index] && (
            <div ref={photoSectionRef} style={{ marginTop: '1em' }}>
              <div style={{ marginBottom: '0.5em' }}>
                <strong>Your Photo:</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5em' }}>
                <img src={photos[closestCheckpoint.index]} alt={`Waypoint ${closestCheckpoint.index + 1} photo`} style={{ width: '70%', borderRadius: '8px' }} />
              </div>
            </div>
          )}
          
          <div style={{ marginTop: '1em', padding: '0.75em', backgroundColor: '#4a5568', borderRadius: '6px', border: 'none' }}>
            <div style={{ color: '#e2e8f0', fontSize: '0.9em', fontStyle: 'italic' }}>
              💡 <strong>Hint:</strong> Frame the treasure, not the clutter - show just the prize in clear view.
            </div>
          </div>
        </div>
      )}

      {/* Floating Map Popup */}
      {isMapPopupOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '5%'
        }}>
          <div style={{
            position: 'relative',
            width: '90%',
            height: '90%',
            backgroundColor: '#1a365d',
            borderRadius: '12px',
            border: 'none',
            overflow: 'hidden'
          }}>
            {/* Close Button */}
            <button
              onClick={() => setIsMapPopupOpen(false)}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                zIndex: 10000,
                padding: '0.5em 1em',
                borderRadius: '6px',
                backgroundColor: '#2d3748',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1em',
                fontWeight: 'bold',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
              }}
            >
              ✕ Close
            </button>
            
            {/* Popup Map */}
            <MapContainer 
              center={center || [location.lat, location.lng]} 
              zoom={18} 
              whenCreated={(m) => (mapRef.current = m)}
              style={{ 
                height: '100%', 
                width: '100%', 
                borderRadius: '9px'
              }}
            >
              <CenterMap position={center || [location.lat, location.lng]} />
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution=""
              />
              <Marker position={[location.lat, location.lng]} icon={createCompassIcon(heading)}>
                <Popup>Your Location</Popup>
              </Marker>
              
              {/* Show only the current closest waypoint */}
              {closestCheckpoint && (
                <Marker 
                  position={[closestCheckpoint.lat, closestCheckpoint.lng]} 
                  icon={checkpointIcon}
                >
                  <Popup>
                    <strong>Waypoint {closestCheckpoint.index + 1}</strong>
                    <div style={{ marginTop: '0.5em' }}>
                      <strong>Distance:</strong> {closestCheckpoint.distance.toFixed(1)} feet
                    </div>
                    <details style={{ marginTop: '0.5em' }}>
                      <summary>Show Clue</summary>
                      <div style={{ marginTop: '0.5em', fontSize: '0.95em' }}>{closestCheckpoint.clue}</div>
                    </details>
                   
                   {isWithinRange ? (
                     <div style={{ marginTop: '1em', color: 'green', fontWeight: 'bold' }}>
                       ✅ You're close enough! Use the photo interface to the right.
                     </div>
                   ) : (
                     <div style={{ marginTop: '1em', color: 'orange', fontWeight: 'bold' }}>
                       ⚠️ Get within 50 feet to take a picture
                     </div>
                   )}
                  </Popup>
                </Marker>
              )}
              
              {/* Show completed waypoints as green markers */}
              {checkpoints.map((cp, idx) => {
                if (completedCheckpoints.has(idx)) {
                  return (
                    <Marker 
                      key={`completed-${idx}`} 
                      position={[cp.lat, cp.lng]} 
                      icon={L.divIcon({
                        className: 'custom-div-icon',
                        html: `<div style="background-color: #28a745; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">✓</div>`,
                        iconSize: [20, 20],
                        iconAnchor: [10, 10]
                      })}
                    >
                      <Popup>
                        <strong>Waypoint {idx + 1} - Completed! ✅</strong>
                        <div style={{ marginTop: '0.5em' }}>{cp.name}</div>
                      </Popup>
                    </Marker>
                  );
                }
                return null;
              })}
            </MapContainer>
          </div>
        </div>
      )}

      
             {/* Waypoint list */}
       {location && checkpoints.length > 0 && (
         <div style={{ marginTop: '1em' }}>
           <button
             onClick={() => setShowWaypointList(!showWaypointList)}
             style={{
               background: 'none',
               border: 'none',
               color: 'white',
               cursor: 'pointer',
               fontSize: '1.1em',
               fontWeight: 'bold',
               display: 'flex',
               alignItems: 'center',
               gap: '0.5em',
               marginBottom: '0.5em'
             }}
           >
             {showWaypointList ? '▼' : '▶'} All Waypoints
           </button>
           {showWaypointList && (
             <ul style={{ background: '#2d3748', borderRadius: '8px', padding: '1em', listStyle: 'none', color: 'white', border: 'none' }}>
               {checkpoints
                 .map((cp, idx) => {
                   const isCompleted = completedCheckpoints.has(idx);
                   const isSkipped = skippedCheckpoints.has(idx);
                   const isCurrent = closestCheckpoint && closestCheckpoint.index === idx;
                   const distance = location ? calculateDistance(location.lat, location.lng, cp.lat, cp.lng) : null;
                   
                   return { cp, idx, isCompleted, isSkipped, isCurrent, distance };
                 })
                 .sort((a, b) => {
                   // Sort: current waypoint first, then unsolved, then skipped, then completed
                   if (a.isCurrent && !b.isCurrent) return -1;
                   if (!a.isCurrent && b.isCurrent) return 1;
                   if (!a.isCompleted && !a.isSkipped && !a.isCurrent && (b.isCompleted || b.isSkipped)) return -1;
                   if ((a.isCompleted || a.isSkipped) && !b.isCompleted && !b.isSkipped && !b.isCurrent) return 1;
                   if (a.isSkipped && !b.isSkipped && b.isCompleted) return -1;
                   if (!a.isSkipped && a.isCompleted && b.isSkipped) return 1;
                   return a.idx - b.idx; // Maintain original order within each group
                 })
                 .map(({ cp, idx, isCompleted, isSkipped, isCurrent, distance }) => (
                 <li 
                   key={idx} 
                   style={{ 
                     marginBottom: '0.5em', 
                     color: 'white', 
                     background: isCompleted ? '#22543d' : isSkipped ? '#744210' : isCurrent ? '#744210' : '#4a5568', 
                     borderRadius: '4px', 
                     padding: '0.5em', 
                     border: 'none',
                     cursor: 'pointer'
                                       }}
                  >
                                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                                               <strong style={{ color: isCompleted ? '#68d391' : isSkipped ? '#f6ad55' : isCurrent ? '#f6ad55' : '#63b3ed' }}>
                           Waypoint {idx+1}: {cp.name}
                         </strong>
                        {isCompleted && <span style={{ color: '#68d391', marginLeft: '0.5em' }}>✅ Completed</span>}
                        {isSkipped && <span style={{ color: '#f6ad55', marginLeft: '0.5em' }}>⏭️ Skipped</span>}
                        {isCurrent && <span style={{ color: '#f6ad55', marginLeft: '0.5em' }}>🎯 Current Target</span>}
                      </div>
                                            <div style={{ fontSize: '0.9em', color: '#a0aec0' }}>
                         {distance && `${distance.toFixed(1)} ft`}
                       </div>
                    </div>
                    <details style={{ marginTop: '0.5em' }}>
                      <summary style={{ color: '#e2e8f0' }}>Show Clue</summary>
                      <div style={{ marginTop: '0.5em', fontSize: '0.95em', color: '#e2e8f0' }}>{cp.clue}</div>
                    </details>
                                         <div style={{ display: 'flex', gap: '0.5em', marginTop: '0.5em', justifyContent: 'flex-end' }}>
                       {isSkipped && (
                         <button
                           style={{
                             padding: '0.2em 0.5em',
                             borderRadius: '3px',
                             backgroundColor: '#805ad5',
                             color: 'white',
                             border: 'none',
                             cursor: 'pointer',
                             fontSize: '0.8em',
                             fontWeight: 'bold'
                           }}
                           onClick={(e) => {
                             e.stopPropagation();
                             returnToSkippedWaypoint(idx);
                           }}
                         >
                           Return
                         </button>
                       )}
                       {isCurrent && skipsUsed < 3 && (
                         <button
                           style={{
                             padding: '0.2em 0.5em',
                             borderRadius: '3px',
                             backgroundColor: '#f6ad55',
                             color: 'white',
                             border: 'none',
                             cursor: 'pointer',
                             fontSize: '0.8em',
                             fontWeight: 'bold'
                           }}
                           onClick={(e) => {
                             e.stopPropagation();
                             setShowSkipConfirmation(true);
                           }}
                         >
                           Skip
                         </button>
                       )}
                     </div>
                 </li>
               ))}
             </ul>
           )}
         </div>
       )}

       {/* Display Log Button - Bottom of screen */}
       {logEntries.length > 0 && (
         <div style={{ 
           background: '#2d3748', 
           padding: '1em', 
           borderRadius: '8px', 
           marginTop: '1em',
           border: 'none',
           textAlign: 'center'
         }}>
           <button 
             style={{ 
               padding: '0.75em 1.5em', 
               borderRadius: 4,
               backgroundColor: '#805ad5',
               color: 'white',
               border: 'none',
               cursor: 'pointer',
               fontSize: '1em',
               fontWeight: 'bold'
             }} 
             type="button" 
             onClick={displayLog}
           >
             📄 Display Quest Log
           </button>
         </div>
       )}

     </div>
   );
 }
