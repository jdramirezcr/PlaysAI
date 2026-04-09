const express = require('express');
const path = require('path');

// Initialize DB (runs CREATE TABLE IF NOT EXISTS on startup)
require('./src/models/db');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

require('./src/routes')(app);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`PlaysAI corriendo en http://localhost:${PORT}`);
});
