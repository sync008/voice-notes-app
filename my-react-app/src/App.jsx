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

// ──────────────────────────────────────────────────────────────
// Number normalization (English + basic Filipino)
// ──────────────────────────────────────────────────────────────
const normalizeNumbers = (text) => {
  const numberMap = {
    // English
    'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
    'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10',
    // Filipino/Tagalog
    'isa': '1', 'dalawa': '2', 'tatlo': '3', 'apat': '4', 'lima': '5',
    'anim': '6', 'pito': '7', 'walo': '8', 'siyam': '9', 'sampu': '10',
    'labing-isa': '11', 'labindalawa': '12' // optional extras
  };

  return text
    .toLowerCase()
    .replace(/\b(\w+(?:-\w+)?)\b/g, word => numberMap[word] || word);
};

const Recorder = ({ onTranscriptComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState('');
  const [language, setLanguage] = useState('en-US');
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  const recognitionRef = useRef(null);
  const isStoppedManually = useRef(false);
  const startAttempts = useRef(0);

  // Detect iOS early
  useEffect(() => {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(ios);
    if (ios && language === 'fil-PH') {
      setLanguage('en-US');
      setError('Filipino not supported on iOS. Switched to English.');
    }
  }, []);

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

    // Silence iOS beep
    if ('audiostart' in recognition) recognition.audiostart = null;

    recognition.onstart = () => {
      console.log('Started:', language);
      setPermissionGranted(true);
      startAttempts.current = 0;
    };

    recognition.onresult = (event) => {
      let final = '';
      let interim = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const res = event.results[i];
        if (res.isFinal) {
          final += res[0].transcript;
        } else {
          interim += res[0].transcript;
        }
      }

      if (final) {
        const normalized = normalizeNumbers(final);
        setTranscript(prev => prev + normalized + ' ');
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event) => {
      console.error('Speech error:', event.error);
      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        setError('Microphone access denied.');
      } else if (event.error === 'network') {
        setError('No internet connection.');
      } else if (event.error === 'language-not-supported') {
        setError('Selected language not supported on this device.');
      }
      // "no-speech" is normal – ignore
      setIsRecording(false);
    };

    recognition.onend = () => {
      if (!isStoppedManually.current) {
        startAttempts.current++;
        if (startAttempts.current > 15) {
          setError('Speech recognition keeps stopping. Try again or use a different browser.');
          setIsRecording(false);
          return;
        }
        setTimeout(() => {
          if (!isStoppedManually.current) {
            try { recognition.start(); } catch (e) {}
          }
        }, 300);
      } else {
        setIsRecording(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        isStoppedManually.current = true;
        recognitionRef.current.stop();
      }
    };
  }, [language]);

  const startRecording = () => {
    if (!recognitionRef.current) return;

    setTranscript('');
    setInterimTranscript('');
    setError('');
    isStoppedManually.current = false;
    startAttempts.current = 0;

    setTimeout(() => {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (e) {
        if (e.message.includes('already started')) {
          recognitionRef.current.stop();
          setTimeout(() => recognitionRef.current.start(), 100);
        }
      }
    }, 300);
  };

  const stopRecording = () => {
    isStoppedManually.current = true;
    if (recognitionRef.current) recognitionRef.current.stop();
    setIsRecording(false);
    setInterimTranscript('');
  };

  const saveNote = () => {
    const fullText = (transcript + interimTranscript).trim();
    if (fullText) {
      const cleanText = normalizeNumbers(fullText);
      onTranscriptComplete(cleanText);
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
            className={`button language-button ${language === 'en-US' ? 'active' : ''}`}
          >
            English
          </button>
          <button
            onClick={() => setLanguage('fil-PH')}
            disabled={isRecording || isIOS}
            className={`button language-button ${language === 'fil-PH' ? 'active' : ''} ${isIOS ? 'disabled-ios' : ''}`}
          >
            Filipino/Tagalog
          </button>
        </div>
      </div>

      {/* Smart warning */}
      {language === 'fil-PH' && (
        <div className={`language-note ${isIOS ? 'warning-ios' : 'warning-android'}`}>
          {isIOS ? (
            <>
              Filipino (Tagalog) is <strong>not supported</strong> on iPhone/Safari.<br />
              Using <strong>English</strong> instead for best results.
            </>
          ) : (
            <>
              Filipino works best on <strong>Android Chrome</strong>.<br />
              Results may be limited on other devices.
            </>
          )}
        </div>
      )}

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

// NotesList and App remain unchanged (only tiny CSS class updates below)
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
        <p>Best on Chrome (Android) • English works everywhere • Filipino limited on iOS</p>
      </footer>
    </div>
  );
};

export default App;