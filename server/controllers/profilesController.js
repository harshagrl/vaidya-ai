const FamilyMember = require('../models/FamilyMember');

// GET /api/profiles
// Fetch all family members belonging to the logged-in user
async function getProfiles(req, res) {
  try {
    const profiles = await FamilyMember.find({ accountId: req.user.id }).sort({ createdAt: 1 });
    res.json({ success: true, data: profiles });
  } catch (error) {
    console.error('Get Profiles Error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching profiles' });
  }
}

module.exports = { getProfiles };
