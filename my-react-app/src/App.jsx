import React, { useState, useRef } from 'react';

// ============================================================
// CUSTOM HOOK: useLocalNotes
// Manages notes in memory
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
// Handles voice recording with server-side transcription
// ============================================================
const Recorder = ({ onTranscriptComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  // Start recording
  const startRecording = async () => {
    try {
      setError('');
      setTranscript('');
      setRecordingDuration(0);
      audioChunksRef.current = [];

      // Request microphone access
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        });
      } catch (permissionError) {
        console.error('Microphone permission error:', permissionError);
        if (permissionError.name === 'NotAllowedError' || permissionError.name === 'PermissionDeniedError') {
          setError('Microphone access denied. Please allow microphone access in your browser settings and try again.');
        } else if (permissionError.name === 'NotFoundError') {
          setError('No microphone found. Please connect a microphone and try again.');
        } else {
          setError('Failed to access microphone. Please check your browser permissions and try again.');
        }
        return;
      }

      // Setup MediaRecorder
      const options = { mimeType: 'audio/webm' };
      
      // Fallback for Safari/iOS
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        options.mimeType = 'audio/mp4';
      }
      
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        
        // Stop timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        // Process the audio
        if (audioChunksRef.current.length > 0) {
          await transcribeAudio();
        }
      };

      mediaRecorder.start();
      setIsRecording(true);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Error starting recording:', err);
      setError('An unexpected error occurred. Please try again.');
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Transcribe audio using Claude API
  const transcribeAudio = async () => {
    setIsProcessing(true);
    setError('');

    try {
      const audioBlob = new Blob(audioChunksRef.current, { 
        type: audioChunksRef.current[0].type 
      });

      // Convert blob to base64
      const base64Audio = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });

      // Send to Claude API for transcription
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Please transcribe this audio recording. Only provide the transcription text, nothing else. If you cannot understand the audio, say "Unable to transcribe audio".'
                },
                {
                  type: 'document',
                  source: {
                    type: 'base64',
                    media_type: audioBlob.type,
                    data: base64Audio
                  }
                }
              ]
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error('Transcription failed');
      }

      const data = await response.json();
      const transcriptionText = data.content
        .filter(item => item.type === 'text')
        .map(item => item.text)
        .join(' ')
        .trim();

      if (transcriptionText && !transcriptionText.includes('Unable to transcribe')) {
        setTranscript(transcriptionText);
      } else {
        setError('Could not transcribe the audio. Please try speaking more clearly.');
      }

    } catch (err) {
      console.error('Transcription error:', err);
      setError('Failed to transcribe audio. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Save transcript as a note
  const saveNote = () => {
    if (transcript) {
      onTranscriptComplete(transcript);
      setTranscript('');
    }
  };

  // Discard current transcript
  const discardTranscript = () => {
    setTranscript('');
  };

  // Format duration
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
        {!isRecording && !isProcessing ? (
          <button
            onClick={startRecording}
            style={{...styles.button, ...styles.startButton}}
          >
            ▶ Start Recording
          </button>
        ) : isRecording ? (
          <button
            onClick={stopRecording}
            style={{...styles.button, ...styles.stopButton}}
          >
            ⏹ Stop Recording
          </button>
        ) : null}
      </div>

      {isRecording && (
        <div style={styles.recordingIndicator}>
          <span style={styles.recordingDot}>●</span> 
          Recording... {formatDuration(recordingDuration)}
        </div>
      )}

      {isProcessing && (
        <div style={styles.processingIndicator}>
          <div style={styles.spinner}></div>
          <span>Processing audio...</span>
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
          <li>Click "Start Recording" and allow microphone access</li>
          <li>Speak clearly into your microphone</li>
          <li>Click "Stop Recording" when finished</li>
          <li>Wait for the audio to be transcribed</li>
          <li>Review and save your note</li>
        </ol>
        <p style={{marginTop: '1rem', fontSize: '0.9rem'}}>
          <strong>Note:</strong> Works on all devices including Android and iPhone!
        </p>
      </div>
    </div>
  );
};

// ============================================================
// COMPONENT: NotesList
// Displays the list of saved notes
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
        <p style={styles.subtitle}>Record your thoughts with AI-powered transcription</p>
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
        <p>Powered by Claude AI • Works on Android, iPhone, and all devices</p>
        <p style={{fontSize: '0.85rem', marginTop: '0.5rem', opacity: 0.8}}>
          Notes are stored in memory and will be cleared when you close this page
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
  processingIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1rem',
    backgroundColor: '#e3f2fd',
    borderRadius: '4px',
    marginBottom: '1rem',
    fontSize: '1rem',
    color: '#1565c0',
    fontWeight: '600',
  },
  spinner: {
    width: '20px',
    height: '20px',
    border: '3px solid #bbdefb',
    borderTop: '3px solid #1565c0',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
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

// Add CSS animations
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(styleSheet);

export default App;