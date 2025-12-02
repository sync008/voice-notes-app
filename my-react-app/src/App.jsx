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
  const [hasDetectedAudio, setHasDetectedAudio] = useState(false);
  const [recognitionActive, setRecognitionActive] = useState(false);

  const recognitionRef = useRef(null);
  const isStoppedManually = useRef(false);
  const restartTimeoutRef = useRef(null);
  const lastResultTime = useRef(null);

  // Add debug log
  const addDebugLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLogs(prev => [`[${timestamp}] ${message}`, ...prev].slice(0, 15));
    console.log(message);
  };

  // Check browser support on mount
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setBrowserSupport(false);
      setError('Speech recognition is not supported on this browser. Please use Chrome.');
      addDebugLog('❌ Browser does not support speech recognition');
    } else {
      addDebugLog('✅ Browser supports speech recognition');
      addDebugLog(`📱 User Agent: ${navigator.userAgent.substring(0, 50)}...`);
    }
  }, []);

  // Initialize recognition with all event handlers
  const initRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      addDebugLog('❌ SpeechRecognition not available');
      return null;
    }

    const recognition = new SpeechRecognition();
    
    // CRITICAL: These settings work best on Android
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    
    // Try different language codes for better Android compatibility
    try {
      recognition.lang = 'en-US';
      addDebugLog('⚙️ Language set to: en-US');
    } catch (e) {
      addDebugLog('⚠️ Could not set language');
    }

    addDebugLog('⚙️ Recognition configured');

    recognition.onstart = () => {
      addDebugLog('✅✅✅ Recognition STARTED - Listening now!');
      setRecognitionActive(true);
      setError('');
      lastResultTime.current = Date.now();
    };

    recognition.onaudiostart = () => {
      addDebugLog('🎤🎤🎤 AUDIO CAPTURE STARTED - Mic is active!');
      setHasDetectedAudio(true);
    };

    recognition.onsoundstart = () => {
      addDebugLog('🔊🔊🔊 SOUND DETECTED - System hears something!');
    };

    recognition.onspeechstart = () => {
      addDebugLog('🗣️🗣️🗣️ SPEECH DETECTED - Processing your voice!');
    };

    recognition.onresult = (event) => {
      lastResultTime.current = Date.now();
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        const confidence = event.results[i][0].confidence;
        
        if (event.results[i].isFinal) {
          final += text + ' ';
          addDebugLog(`✅ FINAL: "${text}" (conf: ${confidence?.toFixed(2) || 'N/A'})`);
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
      addDebugLog('🔇 Speech ended');
    };

    recognition.onsoundend = () => {
      addDebugLog('🔇 Sound ended');
    };

    recognition.onaudioend = () => {
      addDebugLog('🔇 Audio capture ended');
      setHasDetectedAudio(false);
    };

    recognition.onerror = (event) => {
      addDebugLog(`❌❌❌ ERROR: ${event.error}`);
      
      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        setError('🚫 Microphone permission denied! Go to Chrome Settings → Site Settings → Microphone');
        setIsRecording(false);
        setRecognitionActive(false);
        isStoppedManually.current = true;
      } else if (event.error === 'no-speech') {
        addDebugLog('⚠️ No speech detected - Keep talking!');
        // Don't stop for no-speech on Android
      } else if (event.error === 'audio-capture') {
        setError('❌ Cannot access microphone! Close WhatsApp, Facebook, or other apps using the mic.');
        setIsRecording(false);
        setRecognitionActive(false);
        isStoppedManually.current = true;
      } else if (event.error === 'network') {
        setError('🌐 No internet connection! Speech recognition needs internet.');
        setIsRecording(false);
        setRecognitionActive(false);
        isStoppedManually.current = true;
      } else if (event.error === 'aborted') {
        if (!isStoppedManually.current) {
          addDebugLog('⚠️ Recognition aborted - will restart');
        }
      } else if (event.error === 'service-not-allowed') {
        setError('❌ Speech recognition service not available. Check internet connection.');
        setIsRecording(false);
        setRecognitionActive(false);
        isStoppedManually.current = true;
      }
    };

    recognition.onend = () => {
      addDebugLog('🛑 Recognition ended');
      setRecognitionActive(false);
      setInterimTranscript('');
      
      // Auto-restart if still recording and not stopped manually
      if (!isStoppedManually.current && isRecording) {
        addDebugLog('🔄 Auto-restarting in 300ms...');
        restartTimeoutRef.current = setTimeout(() => {
          if (recognitionRef.current && !isStoppedManually.current) {
            try {
              addDebugLog('🔄 Attempting restart...');
              recognitionRef.current.start();
            } catch (err) {
              addDebugLog(`❌ Restart failed: ${err.message}`);
              if (err.message.includes('already started')) {
                addDebugLog('⚠️ Recognition already running');
              } else {
                setIsRecording(false);
              }
            }
          }
        }, 300);
      } else {
        setIsRecording(false);
      }
    };

    return recognition;
  };

  // Start recording
  const startRecording = async () => {
    if (!browserSupport) return;

    addDebugLog('═══════════════════════════════════');
    addDebugLog('🎬 STARTING NEW RECORDING SESSION');
    addDebugLog('═══════════════════════════════════');
    
    setError('');
    setTranscript('');
    setInterimTranscript('');
    setHasDetectedAudio(false);
    setRecognitionActive(false);
    isStoppedManually.current = false;

    // Clear any existing timeout
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
    }

    // Stop any existing recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore
      }
      recognitionRef.current = null;
    }

    // Initialize fresh recognition
    addDebugLog('🔧 Initializing recognition...');
    const recognition = initRecognition();
    if (!recognition) {
      setError('Could not initialize speech recognition.');
      addDebugLog('❌ Recognition initialization failed');
      return;
    }

    recognitionRef.current = recognition;
    
    // Start recognition immediately
    addDebugLog('🚀 Starting recognition...');
    try {
      recognition.start();
      setIsRecording(true);
      addDebugLog('✅ Recognition.start() called successfully');
      
      // Check after 3 seconds if we got any audio
      setTimeout(() => {
        if (!hasDetectedAudio && isRecording && !isStoppedManually.current) {
          addDebugLog('⚠️⚠️⚠️ NO AUDIO DETECTED after 3 seconds!');
          addDebugLog('💡 Try these:');
          addDebugLog('   1. Speak VERY LOUDLY');
          addDebugLog('   2. Check if another app is using mic');
          addDebugLog('   3. Restart Chrome browser');
          addDebugLog('   4. Check Chrome has mic permission in Android Settings');
        }
      }, 3000);
      
    } catch (err) {
      addDebugLog(`❌ Start failed: ${err.message}`);
      setError(`Failed to start: ${err.message}`);
      setIsRecording(false);
    }
  };

  // Stop recording
  const stopRecording = () => {
    addDebugLog('⏹️⏹️⏹️ STOP BUTTON PRESSED');
    isStoppedManually.current = true;

    // Clear restart timeout
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

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
    setRecognitionActive(false);
    setInterimTranscript('');
    addDebugLog('═══════════════════════════════════');
  };

  // Save note
  const saveNote = () => {
    if (transcript.trim()) {
      onTranscriptComplete(transcript.trim());
      setTranscript('');
      setInterimTranscript('');
      addDebugLog('💾 Note saved!');
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
          Please use <strong>Chrome</strong> on Android.
        </div>
      )}

      {error && browserSupport && (
        <div style={styles.error}>
          {error}
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
        <div style={styles.statusSection}>
          <div style={styles.recordingIndicator}>
            <span style={styles.recordingDot}>●</span> 
            <span>RECORDING</span>
          </div>
          
          <div style={styles.statusGrid}>
            <div style={recognitionActive ? styles.statusActive : styles.statusInactive}>
              {recognitionActive ? '✅ Recognition Active' : '⏳ Starting...'}
            </div>
            <div style={hasDetectedAudio ? styles.statusActive : styles.statusInactive}>
              {hasDetectedAudio ? '✅ Audio Detected' : '⚠️ No Audio Yet'}
            </div>
          </div>

          {isRecording && !hasDetectedAudio && (
            <div style={styles.warningBox}>
              <strong>⚠️ No audio detected yet!</strong>
              <ul style={{margin: '0.5rem 0', paddingLeft: '1.5rem'}}>
                <li>Speak LOUDLY and clearly</li>
                <li>Make sure no other app is using the microphone</li>
                <li>Check microphone permissions in Chrome settings</li>
              </ul>
            </div>
          )}
        </div>
      )}

      {displayText && (
        <div style={styles.transcriptSection}>
          <h3 style={styles.sectionTitle}>📝 Transcript:</h3>
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
        <h3 style={styles.sectionTitle}>🔍 Debug Log:</h3>
        <div style={styles.debugBox}>
          {debugLogs.length === 0 ? (
            <div style={{color: '#666'}}>No events yet. Click "Start Recording" to begin.</div>
          ) : (
            debugLogs.map((log, idx) => (
              <div key={idx} style={styles.debugLine}>{log}</div>
            ))
          )}
        </div>
      </div>

      <div style={styles.info}>
        <p><strong>🔧 Critical Debugging Steps:</strong></p>
        <ol style={styles.infoList}>
          <li><strong>Look for "🎤 AUDIO CAPTURE STARTED"</strong> in the log - if you don't see this, the mic isn't being accessed</li>
          <li><strong>Look for "🔊 SOUND DETECTED"</strong> - if you see this, your voice IS being heard</li>
          <li><strong>If you see "✅ Recognition STARTED" but NO "🎤 AUDIO CAPTURE"</strong>:
            <ul style={{marginTop: '0.5rem'}}>
              <li>Another app is using the microphone</li>
              <li>Chrome doesn't have microphone permission</li>
              <li>Go to Android Settings → Apps → Chrome → Permissions → Microphone → Allow</li>
            </ul>
          </li>
          <li><strong>Speak VERY LOUDLY</strong> for the first test</li>
          <li>If nothing works: Close Chrome completely and reopen</li>
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
        <h1 style={styles.appTitle}>🎤 Voice Notes</h1>
        <p style={styles.subtitle}>Android-Optimized Speech Recognition</p>
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
        <p>📱 Optimized for Chrome on Android</p>
        <p style={{fontSize: '0.85rem', marginTop: '0.5rem', opacity: 0.8}}>
          Notes stored in memory • Cleared when page closes
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
    fontSize: '2rem',
    fontWeight: 'bold',
  },
  subtitle: {
    margin: '0.5rem 0 0 0',
    fontSize: '1rem',
    opacity: 0.9,
  },
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '1.5rem',
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '1.5rem',
  },
  recorder: {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  title: {
    margin: '0 0 1rem 0',
    fontSize: '1.5rem',
    color: '#333',
  },
  error: {
    backgroundColor: '#ffebee',
    color: '#c62828',
    padding: '1rem',
    borderRadius: '4px',
    marginBottom: '1rem',
    border: '2px solid #ef5350',
    lineHeight: '1.5',
    fontWeight: '500',
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
  },
  startButton: {
    backgroundColor: '#4CAF50',
    color: 'white',
    fontSize: '1.1rem',
    padding: '1rem 2rem',
  },
  stopButton: {
    backgroundColor: '#f44336',
    color: 'white',
    fontSize: '1.1rem',
    padding: '1rem 2rem',
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
  statusSection: {
    marginBottom: '1rem',
  },
  recordingIndicator: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '1rem',
    backgroundColor: '#ffebee',
    borderRadius: '4px',
    marginBottom: '1rem',
    fontSize: '1.2rem',
    color: '#d32f2f',
    fontWeight: 'bold',
    border: '2px solid #ef5350',
  },
  recordingDot: {
    color: '#f44336',
    fontSize: '1.5rem',
    animation: 'pulse 1.5s infinite',
  },
  statusGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.5rem',
    marginBottom: '1rem',
  },
  statusActive: {
    padding: '0.75rem',
    backgroundColor: '#e8f5e9',
    color: '#2e7d32',
    borderRadius: '4px',
    textAlign: 'center',
    fontWeight: '600',
    border: '2px solid #66bb6a',
  },
  statusInactive: {
    padding: '0.75rem',
    backgroundColor: '#fff3e0',
    color: '#e65100',
    borderRadius: '4px',
    textAlign: 'center',
    fontWeight: '600',
    border: '2px solid #ffb74d',
  },
  warningBox: {
    padding: '1rem',
    backgroundColor: '#fff3e0',
    borderRadius: '4px',
    border: '2px solid #ff9800',
    color: '#e65100',
    fontSize: '0.95rem',
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
    backgroundColor: '#263238',
    borderRadius: '4px',
  },
  debugBox: {
    backgroundColor: '#1e1e1e',
    color: '#00ff00',
    padding: '1rem',
    borderRadius: '4px',
    fontFamily: 'monospace',
    fontSize: '0.8rem',
    maxHeight: '300px',
    overflowY: 'auto',
    lineHeight: '1.4',
  },
  debugLine: {
    marginBottom: '0.2rem',
  },
  info: {
    marginTop: '1.5rem',
    padding: '1rem',
    backgroundColor: '#e3f2fd',
    borderRadius: '4px',
    fontSize: '0.9rem',
    color: '#1565c0',
    border: '2px solid #64b5f6',
  },
  infoList: {
    margin: '0.5rem 0 0 0',
    paddingLeft: '1.5rem',
    lineHeight: '1.8',
  },
  notesList: {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  notesHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  emptyState: {
    textAlign: 'center',
    padding: '2rem 1rem',
    color: '#999',
    fontSize: '1rem',
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