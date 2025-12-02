import React, { useState, useRef, useEffect } from 'react';

// ============================================================================
// UTILS: interpretText.js
// ============================================================================
const interpretText = (rawText) => {
  if (!rawText) return '';
  
  let interpreted = rawText.trim();
  
  // Common misheard words (English)
  const corrections = {
    'their': 'there',
    'your': 'you\'re',
    'its': 'it\'s',
    'cant': 'can\'t',
    'wont': 'won\'t',
    'dont': 'don\'t',
    'im': 'I\'m',
    'youre': 'you\'re',
    'theyre': 'they\'re',
    'gonna': 'going to',
    'wanna': 'want to',
    'gotta': 'got to',
    'kinda': 'kind of',
    'sorta': 'sort of',
  };
  
  // Common Tagalog/Taglish corrections
  const tagalogCorrections = {
    'naman': 'naman',
    'kasi': 'kasi',
    'nga': 'nga',
    'lang': 'lang',
    'pala': 'pala',
    'talaga': 'talaga',
    'sige': 'sige',
    'oo': 'oo',
    'hindi': 'hindi',
    'ano': 'ano',
    'ba': 'ba',
    'diba': 'di ba',
    'para': 'para',
    'yung': 'yung',
    'pag': 'pag',
  };
  
  // Apply corrections (case-insensitive word boundary matching)
  Object.keys(corrections).forEach(wrong => {
    const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
    interpreted = interpreted.replace(regex, corrections[wrong]);
  });
  
  // Capitalize first letter of sentences
  interpreted = interpreted.replace(/(^\w|[.!?]\s+\w)/g, match => match.toUpperCase());
  
  // Fix multiple spaces
  interpreted = interpreted.replace(/\s+/g, ' ');
  
  // Add period at end if missing
  if (interpreted && !interpreted.match(/[.!?]$/)) {
    interpreted += '.';
  }
  
  // Capitalize "I"
  interpreted = interpreted.replace(/\bi\b/g, 'I');
  
  return interpreted;
};

// ============================================================================
// HOOKS: useNotesMemory.js
// ============================================================================
const useNotesMemory = () => {
  const [notes, setNotes] = useState([]);
  
  const addNote = (text, type) => {
    const newNote = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      text,
      type,
      createdAt: new Date().toISOString()
    };
    setNotes(prev => [newNote, ...prev]);
  };
  
  const deleteNote = (id) => {
    setNotes(prev => prev.filter(note => note.id !== id));
  };
  
  return { notes, addNote, deleteNote };
};

// ============================================================================
// COMPONENTS: Recorder.jsx
// ============================================================================
const Recorder = ({ onNoteSaved }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [rawTranscription, setRawTranscription] = useState('');
  const [interpretedTranscription, setInterpretedTranscription] = useState('');
  const [error, setError] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  
  const mediaRecorderRef = useRef(null);
  const recognitionRef = useRef(null);
  const audioChunksRef = useRef([]);
  
  // Check browser support
  const mediaRecorderSupported = typeof MediaRecorder !== 'undefined';
  const speechRecognitionSupported = 
    'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  
  useEffect(() => {
    if (!speechRecognitionSupported) return;
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
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
        setRawTranscription(prev => prev + final);
      }
      setInterimTranscript(interim);
    };
    
    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error !== 'no-speech') {
        setError(`Recognition error: ${event.error}`);
      }
    };
    
    recognition.onend = () => {
      if (isRecording) {
        recognition.start();
      }
    };
    
    recognitionRef.current = recognition;
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [isRecording]);
  
  const startRecording = async () => {
    setError('');
    setRawTranscription('');
    setInterpretedTranscription('');
    setInterimTranscript('');
    audioChunksRef.current = [];
    
    if (!mediaRecorderSupported) {
      setError('MediaRecorder not supported on this browser');
      return;
    }
    
    if (!speechRecognitionSupported) {
      setError('Speech Recognition not supported on this browser (iOS Safari has limitations)');
      return;
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      
      if (recognitionRef.current) {
        recognitionRef.current.start();
      }
    } catch (err) {
      setError(`Microphone access denied: ${err.message}`);
    }
  };
  
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    
    setIsRecording(false);
    setInterimTranscript('');
    
    // Generate interpreted version
    const finalTranscript = rawTranscription + (interimTranscript || '');
    setRawTranscription(finalTranscript);
    const interpreted = interpretText(finalTranscript);
    setInterpretedTranscription(interpreted);
  };
  
  const saveNote = (type) => {
    const text = type === 'raw' ? rawTranscription : interpretedTranscription;
    if (text.trim()) {
      onNoteSaved(text, type);
      setRawTranscription('');
      setInterpretedTranscription('');
      setInterimTranscript('');
    }
  };
  
  const hasTranscription = rawTranscription.trim().length > 0 || interpretedTranscription.trim().length > 0;
  
  return (
    <div style={styles.recorder}>
      <h2 style={styles.title}>🎤 Voice Notes</h2>
      
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
            disabled={!mediaRecorderSupported || !speechRecognitionSupported}
          >
            ▶️ Start Recording
          </button>
        ) : (
          <button 
            onClick={stopRecording}
            style={{...styles.button, ...styles.stopButton}}
          >
            ⏹️ Stop Recording
          </button>
        )}
      </div>
      
      {isRecording && (
        <div style={styles.recordingIndicator}>
          <span style={styles.pulse}>🔴</span> Recording...
        </div>
      )}
      
      {isRecording && interimTranscript && (
        <div style={styles.interimBox}>
          <div style={styles.label}>Live Transcription:</div>
          <div style={styles.interimText}>{rawTranscription + interimTranscript}</div>
        </div>
      )}
      
      {!isRecording && hasTranscription && (
        <div style={styles.transcriptions}>
          <div style={styles.transcriptionBox}>
            <div style={styles.label}>Raw Transcription:</div>
            <div style={styles.transcriptionText}>{rawTranscription}</div>
            <button 
              onClick={() => saveNote('raw')}
              style={{...styles.button, ...styles.saveButton}}
            >
              💾 Save Raw Version
            </button>
          </div>
          
          <div style={styles.transcriptionBox}>
            <div style={styles.label}>Interpreted Version:</div>
            <div style={styles.transcriptionText}>{interpretedTranscription}</div>
            <button 
              onClick={() => saveNote('interpreted')}
              style={{...styles.button, ...styles.saveButton}}
            >
              💾 Save Interpreted Version
            </button>
          </div>
        </div>
      )}
      
      {(!mediaRecorderSupported || !speechRecognitionSupported) && (
        <div style={styles.browserInfo}>
          <p><strong>Browser Support:</strong></p>
          <p>✅ Desktop Chrome: Full support</p>
          <p>✅ Android Chrome: Full support</p>
          <p>⚠️ iOS Safari: Limited (no Web Speech API)</p>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// COMPONENTS: NotesList.jsx
// ============================================================================
const NotesList = ({ notes, onDeleteNote }) => {
  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  if (notes.length === 0) {
    return (
      <div style={styles.notesList}>
        <h3 style={styles.notesTitle}>📋 Your Notes</h3>
        <p style={styles.emptyState}>No notes yet. Start recording to create your first note!</p>
      </div>
    );
  }
  
  return (
    <div style={styles.notesList}>
      <h3 style={styles.notesTitle}>📋 Your Notes ({notes.length})</h3>
      {notes.map(note => (
        <div key={note.id} style={styles.noteCard}>
          <div style={styles.noteHeader}>
            <span style={{
              ...styles.noteType,
              backgroundColor: note.type === 'raw' ? '#e3f2fd' : '#f3e5f5',
              color: note.type === 'raw' ? '#1565c0' : '#6a1b9a'
            }}>
              {note.type === 'raw' ? '📝 Raw' : '✨ Interpreted'}
            </span>
            <span style={styles.noteDate}>{formatDate(note.createdAt)}</span>
          </div>
          <p style={styles.noteText}>{note.text}</p>
          <button 
            onClick={() => onDeleteNote(note.id)}
            style={styles.deleteButton}
          >
            🗑️ Delete
          </button>
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// APP COMPONENT
// ============================================================================
const App = () => {
  const { notes, addNote, deleteNote } = useNotesMemory();
  
  return (
    <div style={styles.app}>
      <div style={styles.container}>
        <Recorder onNoteSaved={addNote} />
        <NotesList notes={notes} onDeleteNote={deleteNote} />
      </div>
    </div>
  );
};

// ============================================================================
// STYLES
// ============================================================================
const styles = {
  app: {
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    padding: '20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
  },
  container: {
    maxWidth: '800px',
    margin: '0 auto'
  },
  recorder: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '24px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
  },
  title: {
    margin: '0 0 20px 0',
    fontSize: '24px',
    fontWeight: '600',
    color: '#333'
  },
  controls: {
    marginBottom: '20px'
  },
  button: {
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '500',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontFamily: 'inherit'
  },
  startButton: {
    backgroundColor: '#4caf50',
    color: 'white'
  },
  stopButton: {
    backgroundColor: '#f44336',
    color: 'white'
  },
  saveButton: {
    backgroundColor: '#2196f3',
    color: 'white',
    marginTop: '12px',
    width: '100%'
  },
  recordingIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px',
    backgroundColor: '#ffebee',
    borderRadius: '8px',
    marginBottom: '16px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#c62828'
  },
  pulse: {
    animation: 'pulse 1.5s ease-in-out infinite'
  },
  interimBox: {
    padding: '16px',
    backgroundColor: '#f5f5f5',
    borderRadius: '8px',
    marginBottom: '16px'
  },
  transcriptions: {
    display: 'grid',
    gap: '16px',
    marginTop: '20px'
  },
  transcriptionBox: {
    padding: '16px',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    backgroundColor: '#fafafa'
  },
  label: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#666',
    marginBottom: '8px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  transcriptionText: {
    fontSize: '16px',
    lineHeight: '1.6',
    color: '#333',
    marginBottom: '12px',
    minHeight: '60px'
  },
  interimText: {
    fontSize: '16px',
    lineHeight: '1.6',
    color: '#666',
    fontStyle: 'italic'
  },
  error: {
    padding: '12px',
    backgroundColor: '#ffebee',
    color: '#c62828',
    borderRadius: '8px',
    marginBottom: '16px',
    fontSize: '14px'
  },
  browserInfo: {
    marginTop: '20px',
    padding: '16px',
    backgroundColor: '#fff3e0',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#e65100'
  },
  notesList: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
  },
  notesTitle: {
    margin: '0 0 20px 0',
    fontSize: '20px',
    fontWeight: '600',
    color: '#333'
  },
  emptyState: {
    textAlign: 'center',
    color: '#999',
    padding: '40px 20px',
    fontSize: '14px'
  },
  noteCard: {
    padding: '16px',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    marginBottom: '12px',
    backgroundColor: '#fafafa'
  },
  noteHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    flexWrap: 'wrap',
    gap: '8px'
  },
  noteType: {
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '600'
  },
  noteDate: {
    fontSize: '12px',
    color: '#999'
  },
  noteText: {
    fontSize: '15px',
    lineHeight: '1.6',
    color: '#333',
    margin: '0 0 12px 0',
    wordWrap: 'break-word'
  },
  deleteButton: {
    padding: '8px 16px',
    fontSize: '14px',
    backgroundColor: '#ffebee',
    color: '#c62828',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontWeight: '500'
  }
};

export default App;