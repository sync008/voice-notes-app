import React, { useState, useRef, useEffect } from 'react';

// ============================================================
// CUSTOM HOOK: useLocalNotes
// ============================================================
const useLocalNotes = () => {
  const [notes, setNotes] = useState([]);

  const addNote = (text) => {
    const newNote = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };
    setNotes(prev => [newNote, ...prev]);
    return newNote;
  };

  const deleteNote = (id) => {
    setNotes(prev => prev.filter(note => note.id !== id));
  };

  const clearAllNotes = () => {
    setNotes([]);
  };

  return { notes, addNote, deleteNote, clearAllNotes };
};

// ============================================================
// COMPONENT: Recorder
// ============================================================
const Recorder = ({ onTranscriptComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState('');
  const [browserSupport, setBrowserSupport] = useState(true);

  const recognitionRef = useRef(null);
  const restartTimeoutRef = useRef(null);
  const isStoppedManually = useRef(false);

  // Check browser support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setBrowserSupport(false);
      setError('Speech recognition is not supported on this browser. Please use Chrome, Safari, or Edge.');
    }
  }, []);

  // Initialize recognition
  const initRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    const recognition = new SpeechRecognition();
    
    // Mobile-optimized settings
    recognition.continuous = false; // Better for mobile - restart manually
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      console.log('Speech recognition started');
      setError('');
    };

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript + ' ';
        } else {
          interim += transcript;
        }
      }

      if (final) {
        setTranscript(prev => prev + final);
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      
      // Handle specific errors
      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        setError('Microphone permission denied. Please go to Chrome Settings > Site Settings > Microphone and allow access for this site, then reload the page.');
        setIsRecording(false);
        isStoppedManually.current = true;
      } else if (event.error === 'no-speech') {
        // Don't show error on Android, just continue
        console.log('No speech detected, will restart...');
      } else if (event.error === 'aborted') {
        // Ignore aborted errors unless manually stopped
        if (!isStoppedManually.current) {
          console.log('Recognition aborted, will restart...');
        }
      } else if (event.error === 'audio-capture') {
        setError('Microphone error. Please check that your microphone is working and not being used by another app.');
        setIsRecording(false);
        isStoppedManually.current = true;
      } else if (event.error === 'network') {
        setError('Network error. Speech recognition requires an internet connection.');
        setIsRecording(false);
        isStoppedManually.current = true;
      } else if (event.error === 'service-not-allowed') {
        setError('Speech recognition service is not available. Please reload the page and try again.');
        setIsRecording(false);
        isStoppedManually.current = true;
      } else {
        console.log('Recognition error:', event.error);
      }
    };

    recognition.onend = () => {
      console.log('Speech recognition ended');
      setInterimTranscript('');
      
      // Auto-restart if still recording and not stopped manually
      if (isRecording && !isStoppedManually.current) {
        restartTimeoutRef.current = setTimeout(() => {
          try {
            if (recognitionRef.current && isRecording) {
              recognitionRef.current.start();
            }
          } catch (err) {
            console.log('Could not restart recognition:', err);
          }
        }, 300); // Small delay before restart
      }
    };

    return recognition;
  };

  // Start recording
  const startRecording = async () => {
    if (!browserSupport) return;

    try {
      setError('');
      setTranscript('');
      setInterimTranscript('');
      isStoppedManually.current = false;

      // Initialize recognition FIRST (before permission check)
      const recognition = initRecognition();
      if (!recognition) {
        setError('Could not initialize speech recognition.');
        return;
      }

      recognitionRef.current = recognition;
      
      // Add a small delay for Android Chrome stability
      await new Promise(resolve => setTimeout(resolve, 100));
      
      try {
        recognition.start();
        setIsRecording(true);
      } catch (err) {
        console.error('Error starting recognition:', err);
        // If it's an "already started" error, ignore it
        if (err.message && err.message.includes('already started')) {
          setIsRecording(true);
        } else {
          setError('Failed to start recording. Please reload the page and try again.');
        }
      }

    } catch (err) {
      console.error('Error in startRecording:', err);
      setError('An unexpected error occurred. Please try again.');
    }
  };

  // Stop recording
  const stopRecording = () => {
    isStoppedManually.current = true;
    
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.log('Error stopping recognition:', err);
      }
      recognitionRef.current = null;
    }

    setIsRecording(false);
    setInterimTranscript('');
  };

  // Save note
  const saveNote = () => {
    if (transcript.trim()) {
      onTranscriptComplete(transcript.trim());
      setTranscript('');
      setInterimTranscript('');
    }
  };

  // Discard transcript
  const discardTranscript = () => {
    setTranscript('');
    setInterimTranscript('');
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore
        }
      }
    };
  }, []);

  const displayText = transcript + (interimTranscript ? ` ${interimTranscript}` : '');

  return (
    <div style={styles.recorder}>
      <h2 style={styles.title}>🎤 Voice Recorder</h2>

      {!browserSupport && (
        <div style={styles.error}>
          ⚠️ Speech recognition is not supported on this browser. 
          <br />
          Please use <strong>Chrome</strong> (Android) or <strong>Safari</strong> (iPhone).
        </div>
      )}

      {error && browserSupport && (
        <div style={styles.error}>
          ⚠️ {error}
        </div>
      )}

      <div style={styles.controls}>
        {!isRecording ? (
          <button
            onClick={startRecording}
            style={{...styles.button, ...styles.startButton}}
            disabled={!browserSupport}
          >
            ▶ Start Recording
          </button>
        ) : (
          <button
            onClick={stopRecording}
            style={{...styles.button, ...styles.stopButton}}
          >
            ⏹ Stop Recording
          </button>
        )}
      </div>

      {isRecording && (
        <div style={styles.recordingIndicator}>
          <span style={styles.recordingDot}>●</span> 
          <span>Listening... Speak now</span>
        </div>
      )}

      {displayText && (
        <div style={styles.transcriptSection}>
          <h3 style={styles.sectionTitle}>Transcript:</h3>
          <div style={styles.transcriptBox}>
            {transcript}
            {interimTranscript && (
              <span style={{color: '#999', fontStyle: 'italic'}}> {interimTranscript}</span>
            )}
          </div>
          {!isRecording && transcript && (
            <div style={styles.transcriptActions}>
              <button
                onClick={saveNote}
                style={{...styles.button, ...styles.saveButton}}
              >
                💾 Save as Note
              </button>
              <button
                onClick={discardTranscript}
                style={{...styles.button, ...styles.discardButton}}
              >
                🗑️ Discard
              </button>
            </div>
          )}
        </div>
      )}

      <div style={styles.info}>
        <p><strong>How to use:</strong></p>
        <ol style={styles.infoList}>
          <li>Click "Start Recording" and allow microphone access</li>
          <li>Start speaking clearly</li>
          <li>Your words will appear as you speak</li>
          <li>Click "Stop Recording" when finished</li>
          <li>Save or discard your note</li>
        </ol>
        <div style={styles.tips}>
          <p><strong>Tips for best results:</strong></p>
          <ul style={styles.infoList}>
            <li>Use Chrome on Android or Safari on iPhone</li>
            <li>Speak clearly and at a normal pace</li>
            <li>Reduce background noise</li>
            <li>Keep sentences short for better accuracy</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// COMPONENT: NotesList
// ============================================================
const NotesList = ({ notes, onDeleteNote, onClearAll }) => {
  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div style={styles.notesList}>
      <div style={styles.notesHeader}>
        <h2 style={styles.title}>📝 My Notes ({notes.length})</h2>
        {notes.length > 0 && (
          <button
            onClick={onClearAll}
            style={{...styles.button, ...styles.clearButton}}
          >
            Clear All
          </button>
        )}
      </div>

      {notes.length === 0 ? (
        <div style={styles.emptyState}>
          <p>No notes yet. Start recording to create your first note!</p>
        </div>
      ) : (
        <div style={styles.notesGrid}>
          {notes.map(note => (
            <div key={note.id} style={styles.noteCard}>
              <div style={styles.noteHeader}>
                <span style={styles.noteDate}>{formatDate(note.createdAt)}</span>
                <button
                  onClick={() => onDeleteNote(note.id)}
                  style={{...styles.button, ...styles.deleteButton}}
                  title="Delete note"
                >
                  ✕
                </button>
              </div>
              <div style={styles.noteText}>
                {note.text}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================
// MAIN APP
// ============================================================
const App = () => {
  const { notes, addNote, deleteNote, clearAllNotes } = useLocalNotes();

  const handleTranscriptComplete = (text) => {
    if (text) {
      addNote(text);
    }
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to delete all notes? This cannot be undone.')) {
      clearAllNotes();
    }
  };

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <h1 style={styles.appTitle}>Voice Notes App</h1>
        <p style={styles.subtitle}>Record your thoughts with speech-to-text</p>
      </header>

      <div style={styles.container}>
        <Recorder onTranscriptComplete={handleTranscriptComplete} />
        <NotesList 
          notes={notes} 
          onDeleteNote={deleteNote}
          onClearAll={handleClearAll}
        />
      </div>

      <footer style={styles.footer}>
        <p>Works on Chrome (Android) • Safari (iPhone) • Edge</p>
        <p style={{fontSize: '0.85rem', marginTop: '0.5rem', opacity: 0.8}}>
          Notes stored in memory • Will clear when page closes
        </p>
      </footer>
    </div>
  );
};

// ============================================================
// STYLES
// ============================================================
const styles = {
  app: {
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif',
  },
  header: {
    backgroundColor: '#4CAF50',
    color: 'white',
    padding: '2rem',
    textAlign: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  appTitle: {
    margin: 0,
    fontSize: '2.5rem',
    fontWeight: 'bold',
  },
  subtitle: {
    margin: '0.5rem 0 0 0',
    fontSize: '1.1rem',
    opacity: 0.9,
  },
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '2rem',
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '2rem',
  },
  recorder: {
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  title: {
    margin: '0 0 1.5rem 0',
    fontSize: '1.5rem',
    color: '#333',
  },
  error: {
    backgroundColor: '#ffebee',
    color: '#c62828',
    padding: '1rem',
    borderRadius: '4px',
    marginBottom: '1rem',
    border: '1px solid #ef9a9a',
    lineHeight: '1.5',
  },
  controls: {
    display: 'flex',
    gap: '1rem',
    marginBottom: '1rem',
  },
  button: {
    padding: '0.75rem 1.5rem',
    fontSize: '1rem',
    fontWeight: '600',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    outline: 'none',
  },
  startButton: {
    backgroundColor: '#4CAF50',
    color: 'white',
  },
  stopButton: {
    backgroundColor: '#f44336',
    color: 'white',
  },
  saveButton: {
    backgroundColor: '#2196F3',
    color: 'white',
  },
  discardButton: {
    backgroundColor: '#757575',
    color: 'white',
  },
  clearButton: {
    backgroundColor: '#ff9800',
    color: 'white',
    fontSize: '0.9rem',
    padding: '0.5rem 1rem',
  },
  deleteButton: {
    backgroundColor: '#f44336',
    color: 'white',
    fontSize: '1.2rem',
    padding: '0.25rem 0.5rem',
    minWidth: 'auto',
  },
  recordingIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '1rem',
    backgroundColor: '#fff3e0',
    borderRadius: '4px',
    marginBottom: '1rem',
    fontSize: '1rem',
    color: '#e65100',
    fontWeight: '600',
  },
  recordingDot: {
    color: '#f44336',
    fontSize: '1.5rem',
    animation: 'pulse 1.5s infinite',
  },
  transcriptSection: {
    marginTop: '1.5rem',
    padding: '1rem',
    backgroundColor: '#f9f9f9',
    borderRadius: '4px',
    border: '1px solid #e0e0e0',
  },
  sectionTitle: {
    margin: '0 0 0.75rem 0',
    fontSize: '1.1rem',
    color: '#555',
  },
  transcriptBox: {
    backgroundColor: 'white',
    padding: '1rem',
    borderRadius: '4px',
    border: '1px solid #ddd',
    minHeight: '100px',
    marginBottom: '1rem',
    fontSize: '1rem',
    lineHeight: '1.6',
    color: '#333',
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
  },
  transcriptActions: {
    display: 'flex',
    gap: '1rem',
  },
  info: {
    marginTop: '1.5rem',
    padding: '1rem',
    backgroundColor: '#e3f2fd',
    borderRadius: '4px',
    fontSize: '0.95rem',
    color: '#1565c0',
  },
  tips: {
    marginTop: '1rem',
    paddingTop: '1rem',
    borderTop: '1px solid #bbdefb',
  },
  infoList: {
    margin: '0.5rem 0 0 0',
    paddingLeft: '1.5rem',
  },
  notesList: {
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  notesHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
  },
  emptyState: {
    textAlign: 'center',
    padding: '3rem 1rem',
    color: '#999',
    fontSize: '1.1rem',
  },
  notesGrid: {
    display: 'grid',
    gap: '1rem',
  },
  noteCard: {
    backgroundColor: '#fafafa',
    border: '1px solid #e0e0e0',
    borderRadius: '6px',
    padding: '1rem',
    transition: 'box-shadow 0.2s',
  },
  noteHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.75rem',
  },
  noteDate: {
    fontSize: '0.85rem',
    color: '#757575',
    fontWeight: '500',
  },
  noteText: {
    fontSize: '1rem',
    lineHeight: '1.6',
    color: '#333',
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
  },
  footer: {
    textAlign: 'center',
    padding: '2rem',
    color: '#757575',
    fontSize: '0.9rem',
  },
};

// Add animations
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
`;
document.head.appendChild(styleSheet);

export default App;