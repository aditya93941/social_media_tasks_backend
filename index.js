const express = require('express');
const multer = require('multer');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const cors = require('cors');

const app = express();

app.use(cors());
  

app.use(express.urlencoded({ extended: true }));

const UPLOADS_DIR = './uploads';
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}

const db = new sqlite3.Database('./submissions.db', (err) => {
  if (err) {
    return console.error(err.message);
  }
  console.log('Connected to the submissions SQLite database.');
});

db.run(
  `CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    handle TEXT,
    images TEXT
  )`
);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

app.post('/submit', upload.array('images', 10), (req, res) => {
  const { name, handle } = req.body;
  const imagePaths = req.files.map((file) => file.filename).join(',');

  db.run(
    `INSERT INTO submissions (name, handle, images) VALUES (?, ?, ?)`,
    [name, handle, imagePaths],
    function (err) {
      if (err) {
        return res.status(500).json({ success: false, error: err.message });
      }
      res.json({ success: true, id: this.lastID });
    }
  );
});

app.get('/submissions', (req, res) => {
  db.all(`SELECT * FROM submissions`, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }

    const users = rows.map((row) => ({
      id: row.id,
      name: row.name,
      handle: row.handle,
      images: row.images.split(',').map((filename) => `https://social-media-tasks-backend.onrender.com/uploads/${filename}`) // Append the correct URL path
    }));

    res.json(users);
  });
});

app.delete('/delete/:id', (req, res) => {
  const { id } = req.params;

  db.get('SELECT images FROM submissions WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).send('Error fetching submission data');
    }

    if (!row) {
      return res.status(404).send('Submission not found');
    }

    const imagePaths = row.images.split(',');

    console.log(`Deleting submission ID: ${id}, Images: ${imagePaths}`);

    imagePaths.forEach((imagePath) => {
      const fullImagePath = path.join(__dirname, 'uploads', imagePath);
      if (fs.existsSync(fullImagePath)) {
        fs.unlinkSync(fullImagePath); 
        console.log(`Deleted image: ${fullImagePath}`);
      }
    });

    
    db.run('DELETE FROM submissions WHERE id = ?', [id], function (err) {
      if (err) {
        return res.status(500).send('Error deleting data');
      }
      console.log(`Deleted submission with ID: ${id}`);
      res.status(200).send('Submission and associated images deleted successfully');
    });
  });
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.listen(5000, () => {
  console.log('Server is running on http://localhost:5000');
});
