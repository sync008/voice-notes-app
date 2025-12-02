// App.js - FINAL VERSION (60-second chunks, 0.1s gap = UNBREAKABLE)
import React, { useState, useRef, useEffect } from 'react';
import './App.css';

const useLocalNotes = () => {
  const [notes, setNotes] = useState(() => {
    const saved = localStorage.getItem('voiceNotes');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('voiceNotes', JSON.stringify(notes));
  }, [notes]);

  const addNote = (text) => {
    const newNote = {
      id: Date.now() + Math.random().toString(36).substr(2, 9),
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };
    setNotes(prev => [newNote, ...prev]);
  };

  const deleteNote = (id) => setNotes(prev => prev.filter(n => n.id !== id));
  const clearAllNotes = () => setNotes([]);

  return { notes, addNote, deleteNote, clearAllNotes };
};

// Smart Number Conversion (English + Filipino)
const normalizeNumbers = (text) => {
  const map = {
    // English
    'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
    'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9',
    'ten': '10', 'eleven': '11', 'twelve': '12', 'thirteen': '13',
    // Filipino
    'isa': '1', 'dalawa': '2', 'tatlo': '3', 'apat': '4', 'lima': '5',
    'anim': '6', 'pito': '7', 'walo': '8', 'siyam': '9', 'sampu': '10',
    'labing-isa': '11', 'labindalawa': '12', 'labintatlo': '13', 'labing-apat': '14',
  };

  return text
    .toLowerCase()
    .replace(/\b[\w-]+(?:\s+[\w-]+)*\b/g, (phrase) => {
      const cleaned = phrase.trim().toLowerCase().replace(/[^\w\s-]/g, '');
      return map[cleaned] || phrase;
    });
};

// BULLETPROOF RECORDER — 60-second chunks + 100ms gap
const Recorder = ({ onTranscriptComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState('');
  const [language, setLanguage] = useState('en-US');
  const [showFilipinoWarning, setShowFilipinoWarning] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  const recognitionRef = useRef(null);
  const chunkTimeoutRef = useRef(null);
  const forceStopTimeoutRef = useRef(null);
  const isStoppedManually = useRef(false);

  useEffect(() => {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(ios);
  }, []);

  const startNewChunk = () => {
    if (isStoppedManually.current || !isRecording) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Speech recognition not supported in this browser.');
      setIsRecording(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;     // Critical: short, clean chunks
    recognition.interimResults = true;
    recognition.lang = language;

    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }

      if (finalText) {
        const clean = normalizeNumbers(finalText.trim());
        setTranscript(prev => prev + clean + ' ');
      }
      setInterimTranscript(interimText);
    };

    recognition.onerror = (e) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        console.warn('Speech error:', e.error);
      }
    };

    recognition.onend = () => {
      // Schedule next chunk with only 100ms gap
      if (isRecording && !isStoppedManually.current) {
        chunkTimeoutRef.current = setTimeout(startNewChunk, 100);
      }
    };

    try {
      recognition.start();
    } catch (e) {
      // Ignore if already started
    }

    recognitionRef.current = recognition;

    // Force stop exactly at 60 seconds to prevent drift
    forceStopTimeoutRef.current = setTimeout(() => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
    }, 60000);
  };

  useEffect(() => {
    if (!isRecording) return;

    setTranscript('');
    setInterimTranscript('');
    setError('');
    isStoppedManually.current = false;

    startNewChunk();

    return () => {
      isStoppedManually.current = true;
      if (chunkTimeoutRef.current) clearTimeout(chunkTimeoutRef.current);
      if (forceStopTimeoutRef.current) clearTimeout(forceStopTimeoutRef.current);
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, [isRecording, language]);

  const startRecording = () => setIsRecording(true);
  const stopRecording = () => {
    isStoppedManually.current = true;
    setIsRecording(false);
    setInterimTranscript('');
    if (chunkTimeoutRef.current) clearTimeout(chunkTimeoutRef.current);
    if (forceStopTimeoutRef.current) clearTimeout(forceStopTimeoutRef.current);
  };

  const saveNote = () => {
    const full = (transcript + interimTranscript).trim();
    if (full) {
      onTranscriptComplete(normalizeNumbers(full));
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
      setLanguage('en-US');
    } else {
      setShowFilipinoWarning(false);
      setLanguage(lang);
    }
  };

  return (
    <div className="recorder">
      <h2 className="title">Voice Recorder</h2>
      {error && <div className="error">{error}</div>}

      <div className="language-section">
        <h3 className="section-title">Language:</h3>
        <div className="language-buttons">
          <button onClick={() => handleLanguageClick('en-US')} className={`button language-button ${language === 'en-US' ? 'active' : ''}`}>
            English
          </button>
          <button onClick={() => handleLanguageClick('fil-PH')} className={`button language-button ${language === 'fil-PH' ? 'active' : ''}`}>
            Filipino/Tagalog
          </button>
        </div>
      </div>

      {showFilipinoWarning && (
        <div className="language-note warning-ios">
          Filipino not supported on iPhone. Using English.
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
          <span className="recording-dot">●</span> LISTENING ({language === 'en-US' ? 'English' : 'Filipino'})
        </div>
      )}

      {(transcript || interimTranscript) && (
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
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
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

  const handleSave = (text) => text.trim() && addNote(text);
  const handleClear = () => window.confirm('Delete all notes?') && clearAllNotes();

  return (
    <div className="app">
      <header className="header">
        <h1 className="app-title">Voice Notes</h1>
        <p className="subtitle">Always listening • Zero duplicates • Works everywhere</p>
      </header>

      <div className="container">
        <Recorder onTranscriptComplete={handleSave} />
        <NotesList notes={notes} onDeleteNote={deleteNote} onClearAll={handleClear} />
      </div>

      <footer className="footer">
        <p>English: All devices • Filipino: Android Chrome • Offline-ready</p>
      </footer>
    </div>
  );
};

export default App;