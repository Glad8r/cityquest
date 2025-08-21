import { useState, useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import LeafletCheckpointMap from './LeafletCheckpointMap';
import QuestCreator from './QuestCreator';
import './App.css';
import OdysseusLogo from './assets/Odysseus.png';
import { SERVER_URL } from './config';

function App() {
  return (
    <Routes>
      <Route path="/" element={<MainApp />} />
      <Route path="/create" element={<QuestCreatorWrapper />} />
    </Routes>
  );
}

function QuestCreatorWrapper() {
  const navigate = useNavigate();
  
  const handleClose = () => {
    navigate('/');
  };
  
  return <QuestCreator onClose={handleClose} />;
}

function MainApp() {
  const [selectedQuest, setSelectedQuest] = useState(null);
  const [teamName, setTeamName] = useState('');
  const [questStartTime, setQuestStartTime] = useState(null);
  const [questEndTime, setQuestEndTime] = useState(null);
  const [currentQuestLeaderboard, setCurrentQuestLeaderboard] = useState([]);
  const [showQuestLeaderboard, setShowQuestLeaderboard] = useState(false);
  const [showQuestContinuationDialog, setShowQuestContinuationDialog] = useState(false);
  const [pendingQuest, setPendingQuest] = useState(null);
  const [questInProgress, setQuestInProgress] = useState(null);
  const [questProgress, setQuestProgress] = useState({
    completedCheckpoints: new Set(),
    skippedCheckpoints: new Set(),
    skipsUsed: 0,
    photos: {},
    aiResults: {}
  });
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [quests, setQuests] = useState([]);
  const [loadingQuests, setLoadingQuests] = useState(true);
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [completedQuest, setCompletedQuest] = useState(null);
  const [userRating, setUserRating] = useState(0);

  // Load team name from localStorage
  useEffect(() => {
    const savedTeamName = localStorage.getItem('cityQuestTeamName');
    if (savedTeamName) setTeamName(savedTeamName);
  }, []);

  // Save team name to localStorage
  useEffect(() => {
    if (teamName) localStorage.setItem('cityQuestTeamName', teamName);
  }, [teamName]);

  // Load quests from server
  useEffect(() => {
    const loadQuests = async () => {
      try {
        console.log('🔍 Loading quests from server...');
        const response = await fetch(`${SERVER_URL}/api/quests`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true'
          }
        });

        if (!response.ok) {
          console.error('❌ Failed to load quests:', response.status);
          setQuests([]);
          setLoadingQuests(false);
          return;
        }

        const questsData = await response.json();
        console.log('✅ Loaded quests:', questsData);
        setQuests(questsData);
        setLoadingQuests(false);
      } catch (error) {
        console.error('❌ Error loading quests:', error);
        setQuests([]);
        setLoadingQuests(false);
      }
    };

    loadQuests();
  }, []);

  const loadQuestData = async (quest) => {
    try {
      console.log('🔍 Loading quest data for:', quest.name, 'ID:', quest.id);
      
      // Use the string ID if available, otherwise use numeric ID
      const questId = quest.id_string || quest.id;
      const response = await fetch(`${SERVER_URL}/api/quests/${questId}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        }
      });

      if (!response.ok) {
        console.error('❌ Failed to load quest data:', response.status);
        return null;
      }

      const data = await response.json();
      
      // Parse the quest content
      const content = data.content;
      
      // Check if content is JSON (starts with {) or JavaScript (contains export)
      if (content.trim().startsWith('{')) {
        // Content is JSON
        try {
          const questData = JSON.parse(content);
          console.log('✅ Loaded quest data from JSON:', questData);
          
          // Validate quest data structure
          if (!questData || !questData.checkpoints || !Array.isArray(questData.checkpoints)) {
            console.error('❌ Invalid quest data structure:', questData);
            return null;
          }
          
          return questData;
        } catch (parseError) {
          console.error('❌ Error parsing JSON quest data:', parseError);
          return null;
        }
      } else {
        // Content is JavaScript (legacy support)
        const exportMatch = content.match(/export const (\w+) = ({[\s\S]*});/);
        if (exportMatch) {
          const questObjectStr = exportMatch[2];
          
          // Use Function constructor to safely evaluate the JavaScript object
          try {
            // Create a safe evaluation context
            const questData = new Function(`return ${questObjectStr}`)();
            console.log('✅ Loaded quest data from JS:', questData);
            
            // Validate quest data structure
            if (!questData || !questData.checkpoints || !Array.isArray(questData.checkpoints)) {
              console.error('❌ Invalid quest data structure:', questData);
              return null;
            }
            
            return questData;
          } catch (parseError) {
            console.error('❌ Error parsing JS quest data:', parseError);
            return null;
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error loading quest data:', error);
      return null;
    }
  };

  const handleStartQuest = async (quest) => {
    if (questInProgress && questStartTime && !questEndTime) {
      // Load the full quest data for the pending quest
      const questData = await loadQuestData(quest);
      if (questData) {
        setPendingQuest(questData);
        setShowQuestContinuationDialog(true);
      } else {
        alert('Failed to load quest data. Please try again.');
      }
    } else {
      // Always load the full quest data from server, don't use the quest list item
      const questData = await loadQuestData(quest);
      if (questData) {
        startNewQuest(questData);
      } else {
        alert('Failed to load quest data. Please try again.');
      }
    }
  };

  const startNewQuest = (quest) => {
    console.log('🔍 Starting new quest with data:', quest);
    
    // Validate quest data before setting it
    if (!quest || !quest.checkpoints || !Array.isArray(quest.checkpoints)) {
      console.error('❌ Invalid quest data:', quest);
      console.error('❌ Quest checkpoints:', quest?.checkpoints);
      alert('Invalid quest data. Please try again.');
      return;
    }
    
    setSelectedQuest(quest);
    setQuestInProgress(quest);
    setQuestStartTime(Date.now());
    setQuestEndTime(null);
    setShowQuestContinuationDialog(false);
    setPendingQuest(null);
    setQuestProgress({
      completedCheckpoints: new Set(),
      skippedCheckpoints: new Set(),
      skipsUsed: 0,
      photos: {},
      aiResults: {}
    });
  };

  const continueCurrentQuest = () => {
    if (questInProgress) {
      setSelectedQuest(questInProgress);
      setShowQuestContinuationDialog(false);
      setPendingQuest(null);
    }
  };

  const updateQuestProgress = (newProgress) => setQuestProgress(newProgress);

  // Function to handle return to start screen while preserving quest state
  const returnToStartScreen = () => {
    if (questInProgress && questStartTime && !questEndTime) {
      // Quest is in progress, show return dialog
      setShowReturnDialog(true);
    } else {
      // No quest in progress or quest is completed, just return to start
      setSelectedQuest(null);
      // Clear any remaining quest state
      if (questEndTime) {
        setQuestInProgress(null);
        setQuestStartTime(null);
        setQuestEndTime(null);
      }
    }
  };

  // Make the return function available globally for the quest component
  useEffect(() => {
    window.returnToStartScreen = returnToStartScreen;
    return () => {
      delete window.returnToStartScreen;
    };
  }, [questInProgress, questStartTime, questEndTime]);

  // Simple encryption function for PIN verification
  const encryptPin = (pin) => {
    // Simple XOR encryption with a key
    const key = 0x1234;
    return (parseInt(pin) ^ key).toString(16);
  };

  const verifyPin = (inputPin) => {
    const correctPin = "6113";
    const encryptedCorrectPin = encryptPin(correctPin);
    const encryptedInputPin = encryptPin(inputPin);
    return encryptedInputPin === encryptedCorrectPin;
  };

  const handleCreateQuestClick = () => {
    setShowPinDialog(true);
    setPinInput('');
    setPinError('');
  };

  const handlePinSubmit = () => {
    if (verifyPin(pinInput)) {
      setShowPinDialog(false);
      setPinInput('');
      setPinError('');
      // Navigate to quest designer
      window.location.href = '/create';
    } else {
      setPinError('Incorrect PIN. Please try again.');
      setPinInput('');
    }
  };

  const handleQuestComplete = (completionTime, waypointsCompleted) => {
    console.log('🎉 Quest completed!', { teamName, selectedQuest, completionTime, waypointsCompleted });

    if (teamName && selectedQuest) {
      const leaderboardEntry = {
        team_name: teamName,
        waypoints_completed: waypointsCompleted,
        completion_time: completionTime,
        quest_date: new Date().toLocaleDateString()
      };

      console.log('🔍 Using quest ID for leaderboard:', selectedQuest.id);
      console.log('🔍 Quest data:', selectedQuest);

      console.log('📤 Sending leaderboard entry:', leaderboardEntry);
      console.log('📤 URL:', `${SERVER_URL}/leaderboard/${selectedQuest.id}/add`);
      
      fetch(`${SERVER_URL}/leaderboard/${selectedQuest.id}/add`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify(leaderboardEntry)
      })
        .then((r) => {
          console.log('📡 Leaderboard response status:', r.status);
          console.log('📡 Leaderboard response headers:', r.headers);
          return r.json();
        })
        .then((data) => {
          console.log('📡 Leaderboard response data:', data);
          if (data.error) {
            console.error('❌ Error adding to leaderboard:', data.error);
          } else {
            console.log('✅ Leaderboard entry added successfully');
            loadQuestLeaderboard(selectedQuest.id);
          }
        })
        .catch((err) => {
          console.error('❌ Error adding to leaderboard:', err);
          console.error('❌ Error details:', err.message);
        });
    }

    // Show rating dialog for completed quest
    setCompletedQuest(selectedQuest);
    setUserRating(0);
    setShowRatingDialog(true);
  };

  const loadQuestLeaderboard = async (questId) => {
    try {
      console.log(`🔍 Loading leaderboard for quest ${questId} from ${SERVER_URL}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${SERVER_URL}/leaderboard/${questId}/get`, {
        method: 'POST',
        headers: { 
          Accept: 'application/json', 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        mode: 'cors',
        signal: controller.signal,
        body: JSON.stringify({ action: 'get' })
      });

      clearTimeout(timeoutId);

      console.log(`📡 Response status: ${response.status}`);
      console.log(`📡 Response headers:`, response.headers);

      if (!response.ok) {
        console.error(`❌ HTTP error: ${response.status} ${response.statusText}`);
        setCurrentQuestLeaderboard([]);
        return;
      }

      const responseText = await response.text();
      console.log(`📊 Raw response:`, responseText);

      if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
        console.error('❌ Server returned HTML instead of JSON');
        if (responseText.includes('ERR_NGROK_6024') || responseText.includes('ngrok.com')) {
          console.error('❌ This is an ngrok warning page. Attempting to bypass...');
          const newWindow = window.open(`${SERVER_URL}/leaderboard/${questId}`, '_blank');
          if (newWindow) {
            setTimeout(() => {
              console.log('🔄 Auto-retrying after ngrok warning...');
              loadQuestLeaderboard(questId);
            }, 3000);
            alert('Please accept the security warning in the new tab, then close it. The app will retry in 3 seconds.');
          } else {
            alert('Please visit the ngrok URL in a new tab first to accept the security warning, then try again.');
          }
        }
        setCurrentQuestLeaderboard([]);
        return;
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('❌ JSON parse error:', parseError);
        setCurrentQuestLeaderboard([]);
        return;
      }

      if (data.error) {
        console.error('Error loading leaderboard:', data.error);
        setCurrentQuestLeaderboard([]);
      } else {
        setCurrentQuestLeaderboard(data.leaderboard || []);
      }
    } catch (error) {
      console.error('Error loading leaderboard:', error);
      setCurrentQuestLeaderboard([]);
    }
  };

  const formatTime = (milliseconds) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const submitRating = async (questId, rating) => {
    try {
      console.log(`⭐ Submitting rating ${rating} for quest ${questId}`);
      console.log(`📤 URL: ${SERVER_URL}/quest/${questId}/rate`);
      
      const response = await fetch(`${SERVER_URL}/quest/${questId}/rate`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ rating })
      });

      console.log(`📡 Rating response status: ${response.status}`);

      if (!response.ok) {
        console.error('❌ Error submitting rating:', response.status);
        const errorText = await response.text();
        console.error('❌ Error response:', errorText);
        return false;
      }

      const data = await response.json();
      console.log('✅ Rating submitted successfully:', data);
      
      // Reload quests to update the rating display
      console.log('🔄 Reloading quests to update rating display...');
      const questsResponse = await fetch(`${SERVER_URL}/api/quests`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        }
      });

      if (questsResponse.ok) {
        const updatedQuests = await questsResponse.json();
        setQuests(updatedQuests);
        console.log('✅ Updated quest list with new ratings:', updatedQuests);
      } else {
        console.error('❌ Failed to reload quests:', questsResponse.status);
      }

      return true;
    } catch (error) {
      console.error('❌ Error submitting rating:', error);
      return false;
    }
  };

  const getCurrentQuestTime = () => {
    if (!questStartTime) return 0;
    const endTime = questEndTime || Date.now();
    return endTime - questStartTime;
  };

  return (
    <div
      className="app-container"
      style={{
        maxWidth: '100%',
        margin: '0 auto',
        backgroundColor: 'rgb(22, 86, 113)',
        minHeight: '100vh',
        color: 'white'
      }}
    >
      <style>{`
          body {
            background-color: rgb(22, 86, 113) !important;
            margin: 0;
            padding: 0;
          }
        `}
      </style>

      {!selectedQuest ? (
        <>
          <img
            src={OdysseusLogo}
            alt="Odysseus"
            style={{ display: 'block', margin: '0 auto 1em auto', maxWidth: '220px', width: '80%' }}
          />
          <p
            style={{
              textAlign: 'center',
              color: '#ffffff',
              fontStyle: 'italic',
              fontSize: '1.3em',
              margin: '0 0 1em 0',
              fontFamily: 'Georgia, serif'
            }}
          >
            City adventures for all ages
          </p>

          <div style={{ padding: '1em', maxWidth: '95%', margin: '0 auto' }}>
            {/* Team Name Input */}
            <label style={{ color: 'white', display: 'block', marginBottom: '0.5em' }}>Your team name:</label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value.slice(0, 15))}
              placeholder="Enter your team name..."
              maxLength={15}
              style={{
                width: '54%',
                padding: '0.5em',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: '#2d3748',
                color: 'white',
                fontSize: '1em',
                marginBottom: '1em'
              }}
            />

                         {/* Continue Quest Section */}
             {questInProgress && questStartTime && !questEndTime && (
               <div style={{ 
                 background: '#2d3748', 
                 padding: '1em', 
                 borderRadius: '8px', 
                 marginBottom: '1em',
                 border: 'none'
               }}>
                 <h3 style={{ color: '#f6ad55', margin: '0 0 0.5em 0', textAlign: 'center' }}>
                   🎯 Quest in Progress
                 </h3>
                 <p style={{ color: '#e2e8f0', marginBottom: '1em', textAlign: 'center' }}>
                   <strong>{questInProgress.name}</strong>
                 </p>
                 <div style={{ display: 'flex', justifyContent: 'center' }}>
                   <button
                     onClick={() => setSelectedQuest(questInProgress)}
                     style={{
                       padding: '0.75em 1.5em',
                       borderRadius: '6px',
                       backgroundColor: '#f6ad55',
                       color: 'white',
                       border: 'none',
                       cursor: 'pointer',
                       fontSize: '1em',
                       fontWeight: 'bold'
                     }}
                   >
                     🎯 Continue Quest
                   </button>
                 </div>
               </div>
             )}

             <h2 style={{ color: 'white', textAlign: 'center' }}>Choose Your Adventure</h2>

             <ul style={{ padding: 0, listStyle: 'none', color: 'white' }}>
              {loadingQuests ? (
                <li style={{ textAlign: 'center', padding: '2em', color: '#a0aec0' }}>
                  🔄 Loading quests...
                </li>
              ) : !quests || quests.length === 0 ? (
                <li style={{ textAlign: 'center', padding: '2em', color: '#a0aec0' }}>
                  No quests available at the moment.
                </li>
              ) : (
                quests && quests.map((q) => (
                <li
                  key={q.id}
                  style={{
                    marginBottom: '1em',
                    color: 'white',
                    background: '#2d3748',
                    borderRadius: '4px',
                    padding: '1em',
                    border: 'none',
                    margin: '1em'
                  }}
                >
                  <strong style={{ color: '#14b8fd', fontSize: '1.4em' }}>{q.name}</strong>
                  <p style={{ color: '#e2e8f0' }}>{q.description}</p>
                  
                  {/* Star Rating Display */}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    marginBottom: '0.5em',
                    gap: '0.2em'
                  }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span key={star} style={{ 
                        color: star <= q.rating ? '#fbbf24' : '#4a5568',
                        fontSize: '1.2em'
                      }}>
                        {star <= q.rating ? '★' : '☆'}
                      </span>
                    ))}
                    <span style={{ 
                      color: '#a0aec0', 
                      fontSize: '0.8em', 
                      marginLeft: '0.5em' 
                    }}>
                      ({q.rating}/5)
                    </span>
                  </div>

                  {/* Quest Details */}
                  <div
                    style={{
                      display: 'flex',
                      gap: '0.5em',
                      marginBottom: '1em',
                      justifyContent: 'center',
                      flexWrap: 'wrap'
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.2em',
                        padding: '0.2em 0.4em',
                        backgroundColor: '#4a5568',
                        borderRadius: '4px',
                        border: 'none'
                      }}
                    >
                      <span style={{ color: '#f6ad55', fontSize: '0.85em' }}>⚡</span>
                      <span style={{ color: '#e2e8f0', fontSize: '0.85em' }}>{q.difficulty}</span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.2em',
                        padding: '0.2em 0.4em',
                        backgroundColor: '#4a5568',
                        borderRadius: '4px',
                        border: 'none'
                      }}
                    >
                      <span style={{ color: '#68d391', fontSize: '0.85em' }}>⭐</span>
                      <span style={{ color: '#e2e8f0', fontSize: '0.85em' }}>{q.ageGroup}</span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.2em',
                        padding: '0.2em 0.4em',
                        backgroundColor: '#4a5568',
                        borderRadius: '4px',
                        border: 'none'
                      }}
                    >
                      <span style={{ color: '#63b3ed', fontSize: '0.85em' }}>📍</span>
                      <span style={{ color: '#e2e8f0', fontSize: '0.85em' }}>{q.distance}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5em', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button
                      onClick={() => handleStartQuest(q)}
                      disabled={!teamName.trim()}
                      style={{
                        padding: '0.5em 0.5em',
                        borderRadius: 4,
                        backgroundColor: teamName.trim() ? '#228ebb' : '#718096',
                        color: 'white',
                        border: 'none',
                        cursor: teamName.trim() ? 'pointer' : 'not-allowed',
                        fontSize: '1em',
                        opacity: teamName.trim() ? 1 : 0.6
                      }}
                    >
                      🧭 Start Quest
                    </button>
                    <button
                      onClick={() => {
                        loadQuestLeaderboard(q.id);
                        setShowQuestLeaderboard(true);
                      }}
                      style={{
                        padding: '0.5em 0.5em',
                        borderRadius: 4,
                        backgroundColor: '#228ebb',
                        color: 'white',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '1em'
                      }}
                    >
                      🏆 Leaderboard
                    </button>
                  </div>
                </li>
              ))
              )}
            </ul>

            {/* Create New Quest Button */}
            <div style={{ textAlign: 'center', marginTop: '2em', marginBottom: '1em' }}>
              <button
                onClick={handleCreateQuestClick}
                style={{
                  display: 'inline-block',
                  padding: '0.75em 1.5em',
                  backgroundColor: '#805ad5',
                  borderRadius: '6px',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1em',
                  fontWeight: 'bold',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#6b46c1'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#805ad5'}
              >
                🛠️ Create New Quest
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <LeafletCheckpointMap
            quest={selectedQuest}
            onQuestComplete={handleQuestComplete}
            questStartTime={questStartTime}
            setQuestEndTime={setQuestEndTime}
            teamName={teamName}
            questProgress={questProgress}
            updateQuestProgress={updateQuestProgress}
          />
        </>
      )}

      {/* Quest Leaderboard Modal */}
      {showQuestLeaderboard && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <div
            style={{
              background: '#1a365d',
              padding: '2em',
              borderRadius: '12px',
              maxWidth: '90%',
              maxHeight: '80%',
              overflow: 'auto',
              border: 'none'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1em' }}>
              <h2 style={{ color: 'white', margin: 0 }}>🏆 Quest Leaderboard</h2>
              <button
                onClick={() => setShowQuestLeaderboard(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#a0aec0',
                  fontSize: '1.5em',
                  cursor: 'pointer',
                  padding: '0.25em'
                }}
              >
                ✕
              </button>
            </div>

            {currentQuestLeaderboard.length === 0 ? (
              <p style={{ color: '#a0aec0', textAlign: 'center' }}>No completed quests yet. Be the first!</p>
            ) : (
              <div style={{ background: '#2d3748', borderRadius: '8px', padding: '1em' }}>
                {currentQuestLeaderboard.map((entry, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.75em',
                      marginBottom: '0.5em',
                      background: index < 3 ? '#744210' : '#4a5568',
                      borderRadius: '4px',
                      border: 'none'
                    }}
                  >
                    <div>
                      <div style={{ color: 'white', fontWeight: 'bold' }}>
                        {index + 1}. {entry.team_name}
                      </div>
                      <div style={{ color: '#a0aec0', fontSize: '0.9em' }}>
                        {entry.quest_date} • {entry.waypoints_completed} waypoints
                      </div>
                    </div>
                    <div style={{ color: '#68d391', fontWeight: 'bold', fontSize: '1.1em' }}>
                      {formatTime(entry.completion_time)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quest Continuation Dialog */}
      {showQuestContinuationDialog && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <div
            style={{
              background: '#1a365d',
              padding: '2em',
              borderRadius: '12px',
              maxWidth: '90%',
              border: 'none'
            }}
          >
            <h2 style={{ color: 'white', margin: '0 0 1em 0', textAlign: 'center' }}>
              Quest Already in Progress
            </h2>
            <p style={{ color: '#e2e8f0', marginBottom: '1.5em', textAlign: 'center' }}>
              You have a quest in progress: <strong style={{ color: '#f6ad55' }}>{questInProgress?.name}</strong>
            </p>
            <p style={{ color: '#a0aec0', marginBottom: '1.5em', textAlign: 'center', fontSize: '0.9em' }}>
              Would you like to continue your current quest or start a new one?
            </p>
            <div style={{ display: 'flex', gap: '1em', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={continueCurrentQuest}
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
                🎯 Continue Current Quest
              </button>
              <button
                onClick={() => {
                  // Clear old quest state before starting new quest
                  setQuestInProgress(null);
                  setQuestStartTime(null);
                  setQuestEndTime(null);
                  startNewQuest(pendingQuest);
                }}
                style={{
                  padding: '0.75em 1.5em',
                  borderRadius: '6px',
                  backgroundColor: '#f6ad55',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1em',
                  fontWeight: 'bold'
                }}
              >
                🆕 Start New Quest
              </button>
              <button
                onClick={() => {
                  setShowQuestContinuationDialog(false);
                  setPendingQuest(null);
                }}
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
             )}

       {/* Return to Start Screen Dialog */}
       {showReturnDialog && (
         <div
           style={{
             position: 'fixed',
             top: 0, left: 0, right: 0, bottom: 0,
             backgroundColor: 'rgba(0, 0, 0, 0.8)',
             display: 'flex',
             alignItems: 'center',
             justifyContent: 'center',
             zIndex: 1000
           }}
         >
           <div
             style={{
               background: '#1a365d',
               padding: '2em',
               borderRadius: '12px',
               maxWidth: '90%',
               border: 'none'
             }}
           >
             <h2 style={{ color: 'white', margin: '0 0 1em 0', textAlign: 'center' }}>
               Return to Start Screen?
             </h2>
             <p style={{ color: '#e2e8f0', marginBottom: '1.5em', textAlign: 'center' }}>
               You have a quest in progress: <strong style={{ color: '#f6ad55' }}>{questInProgress?.name}</strong>
             </p>
             <p style={{ color: '#a0aec0', marginBottom: '1.5em', textAlign: 'center', fontSize: '0.9em' }}>
               Your progress will be saved. You can continue this quest later or start a new one.
             </p>
             <div style={{ display: 'flex', gap: '1em', justifyContent: 'center', flexWrap: 'wrap' }}>
               <button
                 onClick={() => {
                   setShowReturnDialog(false);
                   setSelectedQuest(null);
                   // Clear quest state when returning to start
                   setQuestInProgress(null);
                   setQuestStartTime(null);
                   setQuestEndTime(null);
                 }}
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
                 🏠 Return to Start
               </button>
               <button
                 onClick={() => setShowReturnDialog(false)}
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
       )}

       {/* PIN Verification Dialog */}
       {showPinDialog && (
         <div
           style={{
             position: 'fixed',
             top: 0, left: 0, right: 0, bottom: 0,
             backgroundColor: 'rgba(0, 0, 0, 0.8)',
             display: 'flex',
             alignItems: 'center',
             justifyContent: 'center',
             zIndex: 1000
           }}
         >
           <div
             style={{
               background: '#1a365d',
               padding: '2em',
               borderRadius: '12px',
               maxWidth: '90%',
               border: 'none'
             }}
           >
             <h2 style={{ color: 'white', margin: '0 0 1em 0', textAlign: 'center' }}>
               🔐 Enter PIN
             </h2>
             <p style={{ color: '#e2e8f0', marginBottom: '1.5em', textAlign: 'center' }}>
               Please enter the 4-digit PIN to access the Quest Designer.
             </p>
             
             <div style={{ textAlign: 'center', marginBottom: '1.5em' }}>
                                <input
                   type="password"
                   value={pinInput}
                   onChange={(e) => {
                     const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                     setPinInput(value);
                     setPinError('');
                   }}
                   onKeyPress={(e) => {
                     if (e.key === 'Enter' && pinInput.length === 4) {
                       handlePinSubmit();
                     }
                   }}
                   placeholder="Enter 4-digit PIN"
                 style={{
                   padding: '0.75em',
                   fontSize: '1.2em',
                   borderRadius: '6px',
                   border: '1px solid #4a5568',
                   backgroundColor: '#2d3748',
                   color: 'white',
                   textAlign: 'center',
                   letterSpacing: '0.5em',
                   width: '120px'
                 }}
                 autoFocus
               />
             </div>
             
             {pinError && (
               <p style={{ color: '#fc8181', marginBottom: '1.5em', textAlign: 'center', fontSize: '0.9em' }}>
                 {pinError}
               </p>
             )}
             
             <div style={{ display: 'flex', gap: '1em', justifyContent: 'center', flexWrap: 'wrap' }}>
               <button
                 onClick={handlePinSubmit}
                 disabled={pinInput.length !== 4}
                 style={{
                   padding: '0.75em 1.5em',
                   borderRadius: '6px',
                   backgroundColor: pinInput.length === 4 ? '#68d391' : '#4a5568',
                   color: 'white',
                   border: 'none',
                   cursor: pinInput.length === 4 ? 'pointer' : 'not-allowed',
                   fontSize: '1em',
                   fontWeight: 'bold'
                 }}
               >
                 🔓 Submit
               </button>
               <button
                 onClick={() => {
                   setShowPinDialog(false);
                   setPinInput('');
                   setPinError('');
                 }}
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
       )}

       {/* Quest Rating Dialog */}
       {showRatingDialog && completedQuest && (
         <div
           style={{
             position: 'fixed',
             top: 0, left: 0, right: 0, bottom: 0,
             backgroundColor: 'rgba(0, 0, 0, 0.8)',
             display: 'flex',
             alignItems: 'center',
             justifyContent: 'center',
             zIndex: 1000
           }}
         >
           <div
             style={{
               background: '#1a365d',
               padding: '2em',
               borderRadius: '12px',
               maxWidth: '95%',
               minWidth: '300px',
               border: 'none',
               textAlign: 'center'
             }}
           >
             <h2 style={{ color: 'white', margin: '0 0 1em 0' }}>
               🎉 Quest Completed!
             </h2>
             <p style={{ color: '#e2e8f0', marginBottom: '1.5em' }}>
               Congratulations! You've completed <strong style={{ color: '#f6ad55' }}>{completedQuest.name}</strong>
             </p>
             
             <div style={{ marginBottom: '2em' }}>
               <p style={{ color: '#e2e8f0', marginBottom: '1em' }}>
                 How would you rate this quest?
               </p>
               <div style={{ 
                 display: 'flex', 
                 justifyContent: 'center', 
                 alignItems: 'center',
                 gap: '0.5em',
                 marginBottom: '1em',
                 padding: '1em'
               }}>
                 {[1, 2, 3, 4, 5].map((star) => (
                   <button
                     key={star}
                     onClick={() => setUserRating(star)}
                     style={{
                       background: 'none',
                       border: 'none',
                       fontSize: '3em',
                       cursor: 'pointer',
                       color: star <= userRating ? '#fbbf24' : '#4a5568',
                       transition: 'color 0.2s',
                       padding: '0.3em',
                       lineHeight: '1',
                       display: 'flex',
                       alignItems: 'center',
                       justifyContent: 'center',
                       width: '1.5em',
                       height: '1.5em'
                     }}
                   >
                     {star <= userRating ? '★' : '☆'}
                   </button>
                 ))}
               </div>
               <p style={{ color: '#a0aec0', fontSize: '0.9em' }}>
                 {userRating > 0 ? `${userRating} star${userRating > 1 ? 's' : ''}` : 'Select a rating'}
               </p>
             </div>
             
             <div style={{ display: 'flex', gap: '1em', justifyContent: 'center', flexWrap: 'wrap' }}>
               <button
                 onClick={async () => {
                   if (userRating > 0) {
                     console.log('🔍 Quest ID being used for rating:', completedQuest.id);
                     console.log('🔍 Quest data:', completedQuest);
                     const success = await submitRating(completedQuest.id, userRating);
                     if (!success) {
                       alert('Failed to submit rating. Please try again.');
                     }
                   }
                   
                   // Clear quest state and close dialog
                   setQuestEndTime(Date.now());
                   setQuestInProgress(null);
                   setQuestStartTime(null);
                   setQuestProgress({
                     completedCheckpoints: new Set(),
                     skippedCheckpoints: new Set(),
                     skipsUsed: 0,
                     photos: {},
                     aiResults: {}
                   });
                   setShowRatingDialog(false);
                   setCompletedQuest(null);
                   setUserRating(0);
                 }}
                 disabled={userRating === 0}
                 style={{
                   padding: '0.75em 1.5em',
                   borderRadius: '6px',
                   backgroundColor: userRating > 0 ? '#68d391' : '#4a5568',
                   color: 'white',
                   border: 'none',
                   cursor: userRating > 0 ? 'pointer' : 'not-allowed',
                   fontSize: '1em',
                   fontWeight: 'bold'
                 }}
               >
                 {userRating > 0 ? '⭐ Submit Rating' : 'Select Rating'}
               </button>
               <button
                 onClick={() => {
                   // Clear quest state and close dialog without rating
                   setQuestEndTime(Date.now());
                   setQuestInProgress(null);
                   setQuestStartTime(null);
                   setQuestProgress({
                     completedCheckpoints: new Set(),
                     skippedCheckpoints: new Set(),
                     skipsUsed: 0,
                     photos: {},
                     aiResults: {}
                   });
                   setShowRatingDialog(false);
                   setCompletedQuest(null);
                   setUserRating(0);
                 }}
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
                 Skip Rating
               </button>
             </div>
           </div>
         </div>
       )}

       {/* Footer */}
      <div
        style={{
          textAlign: 'center',
          padding: '1em',
          color: '#a0aec0',
          fontSize: '0.9em',
          marginTop: '1em'
        }}
      >
        © Copyright: Crazy Good Times LLC
      </div>
    </div>
  );
}

export default App;
