
import { useState } from 'react';
import LeafletCheckpointMap from './LeafletCheckpointMap';
import './App.css';
import OdysseusLogo from './assets/Odysseus.png';

const QUESTS = [
  { id: 1, name: 'Historic Landmarks', description: 'Visit famous city spots.' },
  { id: 2, name: 'Art & Culture', description: 'Find murals and galleries.' },
  { id: 3, name: 'Foodie Adventure', description: 'Taste local cuisine.' },
];

function App() {
  const [selectedQuest, setSelectedQuest] = useState(null);

  return (
    <div className="app-container" style={{ maxWidth: 480, margin: '0 auto', padding: '1em' }}>
      <img src={OdysseusLogo} alt="Odysseus" style={{ display: 'block', margin: '0 auto 1em auto', maxWidth: '220px', width: '80%' }} />
      {!selectedQuest ? (
        <>
          <h2>Choose Your Quest</h2>
          <ul style={{ padding: 0, listStyle: 'none', color: '#222', border: '1px solid #bbb', background: '#f9f9f9', borderRadius: '8px' }}>
            {QUESTS.map(q => (
              <li key={q.id} style={{ marginBottom: '1em', color: '#222', background: '#fff', borderRadius: '4px', padding: '1em', border: '1px solid #ddd' }}>
                <strong style={{ color: '#0057b7' }}>{q.name}</strong>
                <p>{q.description}</p>
                <button onClick={() => setSelectedQuest(q)} style={{ padding: '0.5em 1em', borderRadius: 4 }}>Start Quest</button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <button onClick={() => setSelectedQuest(null)} style={{ marginBottom: '1em' }}>← Back</button>
          <h2>{selectedQuest.name}</h2>
          <p>{selectedQuest.description}</p>
          <LeafletCheckpointMap />
        </>
      )}
    </div>
  );
}

export default App;
