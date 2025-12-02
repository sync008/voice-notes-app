import React, { useState, useRef, useEffect } from 'react';
import './App.css';

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
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    
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

    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore
      }
      recognitionRef.current = null;
    }

    addDebugLog('🔧 Initializing recognition...');
    const recognition = initRecognition();
    if (!recognition) {
      setError('Could not initialize speech recognition.');
      addDebugLog('❌ Recognition initialization failed');
      return;
    }

    recognitionRef.current = recognition;
    
    addDebugLog('🚀 Starting recognition...');
    try {
      recognition.start();
      setIsRecording(true);
      addDebugLog('✅ Recognition.start() called successfully');
      
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
    <div className="recorder">
      <h2 className="title">🎤 Voice Recorder</h2>

      {!browserSupport && (
        <div className="error">
          ⚠️ Speech recognition is not supported on this browser. 
          <br />
          Please use <strong>Chrome</strong> on Android.
        </div>
      )}

      {error && browserSupport && (
        <div className="error">
          {error}
        </div>
      )}

      <div className="controls">
        {!isRecording ? (
          <button
            onClick={startRecording}
            className="button start-button"
            disabled={!browserSupport}
          >
            ▶ Start Recording
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="button stop-button"
          >
            ⏹ Stop Recording
          </button>
        )}
      </div>

      {isRecording && (
        <div className="status-section">
          <div className="recording-indicator">
            <span className="recording-dot">●</span> 
            <span>RECORDING</span>
          </div>
          
          <div className="status-grid">
            <div className={recognitionActive ? 'status-active' : 'status-inactive'}>
              {recognitionActive ? '✅ Recognition Active' : '⏳ Starting...'}
            </div>
            <div className={hasDetectedAudio ? 'status-active' : 'status-inactive'}>
              {hasDetectedAudio ? '✅ Audio Detected' : '⚠️ No Audio Yet'}
            </div>
          </div>

          {isRecording && !hasDetectedAudio && (
            <div className="warning-box">
              <strong>⚠️ No audio detected yet!</strong>
              <ul>
                <li>Speak LOUDLY and clearly</li>
                <li>Make sure no other app is using the microphone</li>
                <li>Check microphone permissions in Chrome settings</li>
              </ul>
            </div>
          )}
        </div>
      )}

      {displayText && (
        <div className="transcript-section">
          <h3 className="section-title">📝 Transcript:</h3>
          <div className="transcript-box">
            {transcript}
            {interimTranscript && (
              <span className="interim-text"> {interimTranscript}</span>
            )}
          </div>
          {!isRecording && transcript && (
            <div className="transcript-actions">
              <button
                onClick={saveNote}
                className="button save-button"
              >
                💾 Save as Note
              </button>
              <button
                onClick={discardTranscript}
                className="button discard-button"
              >
                🗑️ Discard
              </button>
            </div>
          )}
        </div>
      )}

      <div className="debug-section">
        <h3 className="section-title">🔍 Debug Log:</h3>
        <div className="debug-box">
          {debugLogs.length === 0 ? (
            <div className="debug-empty">No events yet. Click "Start Recording" to begin.</div>
          ) : (
            debugLogs.map((log, idx) => (
              <div key={idx} className="debug-line">{log}</div>
            ))
          )}
        </div>
      </div>

      <div className="info">
        <p><strong>🔧 Critical Debugging Steps:</strong></p>
        <ol className="info-list">
          <li><strong>Look for "🎤 AUDIO CAPTURE STARTED"</strong> in the log - if you don't see this, the mic isn't being accessed</li>
          <li><strong>Look for "🔊 SOUND DETECTED"</strong> - if you see this, your voice IS being heard</li>
          <li><strong>If you see "✅ Recognition STARTED" but NO "🎤 AUDIO CAPTURE"</strong>:
            <ul>
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
    <div className="notes-list">
      <div className="notes-header">
        <h2 className="title">📝 My Notes ({notes.length})</h2>
        {notes.length > 0 && (
          <button
            onClick={onClearAll}
            className="button clear-button"
          >
            Clear All
          </button>
        )}
      </div>

      {notes.length === 0 ? (
        <div className="empty-state">
          <p>No notes yet. Start recording to create your first note!</p>
        </div>
      ) : (
        <div className="notes-grid">
          {notes.map(note => (
            <div key={note.id} className="note-card">
              <div className="note-header">
                <span className="note-date">{formatDate(note.createdAt)}</span>
                <button
                  onClick={() => onDeleteNote(note.id)}
                  className="button delete-button"
                  title="Delete note"
                >
                  ✕
                </button>
              </div>
              <div className="note-text">
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
    <div className="app">
      <header className="header">
        <h1 className="app-title">🎤 Voice Notes</h1>
        <p className="subtitle">Android-Optimized Speech Recognition</p>
      </header>

      <div className="container">
        <Recorder onTranscriptComplete={handleTranscriptComplete} />
        <NotesList 
          notes={notes} 
          onDeleteNote={deleteNote}
          onClearAll={handleClearAll}
        />
      </div>

      <footer className="footer">
        <p>📱 Optimized for Chrome on Android</p>
        <p className="footer-note">
          Notes stored in memory • Cleared when page closes
        </p>
      </footer>
    </div>
  );
};

export default App;