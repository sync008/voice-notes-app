import React, { useState } from 'react';
import './NotesList.css';

const NotesList = ({ notes, onDeleteNote, onClearAll, onEditNote }) => {
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editText, setEditText] = useState('');

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined 
    });
  };

  const startEditing = (note) => {
    setEditingId(note._id);
    setEditTitle(note.title || '');
    setEditText(note.text);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditTitle('');
    setEditText('');
  };

  const saveEdit = (noteId) => {
    if (!editText.trim()) {
      alert('Note content cannot be empty');
      return;
    }
    onEditNote(noteId, editTitle.trim(), editText.trim());
    setEditingId(null);
    setEditTitle('');
    setEditText('');
  };

  return (
    <div className="notes-list">
      <div className="notes-header">
        <h2 className="title">My Notes ({notes.length})</h2>
        {notes.length > 0 && (
          <button onClick={onClearAll} className="button clear-button">
            Clear All
          </button>
        )}
      </div>
      
      {notes.length === 0 ? (
        <div className="empty-state">No notes yet. Start recording or add manually!</div>
      ) : (
        <div className="notes-grid">
          {notes.map(note => (
            <div key={note._id} className="note-card">
              {editingId === note._id ? (
                <div className="note-edit-form">
                  <input
                    type="text"
                    placeholder="Title (optional)"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="edit-title-input"
                    maxLength="100"
                  />
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="edit-text-input"
                    rows="6"
                  />
                  <div className="edit-actions">
                    <button 
                      onClick={() => saveEdit(note._id)} 
                      className="button save-edit-button"
                    >
                      Save
                    </button>
                    <button 
                      onClick={cancelEditing} 
                      className="button cancel-edit-button"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="note-header">
                    <span className="note-date">{formatDate(note.createdAt)}</span>
                    <div className="note-actions">
                      <button 
                        onClick={() => startEditing(note)} 
                        className="edit-icon-button"
                        aria-label="Edit note"
                        title="Edit"
                      >
                        ✎
                      </button>
                      <button 
                        onClick={() => onDeleteNote(note._id)} 
                        className="delete-button"
                        aria-label="Delete note"
                        title="Delete"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  {note.title && <h3 className="note-title">{note.title}</h3>}
                  <div className="note-text">{note.text}</div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotesList;