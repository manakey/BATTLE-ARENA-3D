const express = require('express');
const path = require('path');

const app = express();
// Railway sets PORT env var automatically
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
