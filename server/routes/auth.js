const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const FamilyMember = require('../models/FamilyMember');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { email, password, firstName, lastName } = req.body;
  const session = await mongoose.startSession();

  let newUserId;

  try {
    session.startTransaction();

    let user = await User.findOne({ email }).session(session);
    if (user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user = new User({ 
      email, 
      firstName, 
      lastName, 
      passwordHash: hashedPassword 
    });

    await user.save({ session });
    newUserId = user.id;

    // Auto-create a default "Self" profile for the new user
    const selfProfile = new FamilyMember({
      accountId: newUserId,
      firstName: firstName || email.split('@')[0],
      lastName: lastName || 'User',
      relationship: 'Self'
    });
    await selfProfile.save({ session });

    await session.commitTransaction();
    session.endSession();
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('Registration Transaction Error:', err.message);
    return res.status(500).send('Server error during registration');
  }

  // Transaction is complete and session is ended. Now handle JWT generation safely.
  try {
    const payload = { user: { id: newUserId } };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: 360000 });
    res.json({ token });
  } catch (err) {
    console.error('JWT Signing Error:', err.message);
    res.status(500).send('Server error generating token');
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    let user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid Credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid Credentials' });
    }

    const payload = { user: { id: user.id } };
    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: 360000 }, (err, token) => {
      if (err) throw err;
      res.json({ token });
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
