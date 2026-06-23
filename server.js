const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();

app.use(cors({ origin: '*' })); 
app.use(express.json());

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
  receiverPhone: String,    
  receiverAddress: String,  
  status: { type: String, default: 'approved' }, 
  phone: String,
  note: String,
  date: { type: Date, default: Date.now }
}, { timestamps: true });

const Transaction = mongoose.model('Transaction', transactionSchema);

// --- API Routes ---

app.get('/ping', (req, res) => {
  res.status(200).send("Server is Alive!");
});

// ১. নতুন অ্যাপ্লিকেশনের জন্য রুট (Pending হিসেবে জমা হবে)
app.post('/api/applications', async (req, res) => {
  try {
    const newApplication = new Transaction({
      ...req.body,
      status: 'pending' 
    });
    await newApplication.save();
    res.status(201).json({ message: 'আবেদনটি সফলভাবে পেন্ডিং লিস্টে জমা হয়েছে।', data: newApplication });
  } catch (err) { 
    res.status(400).json({ error: err.message }); 
  }
});

// ২. [নতুন যুক্ত করা হলো] নির্দিষ্ট ফান্ডের পেন্ডিং রিকোয়েস্টগুলো দেখার রুট
app.get('/api/:fundName/pending', async (req, res) => {
  try {
    const { fundName } = req.params;
    const pendingData = await Transaction.find({ fundId: fundName, status: 'pending' }).sort({ createdAt: -1 });
    res.json(pendingData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ৩. [নতুন যুক্ত করা হলো] পেন্ডিং আবেদন অনুমোদন (Approve) করার রুট
app.post('/api/:fundName/pending/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const approvedTx = await Transaction.findByIdAndUpdate(
      id,
      { status: 'approved' },
      { new: true }
    );
    if (!approvedTx) return res.status(404).json({ message: "Application not found" });
    res.json({ message: "Approved successfully", data: approvedTx });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ৪. [নতুন যুক্ত করা হলো] পেন্ডিং আবেদন বাতিল (Reject/Delete) করার রুট
app.delete('/api/:fundName/pending/:id', async (req, res) => {
  try {
    const deletedRecord = await Transaction.findByIdAndDelete(req.params.id);
    if (!deletedRecord) return res.status(404).json({ message: "Application not found" });
    res.json({ message: "Rejected and Deleted Successfully" });
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

// ৫. নির্দিষ্ট ফান্ডের শুধুমাত্র Approved ডাটা দেখা (ড্যাশবোর্ড মেইন ক্যালকুলেশন)
app.get('/api/:fundName', async (req, res) => {
  try {
    const { fundName } = req.params;
    const data = await Transaction.find({ fundId: fundName, status: 'approved' }).sort({ date: -1 });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ৬. নতুন ডিরেক্ট ডাটা সেভ করা (যেমন: অ্যাডমিন নিজে খরচ বা অনুদান এন্ট্রি দিলে)
app.post('/api/:fundName', async (req, res) => {
  try {
    const { fundName } = req.params;
    const newEntry = new Transaction({ 
      ...req.body, 
      fundId: fundName,
      status: 'approved' // সরাসরি এন্ট্রি দিলে অনুমোদিত থাকবে
    });
    await newEntry.save();
    res.status(201).json(newEntry);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ৭. ডাটা আপডেট করা
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

// ৮. এপ্রুভড ডাটা ডিলিট করা
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
  setInterval(() => {
    axios.get(`https://probashi-funds-api.onrender.com/ping`)
      .then(() => console.log('Keep-alive: Ping Success!'))
      .catch(err => console.log('Keep-alive: Ping Failed!', err.message));
  }, 600000); 
});