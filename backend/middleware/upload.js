const multer = require('multer');
const fs = require('fs');
const path = require('path');

const postersDir = path.join(__dirname, '..', 'uploads', 'posters');
fs.mkdirSync(postersDir, { recursive: true });

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, postersDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error('Poster must be a JPEG, PNG, or WebP image'));
    }
    cb(null, true);
  },
});

// wraps multer so upload errors (bad file type, too large) come back as a normal 400
// instead of falling through to the generic 500 handler
const uploadPoster = (req, res, next) => {
  upload.single('poster')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'Could not upload poster image' });
    }
    next();
  });
};

module.exports = uploadPoster;
