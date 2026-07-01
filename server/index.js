require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

if (!process.env.JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET environment variable is missing.');
  process.exit(1);
}

const app = express();

// Connect Database
connectDB();

// Init Middleware
app.use(cors());
app.use(express.json({ extended: false }));

// Define Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/profiles', require('./routes/profiles'));
app.use('/api/profiles/:profileId/records', require('./routes/records'));
app.use('/api/profiles/:profileId/chat', require('./routes/chat'));

// Global error handler — catches any unhandled errors from middleware (e.g. multer)
// that would otherwise produce Express's default "[object Object]" response.
// Must be defined AFTER all routes (Express identifies error handlers by their 4 parameters).
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err.message, err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'An unexpected server error occurred.'
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
