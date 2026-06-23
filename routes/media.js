const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Media = require('../models/Media');
const { protect } = require('../middleware/auth');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname))
});
const upload = multer({ storage });

// Upload Media
router.post('/', protect, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const url = `/uploads/${req.file.filename}`;
    
    const media = new Media({
      user: req.user._id,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      url: url
    });

    await media.save();
    res.status(201).json(media);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error during upload' });
  }
});

// Get User's Media
router.get('/', protect, async (req, res) => {
  try {
    const media = await Media.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(media);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete Media
router.delete('/:id', protect, async (req, res) => {
  try {
    const media = await Media.findOne({ _id: req.params.id, user: req.user._id });
    if (!media) return res.status(404).json({ message: 'Media not found' });

    const filePath = path.join(uploadDir, media.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await media.deleteOne();
    res.json({ message: 'Media deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
