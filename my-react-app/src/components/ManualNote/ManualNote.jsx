import React, { useState } from 'react';
import './ManualNote.css';

const ManualNote = ({ onNoteCreate }) => {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!text.trim()) {
      alert('Please enter note content');
      return;
    }

    onNoteCreate(title.trim(), text.trim());
    
    // Reset form
    setTitle('');
    setText('');
    setIsExpanded(false);
  };

  const handleCancel = () => {
    setTitle('');
    setText('');
    setIsExpanded(false);
  };

  return (
    <div className="manual-note">
      {!isExpanded ? (
        <button 
          onClick={() => setIsExpanded(true)} 
          className="button expand-button"
        >
          + Add Note Manually
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="manual-note-form">
          <h3 className="form-title">Create New Note</h3>
          
          <div className="form-group">
            <input
              type="text"
              placeholder="Title (optional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="title-input"
              maxLength="100"
            />
          </div>

          <div className="form-group">
            <textarea
              placeholder="Write your note here..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="text-input"
              rows="6"
              required
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="button save-button">
              Save Note
            </button>
            <button 
              type="button" 
              onClick={handleCancel} 
              className="button cancel-button"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default ManualNote;