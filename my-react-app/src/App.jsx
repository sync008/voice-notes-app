import React from 'react';
import Header from './components/Header/Header';
import Footer from './components/Footer/Footer';
import Recorder from './components/Recorder/Recorder';
import NotesList from './components/NotesList/NotesList';
import { useLocalNotes } from './hooks/useLocalNotes';
import './App.css';

const App = () => {
  const { notes, addNote, deleteNote, clearAllNotes } = useLocalNotes();

  const handleSave = (text) => {
    if (text) {
      addNote(text);
    }
  };

  const handleClear = () => {
    if (window.confirm('Delete all notes?')) {
      clearAllNotes();
    }
  };

  return (
    <div className="app">
      <Header />
      <div className="container">
        <Recorder onTranscriptComplete={handleSave} />
        <NotesList 
          notes={notes} 
          onDeleteNote={deleteNote} 
          onClearAll={handleClear} 
        />
      </div>
      <Footer />
    </div>
  );
};

export default App;