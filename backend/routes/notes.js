import express from 'express';
import Note from '../models/Note.js';

const router = express.Router();

// Get all notes for a user
router.get('/:userId', async (req, res) => {
  try {
    const notes = await Note.find({ userId: req.params.userId })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      notes
    });
  } catch (error) {
    console.error('Get notes error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error fetching notes' 
    });
  }
});

// Create new note
router.post('/', async (req, res) => {
  try {
    const { userId, title, text } = req.body;

    if (!userId || !text) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID and text are required' 
      });
    }

    const note = await Note.create({
      userId,
      title: title || '',
      text: text.trim()
    });

    res.status(201).json({
      success: true,
      message: 'Note created successfully',
      note
    });
  } catch (error) {
    console.error('Create note error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error creating note' 
    });
  }
});

// Update note
router.put('/:noteId', async (req, res) => {
  try {
    const { title, text } = req.body;

    if (!text) {
      return res.status(400).json({ 
        success: false, 
        message: 'Text is required' 
      });
    }

    const note = await Note.findByIdAndUpdate(
      req.params.noteId,
      { 
        title: title || '',
        text: text.trim(),
        updatedAt: Date.now()
      },
      { new: true }
    );

    if (!note) {
      return res.status(404).json({ 
        success: false, 
        message: 'Note not found' 
      });
    }

    res.json({
      success: true,
      message: 'Note updated successfully',
      note
    });
  } catch (error) {
    console.error('Update note error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error updating note' 
    });
  }
});

// Delete note
router.delete('/:noteId', async (req, res) => {
  try {
    const note = await Note.findByIdAndDelete(req.params.noteId);

    if (!note) {
      return res.status(404).json({ 
        success: false, 
        message: 'Note not found' 
      });
    }

    res.json({
      success: true,
      message: 'Note deleted successfully'
    });
  } catch (error) {
    console.error('Delete note error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error deleting note' 
    });
  }
});

// Delete all notes for a user
router.delete('/user/:userId', async (req, res) => {
  try {
    await Note.deleteMany({ userId: req.params.userId });

    res.json({
      success: true,
      message: 'All notes deleted successfully'
    });
  } catch (error) {
    console.error('Delete all notes error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error deleting notes' 
    });
  }
});

export default router;