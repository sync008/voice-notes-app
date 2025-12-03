import React from 'react';
import { formatDate } from '../../utils/textUtils';
import './NotesList.css';

const NotesList = ({ notes, onDeleteNote, onClearAll }) => {
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
        <div className="empty-state">No notes yet. Start recording!</div>
      ) : (
        <div className="notes-grid">
          {notes.map(note => (
            <div key={note.id} className="note-card">
              <div className="note-header">
                <span className="note-date">{formatDate(note.createdAt)}</span>
                <button 
                  onClick={() => onDeleteNote(note.id)} 
                  className="delete-button"
                  aria-label="Delete note"
                >
                  ×
                </button>
              </div>
              <div className="note-text">{note.text}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotesList;