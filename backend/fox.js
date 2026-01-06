// fix-indexes.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function fixIndexes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('users');

    // Get current indexes
    const indexes = await collection.indexes();
    console.log('\nCurrent indexes:', indexes);

    // Drop the email index if it exists
    try {
      await collection.dropIndex('email_1');
      console.log('✓ Dropped email_1 index');
    } catch (err) {
      if (err.code === 27) {
        console.log('✓ email_1 index does not exist (already removed)');
      } else {
        throw err;
      }
    }

    // Verify remaining indexes
    const remainingIndexes = await collection.indexes();
    console.log('\nRemaining indexes:', remainingIndexes);

    console.log('\n✓ Index cleanup complete!');
    process.exit(0);
  } catch (error) {
    console.error('✗ Error fixing indexes:', error.message);
    process.exit(1);
  }
}

fixIndexes();