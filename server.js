const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios'); // Self-ping এর জন্য axios যুক্ত করা হয়েছে
require('dotenv').config();

const app = express();

// মিডেলওয়্যার
app.use(cors({ origin: '*' })); 
app.use(express.json());

// মঙ্গোডিবি কানেকশন
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB Connected!"))
  .catch(err => console.error("❌ DB Error:", err));

// ট্রানজেকশন স্কিমা
const transactionSchema = new mongoose.Schema({
  fundId: { type: String, required: true }, 
  type: { type: String, enum: ['donation', 'expense'], required: true },
  amount: { type: Number, required: true },
  donorName: String,
  receiverName: String,
  phone: String,
  note: String,
  date: { type: Date, default: Date.now }
}, { timestamps: true });

const Transaction = mongoose.model('Transaction', transactionSchema);

// --- API Routes ---

// ১. সার্ভার চেক করার জন্য পিং রুট (Keep Alive Route)
app.get('/ping', (req, res) => {
  res.status(200).send("Server is Alive!");
});

// ২. নির্দিষ্ট ফান্ডের ডাটা দেখা (GET)
app.get('/api/:fundName', async (req, res) => {
  try {
    const { fundName } = req.params;
    const data = await Transaction.find({ fundId: fundName }).sort({ date: -1 });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ৩. নতুন ডাটা সেভ করা (POST)
app.post('/api/:fundName', async (req, res) => {
  try {
    const { fundName } = req.params;
    const newEntry = new Transaction({ 
      ...req.body, 
      fundId: fundName 
    });
    await newEntry.save();
    res.status(201).json(newEntry);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ৪. ডাটা আপডেট করা (PUT)
app.put('/api/:fundName/:id', async (req, res) => {
  try {
    const { id, fundName } = req.params;
    const updatedData = await Transaction.findByIdAndUpdate(
      id,
      { ...req.body, fundId: fundName },
      { new: true }
    );
    if (!updatedData) return res.status(404).json({ message: "Data not found" });
    res.json(updatedData);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ৫. ডাটা ডিলিট করা (DELETE)
app.delete('/api/:fundName/:id', async (req, res) => {
  try {
    const deletedRecord = await Transaction.findByIdAndDelete(req.params.id);
    if (!deletedRecord) return res.status(404).json({ message: "Not found" });
    res.json({ message: "Deleted Successfully" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Keep Alive Logic ---
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);

  // প্রতি ১০ মিনিট পর পর সার্ভার নিজেকে পিং করবে যেন রেন্ডার স্লিপ না করে
  setInterval(() => {
    axios.get(`https://probashi-funds-api.onrender.com/ping`)
      .then(() => console.log('Keep-alive: Ping Success!'))
      .catch(err => console.log('Keep-alive: Ping Failed!', err.message));
  }, 600000); // ৬০০,০০০ মিলি-সেকেন্ড = ১০ মিনিট
});