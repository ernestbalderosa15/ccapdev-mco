const multer = require('multer');
const path = require('path');

// Configure multer for handling file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/') // Make sure this directory exists
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)) // Appending extension
    }
});

const upload = multer({ storage: storage });

// Image upload route
router.post('/upload-image', upload.single('upload'), (req, res) => {
    if (req.file) {
        res.json({
            uploaded: true,
            url: `/uploads/${req.file.filename}` // URL to access the uploaded image
        });
    } else {
        res.status(400).json({ uploaded: false, error: { message: 'No file uploaded' } });
    }
});