import { useState, useEffect } from 'react';

export const useLocalNotes = () => {
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

  const deleteNote = (id) => {
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  const clearAllNotes = () => {
    setNotes([]);
  };

  return { notes, addNote, deleteNote, clearAllNotes };
};