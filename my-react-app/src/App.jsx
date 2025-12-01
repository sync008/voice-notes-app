import React, { useState, useRef, useEffect } from 'react';

// ============================================================
// CUSTOM HOOK: useLocalNotes
// Manages notes in localStorage with CRUD operations
// ============================================================
const useLocalNotes = () => {
  const STORAGE_KEY = 'voice_notes';

  // Initialize notes from localStorage
  const [notes, setNotes] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading notes from localStorage:', error);
      return [];
    }
  });

  // Sync notes to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    } catch (error) {
      console.error('Error saving notes to localStorage:', error);
    }
  }, [notes]);

  // Add a new note
  const addNote = (text) => {
    const newNote = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };
    setNotes(prev => [newNote, ...prev]);
    return newNote;
  };

  // Delete a note by ID
  const deleteNote = (id) => {
    setNotes(prev => prev.filter(note => note.id !== id));
  };

  // Clear all notes
  const clearAllNotes = () => {
    setNotes([]);
  };

  return { notes, addNote, deleteNote, clearAllNotes };
};

// ============================================================
// COMPONENT: Recorder
// Handles voice recording and speech-to-text conversion
// ============================================================
const Recorder = ({ onTranscriptComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const [isListening, setIsListening] = useState(false);

  const mediaRecorderRef = useRef(null);
  const recognitionRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Initialize Speech Recognition
  useEffect(() => {
    // Check if browser supports Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setError('Speech Recognition is not supported in this browser. Please use Chrome, Edge, or another Chromium-based browser.');
      return;
    }

    // Create recognition instance
    const recognition = new SpeechRecognition();
    recognition.continuous = true; // Keep listening until stopped
    recognition.interimResults = true; // Show interim results as user speaks
    recognition.lang = 'en-US'; // Set language

    // Handle speech recognition results
    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      // Process all results
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptPiece = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcriptPiece + ' ';
        } else {
          interimTranscript += transcriptPiece;
        }
      }

      // Update transcript with final + interim results
      setTranscript(prev => {
        const base = prev + finalTranscript;
        return base + (interimTranscript ? `[${interimTranscript}]` : '');
      });
    };

    // Handle recognition errors
    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setError(`Recognition error: ${event.error}`);
      setIsListening(false);
    };

    // Handle recognition end
    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    // Cleanup
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Start recording audio and speech recognition
  const startRecording = async () => {
    try {
      setError('');
      setTranscript('');
      audioChunksRef.current = [];

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Setup MediaRecorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      // Collect audio data chunks
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Handle recording stop
      mediaRecorder.onstop = () => {
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
        
        // Clean up interim results markers
        setTranscript(prev => prev.replace(/\[.*?\]/g, '').trim());
      };

      // Start recording
      mediaRecorder.start();
      setIsRecording(true);

      // Start speech recognition
      if (recognitionRef.current) {
        recognitionRef.current.start();
        setIsListening(true);
      }

    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Failed to access microphone. Please grant permission and try again.');
    }
  };

  // Stop recording and speech recognition
  const stopRecording = () => {
    // Stop MediaRecorder
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }

    // Stop Speech Recognition
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  // Save transcript as a note
  const saveNote = () => {
    const cleanTranscript = transcript.replace(/\[.*?\]/g, '').trim();
    if (cleanTranscript) {
      onTranscriptComplete(cleanTranscript);
      setTranscript('');
    }
  };

  // Discard current transcript
  const discardTranscript = () => {
    setTranscript('');
  };

  return (
    <div style={styles.recorder}>
      <h2 style={styles.title}>🎤 Voice Recorder</h2>

      {error && (
        <div style={styles.error}>
          ⚠️ {error}
        </div>
      )}

      <div style={styles.controls}>
        {!isRecording ? (
          <button
            onClick={startRecording}
            style={{...styles.button, ...styles.startButton}}
            disabled={!!error}
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
          <span style={styles.recordingDot}>●</span> Recording in progress...
        </div>
      )}

      {transcript && (
        <div style={styles.transcriptSection}>
          <h3 style={styles.sectionTitle}>Transcript:</h3>
          <div style={styles.transcriptBox}>
            {transcript}
          </div>
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
        </div>
      )}

      <div style={styles.info}>
        <p><strong>How to use:</strong></p>
        <ol style={styles.infoList}>
          <li>Click "Start Recording" and grant microphone access</li>
          <li>Speak clearly into your microphone</li>
          <li>Click "Stop Recording" when finished</li>
          <li>Review the transcript and save it as a note</li>
        </ol>
      </div>
    </div>
  );
};

// ============================================================
// COMPONENT: NotesList
// Displays the list of saved notes with delete functionality
// ============================================================
const NotesList = ({ notes, onDeleteNote, onClearAll }) => {
  // Format date for display
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
// MAIN APP COMPONENT
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
        <p>Built with Web Speech API • Works on Chrome, Edge & Chromium browsers</p>
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

export default App;