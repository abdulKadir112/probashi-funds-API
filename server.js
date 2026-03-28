const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// ১. মিডেলওয়্যার (অবশ্যই সবার উপরে দিন)
app.use(cors({ origin: '*' })); 
app.use(express.json());

// ২. মঙ্গোডিবি কানেকশন
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB Connected!"))
  .catch(err => console.error("❌ DB Error:", err));

// ৩. ট্রানজেকশন স্কিমা
const transactionSchema = new mongoose.Schema({
  fundType: { type: String, required: true }, 
  type: { type: String, enum: ['donation', 'expense'], required: true },
  amount: { type: Number, required: true },
  donorName: String,
  donorPhone: String,
  donorAddress: String,
  receiverName: String,
  receiverPhone: String,
  receiverAddress: String,
  note: String,
  date: { type: Date, default: Date.now }
});

const Transaction = mongoose.model('Transaction', transactionSchema);

// --- রাউটস (Routes) ---

// ৪. ডাটা ফেচ করা (GET)
app.get('/api/:fundName', async (req, res) => {
  try {
    const data = await Transaction.find({ fundType: req.params.fundName }).sort({ date: -1 });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ৫. নতুন ডাটা সেভ করা (POST)
app.post('/api/:fundName', async (req, res) => {
  try {
    const newEntry = new Transaction({ 
      ...req.body, 
      fundType: req.params.fundName 
    });
    await newEntry.save();
    res.status(201).json(newEntry);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ৬. ডাটা ডিলিট করা (DELETE)
app.delete('/api/:fundName/:id', async (req, res) => {
  try {
    await Transaction.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted Successfully" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));