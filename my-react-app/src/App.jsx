import React, { useState, useRef, useEffect } from 'react';
import './App.css';

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

  const deleteNote = (id) => setNotes(prev => prev.filter(n => n.id !== id));
  const clearAllNotes = () => setNotes([]);

  return { notes, addNote, deleteNote, clearAllNotes };
};

const Recorder = ({ onTranscriptComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState('');
  const [language, setLanguage] = useState('en-US');
  const [permissionGranted, setPermissionGranted] = useState(false);
  const recognitionRef = useRef(null);
  const isStoppedManually = useRef(false);
  const startAttempts = useRef(0);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Speech recognition not supported. Use Chrome or Safari.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;
    
    // Disable sound effects on iOS/Safari
    if (recognition.audiostart !== undefined) {
      recognition.audiostart = null;
    }

    recognition.onstart = () => {
      console.log('Recognition started for language:', language);
      startAttempts.current = 0;
      if (!permissionGranted) {
        setPermissionGranted(true);
      }
    };

    recognition.onresult = (event) => {
      let final = '';
      let interim = '';

      // Only process the latest result to avoid duplicates
      const lastResult = event.results[event.results.length - 1];
      
      if (lastResult.isFinal) {
        final = lastResult[0].transcript + ' ';
      } else {
        interim = lastResult[0].transcript;
      }

      // Only update transcript if there's actually new final text
      if (final.trim()) {
        setTranscript(prev => prev + final);
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event) => {
      console.error('Recognition error:', event.error, 'for language:', language);
      
      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        setError('Microphone access denied. Check browser permissions.');
        setIsRecording(false);
      } else if (event.error === 'audio-capture') {
        setError('Cannot access microphone. Close other apps using the mic.');
        setIsRecording(false);
      } else if (event.error === 'network') {
        setError('No internet connection. Speech recognition requires internet.');
        setIsRecording(false);
      } else if (event.error === 'language-not-supported') {
        setError('Filipino/Tagalog may not be supported on your device. Try English.');
        setIsRecording(false);
      } else if (event.error === 'no-speech') {
        // Don't stop recording on no-speech, just continue
        console.log('No speech detected, continuing...');
      } else {
        console.log('Other error:', event.error);
      }
    };

    recognition.onend = () => {
      console.log('Recognition ended. Stopped manually?', isStoppedManually.current);
      
      if (!isStoppedManually.current) {
        startAttempts.current += 1;
        
        if (startAttempts.current > 10) {
          setError(`Unable to start ${language === 'en-US' ? 'English' : 'Filipino'} recognition. Language may not be supported.`);
          setIsRecording(false);
          startAttempts.current = 0;
          return;
        }
        
        setTimeout(() => {
          if (!isStoppedManually.current) {
            try {
              recognition.start();
              console.log('Restarting recognition...');
            } catch (e) {
              console.error('Failed to restart:', e);
            }
          }
        }, 200);
      } else {
        setIsRecording(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        isStoppedManually.current = true;
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.error('Cleanup error:', e);
        }
      }
    };
  }, [language]);

  const startRecording = () => {
    if (!recognitionRef.current) return;

    // Clear everything first
    setTranscript('');
    setInterimTranscript('');
    setError('');
    isStoppedManually.current = false;
    startAttempts.current = 0;
    
    // Add a small delay before starting to ensure the button is fully pressed
    setTimeout(() => {
      try {
        if (!permissionGranted || recognitionRef.current) {
          recognitionRef.current.start();
          setIsRecording(true);
          console.log('Starting recording with language:', language);
        }
      } catch (e) {
        console.error('Failed to start recognition:', e);
        if (e.message.includes('already started')) {
          recognitionRef.current.stop();
          setTimeout(() => {
            try {
              recognitionRef.current.start();
              setIsRecording(true);
            } catch (err) {
              setError('Failed to start recording. Try again.');
            }
          }, 100);
        } else {
          setError('Failed to start recording. Try again.');
        }
      }
    }, 300);
  };

  const stopRecording = () => {
    console.log('Stopping recording manually');
    isStoppedManually.current = true;
    startAttempts.current = 0;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error('Stop error:', e);
      }
    }
    setIsRecording(false);
    setInterimTranscript('');
  };

  const saveNote = () => {
    if (transcript.trim()) {
      onTranscriptComplete(transcript.trim());
      setTranscript('');
      setInterimTranscript('');
    }
  };

  const discard = () => {
    setTranscript('');
    setInterimTranscript('');
  };

  const displayText = transcript + (interimTranscript ? ' ' + interimTranscript : '');

  return (
    <div className="recorder">
      <h2 className="title">Voice Recorder</h2>

      {error && <div className="error">{error}</div>}

      <div className="language-section">
        <h3 className="section-title">Language:</h3>
        <div className="language-buttons">
          <button
            onClick={() => setLanguage('en-US')}
            disabled={isRecording}
            className={`button language-button ${language === 'en-US' ? 'language-button-active' : 'language-button-inactive'}`}
          >
            English
          </button>
          <button
            onClick={() => setLanguage('fil-PH')}
            disabled={isRecording}
            className={`button language-button ${language === 'fil-PH' ? 'language-button-active' : 'language-button-inactive'}`}
          >
            Filipino/Tagalog
          </button>
        </div>
      </div>

      <div className="language-note">
        ⚠️ Note: Filipino voice recognition have limited support on Apple
      </div>

      <div className="controls">
        {!isRecording ? (
          <button onClick={startRecording} className="button start-button">
            Start Recording
          </button>
        ) : (
          <button onClick={stopRecording} className="button stop-button">
            Stop Recording
          </button>
        )}
      </div>

      {isRecording && (
        <div className="recording-indicator">
          <span className="recording-dot">●</span> RECORDING ({language === 'en-US' ? 'English' : 'Filipino'})
        </div>
      )}

      {displayText && (
        <div className="transcript-section">
          <h3>Transcript:</h3>
          <div className="transcript-box">
            {transcript}
            {interimTranscript && <span className="interim-text"> {interimTranscript}</span>}
          </div>
          {!isRecording && transcript && (
            <div className="transcript-actions">
              <button onClick={saveNote} className="button save-button">Save Note</button>
              <button onClick={discard} className="button discard-button">Discard</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const NotesList = ({ notes, onDeleteNote, onClearAll }) => {
  const formatDate = (dateStr) => new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  return (
    <div className="notes-list">
      <div className="notes-header">
        <h2 className="title">My Notes ({notes.length})</h2>
        {notes.length > 0 && (
          <button onClick={onClearAll} className="button clear-button">Clear All</button>
        )}
      </div>

      {notes.length === 0 ? (
        <div className="empty-state">No notes yet. Start recording!</div>
      ) : (
        <div className="notes-grid">
          {notes.map(note => (
            <div key={note.id} className="note-card">
              <div className="note-header">
                <span className="note-date">{formatDate(note.createdAt)}</span>
                <button onClick={() => onDeleteNote(note.id)} className="delete-button">×</button>
              </div>
              <div className="note-text">{note.text}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const App = () => {
  const { notes, addNote, deleteNote, clearAllNotes } = useLocalNotes();

  const handleSave = (text) => text && addNote(text);
  const handleClear = () => window.confirm('Delete all notes?') && clearAllNotes();

  return (
    <div className="app">
      <header className="header">
        <h1 className="app-title">Voice Notes</h1>
        <p className="subtitle">Speak → Save → Done</p>
      </header>

      <div className="container">
        <Recorder onTranscriptComplete={handleSave} />
        <NotesList notes={notes} onDeleteNote={deleteNote} onClearAll={handleClear} />
      </div>

      <footer className="footer">
        <p>Works best on Chrome (Android/Desktop) • Limited language support on iPhone/Safari</p>
      </footer>
    </div>
  );
};

export default App;