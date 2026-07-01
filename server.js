'use client';

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB Connected!"))
  .catch(err => console.error("❌ DB Error:", err));

const transactionSchema = new mongoose.Schema({
  fundId: { type: String, required: true },
  type: { type: String, enum: ['donation', 'expense'], required: true },
  amount: { type: Number, required: true },
  donorName: String,
  receiverName: String,
  receiverPhone: String,
  receiverAddress: String,
  phone: String,
  note: String,
  status: { type: String, default: 'pending', enum: ['pending', 'approved', 'rejected'] },
  date: { type: Date, default: Date.now }
}, { timestamps: true });

const Transaction = mongoose.model('Transaction', transactionSchema);

// ====================== COMMON ROUTES ======================

app.get('/ping', (req, res) => res.status(200).send("Server is Alive!"));

// সব ট্রানজেকশন ফান্ড অনুসারে
app.get('/api/:fundName', async (req, res) => {
  try {
    const { fundName } = req.params;
    const data = await Transaction.find({ fundId: fundName }).sort({ createdAt: -1 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// নতুন ডোনেশন/খরচ সেভ
app.post('/api/:fundName', async (req, res) => {
  try {
    const { fundName } = req.params;
    const newEntry = new Transaction({ 
      ...req.body, 
      fundId: fundName,
      status: 'approved' 
    });
    await newEntry.save();
    res.status(201).json(newEntry);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ====================== APPLICATION / PENDING ROUTES ======================

// পাবলিক আবেদন জমা (Pending)
app.post('/api/applications', async (req, res) => {
  try {
    const newApp = new Transaction({ 
      ...req.body, 
      status: 'pending',
      fundId: req.body.fundId || 'asahay-sahajjo'
    });
    await newApp.save();
    res.status(201).json({ message: 'আবেদন সফলভাবে জমা হয়েছে', data: newApp });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// সব আবেদন (Pending + Approved + Rejected)
app.get('/api/applications', async (req, res) => {
  try {
    const data = await Transaction.find({ status: { $in: ['pending', 'approved', 'rejected'] } })
      .sort({ createdAt: -1 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ফান্ড অনুসারে সব আবেদন (Pending + Approved + Rejected)
app.get('/api/:fundName/pending', async (req, res) => {
  try {
    const { fundName } = req.params;
    const data = await Transaction.find({ 
      fundId: fundName,
      status: { $in: ['pending', 'approved', 'rejected'] }
    }).sort({ createdAt: -1 });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approve
app.post('/api/:fundName/pending/:id/approve', async (req, res) => {
  try {
    const { id, fundName } = req.params;
    const { amount } = req.body;

    const update = { status: 'approved', fundId: fundName };
    if (amount) update.amount = Number(amount);

    const updated = await Transaction.findByIdAndUpdate(id, update, { new: true });
    if (!updated) return res.status(404).json({ message: "আবেদন পাওয়া যায়নি" });

    res.json({ message: "অনুমোদন সফল", data: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Reject
app.post('/api/:fundName/pending/:id/reject', async (req, res) => {
  try {
    const { id, fundName } = req.params;
    const updated = await Transaction.findByIdAndUpdate(
      id,
      { status: 'rejected', fundId: fundName },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "আবেদন পাওয়া যায়নি" });
    res.json({ message: "বাতিল করা হয়েছে", data: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete
app.delete('/api/:fundName/pending/:id', async (req, res) => {
  try {
    const deleted = await Transaction.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "আবেদন পাওয়া যায়নি" });
    res.json({ message: "ডাটা মুছে ফেলা হয়েছে" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Server Start
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);

  setInterval(() => {
    axios.get(`https://probashi-funds-api.onrender.com/ping`)
      .then(() => console.log('✅ Keep-alive ping success'))
      .catch(() => console.log('⚠️ Keep-alive ping failed'));
  }, 600000);
});