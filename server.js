const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
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
  fundId: { type: String, required: true }, // এটি asahay-sahajjo, iftaar-tohobil ইত্যাদি হবে
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

// ১. নির্দিষ্ট ফান্ডের ডাটা দেখা (GET)
app.get('/api/:fundName', async (req, res) => {
  try {
    const { fundName } = req.params;
    // ডাটাবেস থেকে শুধু ওই ফান্ডের ডাটা ফিল্টার করে আনা হচ্ছে
    const data = await Transaction.find({ fundId: fundName }).sort({ date: -1 });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ২. নতুন ডাটা সেভ করা (POST)
app.post('/api/:fundName', async (req, res) => {
  try {
    const { fundName } = req.params;
    const newEntry = new Transaction({ 
      ...req.body, 
      fundId: fundName // URL থেকে নাম নিয়ে ডাটাবেসে সেভ হচ্ছে
    });
    await newEntry.save();
    res.status(201).json(newEntry);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ৩. ডাটা আপডেট করা (PUT)
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

// ৪. ডাটা ডিলিট করা (DELETE)
app.delete('/api/:fundName/:id', async (req, res) => {
  try {
    const deletedRecord = await Transaction.findByIdAndDelete(req.params.id);
    if (!deletedRecord) return res.status(404).json({ message: "Not found" });
    res.json({ message: "Deleted Successfully" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));