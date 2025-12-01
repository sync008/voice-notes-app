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
  const [debugLogs, setDebugLogs] = useState([]);
  const [micPermissionGranted, setMicPermissionGranted] = useState(false);

  const recognitionRef = useRef(null);
  const isStoppedManually = useRef(false);
  const hasStartedSuccessfully = useRef(false);

  // Add debug log
  const addDebugLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLogs(prev => [`[${timestamp}] ${message}`, ...prev].slice(0, 10));
    console.log(message);
  };

  // Check browser support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setBrowserSupport(false);
      setError('Speech recognition is not supported on this browser. Please use Chrome.');
      addDebugLog('❌ Browser does not support speech recognition');
    } else {
      addDebugLog('✅ Browser supports speech recognition');
    }
  }, []);

  // Test microphone access
  const testMicrophone = async () => {
    addDebugLog('🔍 Testing microphone access...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      addDebugLog('✅ Microphone access granted!');
      setMicPermissionGranted(true);
      
      // Stop the stream
      stream.getTracks().forEach(track => {
        track.stop();
        addDebugLog('🎤 Microphone track stopped');
      });
      
      return true;
    } catch (err) {
      addDebugLog(`❌ Microphone error: ${err.message}`);
      setError(`Microphone access failed: ${err.message}`);
      return false;
    }
  };

  // Initialize recognition
  const initRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      addDebugLog('❌ SpeechRecognition not available');
      return null;
    }

    const recognition = new SpeechRecognition();
    
    // Android Chrome optimized settings
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = 'en-US';

    addDebugLog('⚙️ Recognition configured: continuous=true, lang=en-US');

    recognition.onstart = () => {
      addDebugLog('✅ Recognition STARTED - Microphone is now listening');
      hasStartedSuccessfully.current = true;
      setError('');
      setIsRecording(true);
    };

    recognition.onaudiostart = () => {
      addDebugLog('🎤 Audio capture started - Sound is being captured');
    };

    recognition.onsoundstart = () => {
      addDebugLog('🔊 Sound detected by microphone');
    };

    recognition.onspeechstart = () => {
      addDebugLog('🗣️ Speech detected - Processing your words...');
    };

    recognition.onresult = (event) => {
      addDebugLog(`📝 Got ${event.results.length} result(s)`);
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        const confidence = event.results[i][0].confidence;
        
        if (event.results[i].isFinal) {
          final += text + ' ';
          addDebugLog(`✅ FINAL: "${text}" (confidence: ${confidence?.toFixed(2) || 'N/A'})`);
        } else {
          interim += text;
          addDebugLog(`⏳ INTERIM: "${text}"`);
        }
      }

      if (final) {
        setTranscript(prev => prev + final);
      }
      setInterimTranscript(interim);
    };

    recognition.onspeechend = () => {
      addDebugLog('🔇 Speech ended - No more speech detected');
    };

    recognition.onsoundend = () => {
      addDebugLog('🔇 Sound ended - No more sound detected');
    };

    recognition.onaudioend = () => {
      addDebugLog('🔇 Audio capture ended');
    };

    recognition.onerror = (event) => {
      addDebugLog(`❌ ERROR: ${event.error} - ${event.message || 'No message'}`);
      
      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        setError('Microphone permission denied. Please allow microphone access in Chrome settings.');
        setIsRecording(false);
        isStoppedManually.current = true;
      } else if (event.error === 'no-speech') {
        addDebugLog('⚠️ No speech detected - Make sure you are speaking clearly');
      } else if (event.error === 'audio-capture') {
        setError('Cannot access microphone. Please check if another app is using it.');
        setIsRecording(false);
        isStoppedManually.current = true;
      } else if (event.error === 'network') {
        setError('Network error. Speech recognition needs internet connection.');
        setIsRecording(false);
        isStoppedManually.current = true;
      } else if (event.error === 'aborted') {
        if (!isStoppedManually.current) {
          addDebugLog('⚠️ Recognition aborted unexpectedly');
        }
      }
    };

    recognition.onend = () => {
      addDebugLog('🛑 Recognition ended');
      setInterimTranscript('');
      
      // Auto-restart if still recording
      if (!isStoppedManually.current && hasStartedSuccessfully.current) {
        addDebugLog('🔄 Attempting to restart...');
        setTimeout(() => {
          try {
            if (recognitionRef.current) {
              recognitionRef.current.start();
            }
          } catch (err) {
            addDebugLog(`❌ Restart failed: ${err.message}`);
            setIsRecording(false);
          }
        }, 100);
      } else {
        setIsRecording(false);
      }
    };

    return recognition;
  };

  // Start recording
  const startRecording = async () => {
    if (!browserSupport) return;

    addDebugLog('🎬 Starting recording process...');
    setError('');
    setTranscript('');
    setInterimTranscript('');
    isStoppedManually.current = false;
    hasStartedSuccessfully.current = false;

    // First test microphone
    const micOk = await testMicrophone();
    if (!micOk) {
      addDebugLog('❌ Cannot proceed - microphone test failed');
      return;
    }

    // Wait a bit for Android
    await new Promise(resolve => setTimeout(resolve, 500));

    // Initialize recognition
    const recognition = initRecognition();
    if (!recognition) {
      setError('Could not initialize speech recognition.');
      addDebugLog('❌ Recognition initialization failed');
      return;
    }

    recognitionRef.current = recognition;
    
    try {
      addDebugLog('🎤 Calling recognition.start()...');
      recognition.start();
    } catch (err) {
      addDebugLog(`❌ Start failed: ${err.message}`);
      setError('Failed to start recording. Please try again.');
    }
  };

  // Stop recording
  const stopRecording = () => {
    addDebugLog('⏹️ Stopping recording...');
    isStoppedManually.current = true;
    hasStartedSuccessfully.current = false;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        addDebugLog('✅ Recognition stopped');
      } catch (err) {
        addDebugLog(`⚠️ Stop error: ${err.message}`);
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
      addDebugLog('💾 Note saved');
    }
  };

  // Discard transcript
  const discardTranscript = () => {
    setTranscript('');
    setInterimTranscript('');
    addDebugLog('🗑️ Transcript discarded');
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
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
          Please use <strong>Chrome</strong> on Android.
        </div>
      )}

      {error && browserSupport && (
        <div style={styles.error}>
          ⚠️ {error}
        </div>
      )}

      {micPermissionGranted && (
        <div style={styles.success}>
          ✅ Microphone permission granted
        </div>
      )}

      <div style={styles.controls}>
        {!isRecording ? (
          <>
            <button
              onClick={startRecording}
              style={{...styles.button, ...styles.startButton}}
              disabled={!browserSupport}
            >
              ▶ Start Recording
            </button>
            <button
              onClick={testMicrophone}
              style={{...styles.button, ...styles.testButton}}
              disabled={!browserSupport}
            >
              🔍 Test Mic
            </button>
          </>
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
          <span>Recording... Speak clearly and loudly</span>
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

      <div style={styles.debugSection}>
        <h3 style={styles.sectionTitle}>🔍 Debug Log (Last 10 events):</h3>
        <div style={styles.debugBox}>
          {debugLogs.length === 0 ? (
            <div style={{color: '#999'}}>No events yet. Click "Start Recording" to begin.</div>
          ) : (
            debugLogs.map((log, idx) => (
              <div key={idx} style={styles.debugLine}>{log}</div>
            ))
          )}
        </div>
      </div>

      <div style={styles.info}>
        <p><strong>Troubleshooting Tips:</strong></p>
        <ol style={styles.infoList}>
          <li><strong>Click "Test Mic" first</strong> to verify microphone works</li>
          <li>Look for "🔊 Sound detected" in the debug log when you speak</li>
          <li>If no sound is detected, try speaking LOUDER</li>
          <li>Make sure Chrome has microphone permission in Android settings</li>
          <li>Close other apps that might be using the microphone</li>
          <li>Try restarting Chrome if nothing works</li>
        </ol>
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
        <p>Optimized for Chrome on Android</p>
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
  success: {
    backgroundColor: '#e8f5e9',
    color: '#2e7d32',
    padding: '1rem',
    borderRadius: '4px',
    marginBottom: '1rem',
    border: '1px solid #81c784',
    lineHeight: '1.5',
  },
  controls: {
    display: 'flex',
    gap: '1rem',
    marginBottom: '1rem',
    flexWrap: 'wrap',
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
  testButton: {
    backgroundColor: '#2196F3',
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
  debugSection: {
    marginTop: '1.5rem',
    padding: '1rem',
    backgroundColor: '#f0f0f0',
    borderRadius: '4px',
    border: '1px solid #ddd',
  },
  debugBox: {
    backgroundColor: '#1e1e1e',
    color: '#00ff00',
    padding: '1rem',
    borderRadius: '4px',
    fontFamily: 'monospace',
    fontSize: '0.85rem',
    maxHeight: '300px',
    overflowY: 'auto',
    lineHeight: '1.5',
  },
  debugLine: {
    marginBottom: '0.25rem',
  },
  info: {
    marginTop: '1.5rem',
    padding: '1rem',
    backgroundColor: '#e3f2fd',
    borderRadius: '4px',
    fontSize: '0.95rem',
    color: '#1565c0',
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