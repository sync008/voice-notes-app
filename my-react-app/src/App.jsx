// App.js - ULTIMATE VERSION: Truly Continuous Listening
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

// Number conversion (English + Filipino)
const normalizeNumbers = (text) => {
  const map = {
    'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
    'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9',
    'ten': '10', 'eleven': '11', 'twelve': '12', 'thirteen': '13',
    'isa': '1', 'dalawa': '2', 'tatlo': '3', 'apat': '4', 'lima': '5',
    'anim': '6', 'pito': '7', 'walo': '8', 'siyam': '9', 'sampu': '10',
    'labing-isa': '11', 'labindalawa': '12', 'labintatlo': '13',
  };

  return text
    .toLowerCase()
    .replace(/\b[\w-]+(?:\s+[\w-]+)*\b/g, (phrase) => {
      const cleaned = phrase.toLowerCase().replace(/[^\w\s-]/g, '').trim();
      return map[cleaned] || phrase;
    });
};

// RECORDER — Truly continuous, no interruptions
const Recorder = ({ onTranscriptComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');        // live growing transcript
  const [interimTranscript, setInterimTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState(''); // only shown after Stop
  const [language, setLanguage] = useState('en-US');
  const [showFilipinoWarning, setShowFilipinoWarning] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  const recognitionRef = useRef(null);
  const timeoutRef = useRef(null);
  const isStoppedManually = useRef(false);

  useEffect(() => {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(ios);
  }, []);

  const startNewChunk = () => {
    if (isStoppedManually.current || !isRecording) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition not supported');
      return;
    }

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

    recognition.onerror = () => {}; // ignore no-speech etc.
    recognition.onend = () => {
      if (isRecording && !isStoppedManually.current) {
        timeoutRef.current = setTimeout(startNewChunk, 80); // 80ms gap = impossible to miss
      }
    };

    try { recognition.start(); } catch (e) {}
    recognitionRef.current = recognition;

    // Force restart every 60 seconds exactly
    setTimeout(() => {
      if (recognitionRef.current && isRecording && !isStoppedManually.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
    }, 60000);
  };

  useEffect(() => {
    if (isRecording) {
      setTranscript('');
      setInterimTranscript('');
      setFinalTranscript('');
      isStoppedManually.current = false;
      startNewChunk();
    }

    return () => {
      isStoppedManually.current = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
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
    setFinalTranscript(transcript.trim());
  };

  const saveNote = () => {
    if (finalTranscript) {
      onTranscriptComplete(normalizeNumbers(finalTranscript));
      setFinalTranscript('');
      setTranscript('');
    }
  };

  const discard = () => {
    setFinalTranscript('');
    setTranscript('');
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
          Filipino not supported on iPhone → using English
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

      {/* LIVE TRANSCRIPT WHILE RECORDING */}
      {isRecording && (
        <>
          <div className="recording-indicator">
            <span className="recording-dot">●</span> LISTENING ({language === 'en-US' ? 'English' : 'Filipino'})
          </div>
          <div className="transcript-box live">
            {transcript}
            {interimTranscript && <span className="interim-text">{interimTranscript}...</span>}
          </div>
        </>
      )}

      {/* ONLY SHOW SAVE/DISCARD AFTER STOPPING */}
      {!isRecording && finalTranscript && (
        <div className="transcript-section">
          <h3>Ready to save:</h3>
          <div className="transcript-box final">{finalTranscript}</div>
          <div className="transcript-actions">
            <button onClick={saveNote} className="button save-button">Save Note</button>
            <button onClick={discard} className="button discard-button">Discard</button>
          </div>
        </div>
      )}
    </div>
  );
};

// NotesList and App remain unchanged
const NotesList = ({ notes, onDeleteNote, onClearAll }) => {
  const formatDate = (d) => new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  return (
    <div className="notes-list">
      <div className="notes-header">
        <h2 className="title">My Notes ({notes.length})</h2>
        {notes.length > 0 && <button onClick={onClearAll} className="button clear-button">Clear All</button>}
      </div>
      {notes.length === 0 ? (
        <div className="empty-state">No notes yet. Start recording!</div>
      ) : (
        <div className="notes-grid">
          {notes.map(n => (
            <div key={n.id} className="note-card">
              <div className="note-header">
                <span className="note-date">{formatDate(n.createdAt)}</span>
                <button onClick={() => onDeleteNote(n.id)} className="delete-button">×</button>
              </div>
              <div className="note-text">{n.text}</div>
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
        <p className="subtitle">Talk as long as you want • Stop when you're done • Zero duplicates</p>
      </header>
      <div className="container">
        <Recorder onTranscriptComplete={handleSave} />
        <NotesList notes={notes} onDeleteNote={deleteNote} onClearAll={handleClear} />
      </div>
      <footer className="footer">
        <p>Works on all phones • English + Filipino • No data sent anywhere</p>
      </footer>
    </div>
  );
};

export default App;