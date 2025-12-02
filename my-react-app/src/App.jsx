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
  };

  const deleteNote = (id) => setNotes(prev => prev.filter(n => n.id !== id));
  const clearAllNotes = () => setNotes([]);

  return { notes, addNote, deleteNote, clearAllNotes };
};

// ──────────────────────────────────────────────────────────────
// Number normalization (English + Filipino)
// ──────────────────────────────────────────────────────────────
const normalizeNumbers = (text) => {
  const map = {
    // English
    'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
    'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10',
    // Filipino
    'isa': '1', 'dalawa': '2', 'tatlo': '3', 'apat': '4', 'lima': '5',
    'anim': '6', 'pito': '7', 'walo': '8', 'siyam': '9', 'sampu': '10',
    'labing isa': '11', 'labindalawa': '12', 'labintatlo': '13'
  };

  return text
    .toLowerCase()
    .replace(/\b(\w+(?:[-\s]\w+)?)\b/g, word => map[word.trim()] || word);
};

const Recorder = ({ onTranscriptComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState('');
  const [language, setLanguage] = useState('en-US');
  const [showFilipinoWarning, setShowFilipinoWarning] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  const recognitionRef = useRef(null);
  const timeoutRef = useRef(null);
  const isStoppedManually = useRef(false);

  // Detect iOS
  useEffect(() => {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(ios);
  }, []);

  // ──────────────────────────────────────────────────────────────
  // Chunked Recording — No Duplicates, Instant Start
  // ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isRecording) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Speech recognition not supported in this browser.');
      setIsRecording(false);
      return;
    }

    const startChunk = () => {
      if (!isRecording || isStoppedManually.current) return;

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = language;

      recognition.onresult = (event) => {
        let final = '';
        let interim = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) {
            final += res[0].transcript;
          } else {
            interim += res[0].transcript;
          }
        }

        if (final) {
          const clean = normalizeNumbers(final.trim());
          setTranscript(prev => prev + clean + ' ');
        }
        setInterimTranscript(interim);
      };

      recognition.onerror = (e) => {
        if (e.error === 'no-speech' || e.error === 'aborted') return;
        console.log('Recognition error:', e.error);
      };

      recognition.onend = () => {
        if (isRecording && !isStoppedManually.current) {
          timeoutRef.current = setTimeout(startChunk, 4200); // ~4.2s chunks
        }
      };

      try {
        recognition.start();
      } catch (e) { /* already started */ }
      recognitionRef.current = recognition;
    };

    startChunk();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, [isRecording, language]);

  const startRecording = () => {
    setTranscript('');
    setInterimTranscript('');
    setError('');
    setShowFilipinoWarning(false);
    isStoppedManually.current = false;
    setIsRecording(true);
  };

  const stopRecording = () => {
    isStoppedManually.current = true;
    setIsRecording(false);
    setInterimTranscript('');
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  const saveNote = () => {
    const full = (transcript + interimTranscript).trim();
    if (full) {
      const clean = normalizeNumbers(full);
      onTranscriptComplete(clean);
      setTranscript('');
      setInterimTranscript('');
    }
  };

  const discard = () => {
    setTranscript('');
    setInterimTranscript('');
  };

  const handleLanguageClick = (lang) => {
    if (isRecording) return;

    if (lang === 'fil-PH' && isIOS) {
      setShowFilipinoWarning(true);
      setLanguage('en-US'); // fallback to English
    } else {
      setShowFilipinoWarning(false);
      setLanguage(lang);
    }
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
            onClick={() => handleLanguageClick('en-US')}
            className={`button language-button ${language === 'en-US' ? 'active' : ''}`}
          >
            English
          </button>
          <button
            onClick={() => handleLanguageClick('fil-PH')}
            className={`button language-button ${language === 'fil-PH' ? 'active' : ''}`}
          >
            Filipino/Tagalog
          </button>
        </div>
      </div>

      {/* Filipino Warning — Only shows when clicked on iOS */}
      {showFilipinoWarning && (
        <div className="language-note warning-ios">
          Filipino (Tagalog) is <strong>not supported</strong> on iPhone.<br />
          We’ve switched to <strong>English</strong> for the best experience.
        </div>
      )}

      {!showFilipinoWarning && language === 'fil-PH' && !isIOS && (
        <div className="language-note warning-android">
          Filipino works best on Android Chrome.
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
            {interimTranscript && <span className="interim-text"> {interimTranscript}...</span>}
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
        <p>Works instantly • No duplicates • English everywhere • Filipino best on Android</p>
      </footer>
    </div>
  );
};

export default App;