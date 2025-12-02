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
  const recognitionRef = useRef(null);
  const isStoppedManually = useRef(false);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Speech recognition not supported. Use Chrome on Android.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;

    recognition.onresult = (event) => {
      let final = '';
      let interim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += result + ' ';
        } else {
          interim += result;
        }
      }

      if (final) setTranscript(prev => prev + final);
      setInterimTranscript(interim);
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        setError('Microphone access denied. Check Chrome permissions.');
      } else if (event.error === 'audio-capture') {
        setError('Cannot access microphone. Close other apps using the mic.');
      } else if (event.error === 'network') {
        setError('No internet connection. Speech recognition requires internet.');
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      if (!isStoppedManually.current && isRecording) {
        recognition.start();
      } else {
        setIsRecording(false);
        setInterimTranscript('');
      }
    };

    recognitionRef.current = recognition;
  }, [language]);

  const startRecording = () => {
    if (!recognitionRef.current) return;

    setTranscript('');
    setInterimTranscript('');
    setError('');
    isStoppedManually.current = false;
    setIsRecording(true);
    recognitionRef.current.start();
  };

  const stopRecording = () => {
    isStoppedManually.current = true;
    if (recognitionRef.current) recognitionRef.current.stop();
    setIsRecording(false);
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
            onClick={() => setLanguage('tl-PH')}
            disabled={isRecording}
            className={`button language-button ${language === 'tl-PH' ? 'language-button-active' : 'language-button-inactive'}`}
          >
            Filipino/Tagalog
          </button>
        </div>
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
          <span className="recording-dot">●</span> RECORDING
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
        <p>Best on Chrome for Android • Notes saved in browser memory</p>
      </footer>
    </div>
  );
};

export default App;