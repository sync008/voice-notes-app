import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import authRouter from './routes/auth.js';
import notesRouter from './routes/notes.js';
import User from './models/User.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes (must come BEFORE static file serving)
app.use('/auth', authRouter);
app.use('/notes', notesRouter);

// Serve static files from React app in production
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../my-react-app/dist');
  
  // Serve static files with proper MIME types
  app.use(express.static(frontendPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css');
      } else if (filePath.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript');
      } else if (filePath.endsWith('.json')) {
        res.setHeader('Content-Type', 'application/json');
      } else if (filePath.endsWith('.svg')) {
        res.setHeader('Content-Type', 'image/svg+xml');
      }
    }
  }));
  
  // Handle React routing, return all requests to React app
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// MongoDB Connection
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error('✗ MONGODB_URI is not defined in the .env file');
  process.exit(1);
}

mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(async () => {
    console.log('✓ MongoDB connected successfully');

    // Create default admin if doesn't exist
    const adminExists = await User.findOne({ username: 'admin' });
    if (!adminExists) {
      await User.create({
        username: 'admin',
        password: 'admin123'
      });
      console.log('✓ Default admin created (Username: admin, Password: admin123)');
    }
  })
  .catch(err => {
    console.error('✗ MongoDB connection error:', err.message);
    process.exit(1);
  });

// Start Server
app.listen(PORT, () => {
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;