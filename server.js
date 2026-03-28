const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const dbURI = process.env.MONGODB_URI;
mongoose.connect(dbURI)
  .then(() => console.log("অভিনন্দন! MongoDB Atlas-এর সাথে কানেক্ট হয়েছে।"))
  .catch(err => console.error("কানেকশন এরর:", err));

// Test Route
app.get('/', (req, res) => {
  res.send("Probashi Fund Backend is Running...");
});

// Server Start
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`সার্ভার চলছে পোর্ট: ${PORT}`);
});