const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();

// মিডেলওয়্যার
app.use(cors({ origin: '*' })); 
app.use(express.json());

// মঙ্গোডিবি কানেকশন
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB Connected!"))
  .catch(err => console.error("❌ DB Error:", err));

// ট্রানজেকশন ও আবেদন স্কিমা
const transactionSchema = new mongoose.Schema({
  fundId: { type: String, required: true }, 
  type: { type: String, enum: ['donation', 'expense'], required: true },
  amount: { type: Number, required: true },
  donorName: String,
  receiverName: String,
  receiverPhone: String,    
  receiverAddress: String,  
  status: { type: String, default: 'approved' }, // approved, pending, rejected
  phone: String,
  note: String,
  date: { type: Date, default: Date.now }
}, { timestamps: true });

const Transaction = mongoose.model('Transaction', transactionSchema);

// ==========================================
// ১. সাধারণ ফান্ডের রুটস (ড্যাশবোর্ড ও মেইন হিসাব)
// ==========================================

// সার্ভার লাইভ রাখার পিং রুট
app.get('/ping', (req, res) => {
  res.status(200).send("Server is Alive!");
});

// ফিক্সড রুট ২: পুরোনো ডেটা এবং অনুমোদিত ডেটা একসাথে দেখানোর জন্য
app.get('/api/:fundName', async (req, res) => {
  try {
    const { fundName } = req.params;
    
    // লজিক ফিক্স: যেসব ডেটায় status ফিল্ড নেই (পুরোনো ডেটা) অথবা status এর মান 'approved' 
    // এবং status কোনোভাবেই 'pending' বা 'rejected' নয়—সেগুলো সবই আসবে।
    const data = await Transaction.find({ 
      fundId: fundName,
      status: { $nin: ['pending', 'rejected'] } 
    }).sort({ date: -1 });
    
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ড্যাশবোর্ড থেকে সরাসরি নতুন ডনেশন বা খরচ সেভ করা
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
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ড্যাশবোর্ডের কোনো ট্রানজেকশন এডিট করা
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

// ড্যাশবোর্ডের কোনো ট্রানজেকশন ডিলিট করা
app.delete('/api/:fundName/:id', async (req, res) => {
  try {
    const deletedRecord = await Transaction.findByIdAndDelete(req.params.id);
    if (!deletedRecord) return res.status(404).json({ message: "Not found" });
    res.json({ message: "Deleted Successfully" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// =========================================================================
// ২. আবেদনের রুটস (পেন্ডিং, অনুমোদন, বাতিল, এবং আবেদন এডিট সিস্টেম)
// =========================================================================

// ক. পাবলিক ফর্ম থেকে নতুন আবেদন সাবমিট করা
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

// ফিক্সড রুট খ: পেন্ডিং ও অন্যান্য অ্যাপ্লিকেশনের ডেটা পাওয়ার রুট
app.get('/api/:fundName/pending', async (req, res) => {
  try {
    const { fundName } = req.params;
    
    // অনেক সময় ফ্রন্টএন্ডে সরাসরি 'pending' অবজেক্ট খোঁজা হয়। 
    // তাই স্পষ্ট করে pending, approved, rejected স্ট্যাটাসের সব ডেটা পাঠানো হচ্ছে।
    const pendingData = await Transaction.find({ 
      fundId: fundName,
      status: { $in: ['pending', 'approved', 'rejected'] }
    }).sort({ createdAt: -1 });
    
    res.json(pendingData);
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

// গ. পেন্ডিং আবেদন এডিট (Edit) করার রুট 
app.put('/api/:fundName/pending/:id', async (req, res) => {
  try {
    const { id, fundName } = req.params;
    const updatedApplication = await Transaction.findByIdAndUpdate(
      id,
      { ...req.body, fundId: fundName },
      { new: true }
    );
    if (!updatedApplication) return res.status(404).json({ message: "আবেদনটি খুঁজে পাওয়া যায়নি।" });
    res.json({ message: "আবেদনটি সফলভাবে আপডেট করা হয়েছে।", data: updatedApplication });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ঘ. আবেদন অনুমোদন (Approve) করার রুট
app.post('/api/:fundName/pending/:id/approve', async (req, res) => {
  try {
    const { id, fundName } = req.params;
    const { amount } = req.body; 

    const updateFields = { status: 'approved', fundId: fundName };
    if (amount) updateFields.amount = Number(amount);

    const approvedApplication = await Transaction.findByIdAndUpdate(
      id,
      updateFields,
      { new: true }
    );
    if (!approvedApplication) return res.status(404).json({ message: "আবেদনটি খুঁজে পাওয়া যায়নি।" });
    res.json({ message: "আবেদনটি সফলভাবে অনুমোদন করা হয়েছে।", data: approvedApplication });
  } catch (err) { 
    res.status(400).json({ error: err.message }); 
  }
});

// ঙ. আবেদন বাতিল (Reject) করার রুট
app.post('/api/:fundName/pending/:id/reject', async (req, res) => {
  try {
    const { id, fundName } = req.params;
    const rejectedApplication = await Transaction.findByIdAndUpdate(
      id,
      { status: 'rejected', fundId: fundName },
      { new: true }
    );
    if (!rejectedApplication) return res.status(404).json({ message: "আবেদনটি খুঁজে পাওয়া যায়নি।" });
    res.json({ message: "আবেদনটি বাতিল করা হয়েছে।", data: rejectedApplication });
  } catch (err) { 
    res.status(400).json({ error: err.message }); 
  }
});

// চ. আবেদন চিরতরে ডাটাবেজ থেকে মুছে ফেলার রুট (DELETE)
app.delete('/api/:fundName/pending/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deletedApplication = await Transaction.findByIdAndDelete(id);
    if (!deletedApplication) return res.status(404).json({ message: "আবেদনটি খুঁজে পাওয়া যায়নি।" });
    res.json({ message: "আবেদনটি ডাটাবেজ থেকে চিরতরে মুছে ফেলা হয়েছে।" });
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

// ==========================================
// ৩. সার্ভার স্টার্ট এবং সেলফ-পিং লজিক
// ==========================================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);

  setInterval(() => {
    axios.get(`https://probashi-funds-api.onrender.com/ping`)
      .then(() => console.log('Keep-alive: Ping Success!'))
      .catch(err => console.log('Keep-alive: Ping Failed!', err.message));
  }, 600000); 
});