import React, { useState, useEffect } from 'react';
import Header from './components/Header/Header';
import Footer from './components/Footer/Footer';
import Recorder from './components/Recorder/Recorder';
import ManualNote from './components/ManualNote/ManualNote';
import NotesList from './components/NotesList/NotesList';
import Login from './components/Login/Login';
import './App.css';

const App = () => {
  const [user, setUser] = useState(null);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Check if user is logged in on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      const userData = JSON.parse(savedUser);
      setUser(userData);
      fetchNotes(userData.id);
    } else {
      setLoading(false);
    }
  }, []);

  // Fetch notes from server
  const fetchNotes = async (userId) => {
    try {
      const response = await fetch(`http://localhost:5000/notes/${userId}`);
      const data = await response.json();
      
      if (data.success) {
        setNotes(data.notes);
      }
    } catch (error) {
      console.error('Error fetching notes:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle login
  const handleLogin = (userData) => {
    setUser(userData);
    fetchNotes(userData.id);
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
    setNotes([]);
  };

  // Add note from voice recording (no title)
  const addNoteFromRecording = async (text) => {
    try {
      const response = await fetch('http://localhost:5000/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user.id,
          title: '',
          text
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setNotes([data.note, ...notes]);
      }
    } catch (error) {
      console.error('Error saving note:', error);
      alert('Failed to save note. Please try again.');
    }
  };

  // Add note manually (with optional title)
  const addNoteManually = async (title, text) => {
    try {
      const response = await fetch('http://localhost:5000/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user.id,
          title,
          text
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setNotes([data.note, ...notes]);
      }
    } catch (error) {
      console.error('Error saving note:', error);
      alert('Failed to save note. Please try again.');
    }
  };

  // Edit note
  const editNote = async (noteId, title, text) => {
    try {
      const response = await fetch(`http://localhost:5000/notes/${noteId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title,
          text
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setNotes(notes.map(note => 
          note._id === noteId ? data.note : note
        ));
      }
    } catch (error) {
      console.error('Error updating note:', error);
      alert('Failed to update note. Please try again.');
    }
  };

  // Delete note
  const deleteNote = async (noteId) => {
    try {
      const response = await fetch(`http://localhost:5000/notes/${noteId}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      
      if (data.success) {
        setNotes(notes.filter(note => note._id !== noteId));
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      alert('Failed to delete note. Please try again.');
    }
  };

  // Clear all notes
  const clearAllNotes = async () => {
    if (!window.confirm('Delete all notes? This cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/notes/user/${user.id}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      
      if (data.success) {
        setNotes([]);
      }
    } catch (error) {
      console.error('Error clearing notes:', error);
      alert('Failed to clear notes. Please try again.');
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!user) {
    return <Login onLoginSuccess={handleLogin} />;
  }

  return (
    <div className="app">
      <Header />
      <div className="user-bar">
        <span className="welcome-text">Welcome, {user.username}!</span>
        <button onClick={handleLogout} className="logout-button">
          Logout
        </button>
      </div>
      <div className="container">
        <div className="left-column">
          <Recorder onTranscriptComplete={addNoteFromRecording} />
          <ManualNote onNoteCreate={addNoteManually} />
        </div>
        <div className="right-column">
          <NotesList 
            notes={notes} 
            onDeleteNote={deleteNote} 
            onClearAll={clearAllNotes}
            onEditNote={editNote}
          />
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default App;