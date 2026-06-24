const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios'); // Self-ping এর জন্য axios যুক্ত করা হয়েছে
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
  receiverPhone: String,    
  receiverAddress: String,  
  status: { type: String, default: 'approved' }, // Default: approved, আবেদনের জন্য হবে 'pending'
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

// ২. নির্দিষ্ট ফান্ডের ডাটা দেখা (GET) - শুধুমাত্র approved ডাটা ড্যাশবোর্ডে যাবে
app.get('/api/:fundName', async (req, res) => {
  try {
    const { fundName } = req.params;
    const data = await Transaction.find({ fundId: fundName, status: { $ne: 'pending' } }).sort({ date: -1 });
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


// =========================================================================
// 🆕 নতুন যুক্ত করা রাউটস: আবেদন সাবমিট, পেন্ডিং দেখা, এক্সেপ্ট এবং রিজেক্ট লজিক
// =========================================================================

// ক. নতুন আবেদনের জন্য সাধারণ রুট (পাবলিক ফর্ম থেকে সাবমিট করার জন্য)
app.post('/api/applications', async (req, res) => {
  try {
    const newApplication = new Transaction({
      ...req.body,
      status: 'pending' // সরাসরি পেন্ডিং লিস্টে জমা হবে
    });
    await newApplication.save();
    res.status(201).json({ message: 'আবেদনটি সফলভাবে পেন্ডিং লিস্টে জমা হয়েছে।', data: newApplication });
  } catch (err) { 
    res.status(400).json({ error: err.message }); 
  }
});

// খ. নির্দিষ্ট ফান্ডের পেন্ডিং আবেদনগুলো দেখার রুট (GET)
// উদাহরণ: /api/asahay-sahajjo/pending বা /api/applications?status=pending সব একসাথে দেখতে
app.get('/api/:fundName/pending', async (req, res) => {
  try {
    const { fundName } = req.params;
    // নির্দিষ্ট ফান্ডের শুধুমাত্র pending স্ট্যাটাসের ডাটা ফিল্টার করবে
    const pendingData = await Transaction.find({ fundId: fundName, status: 'pending' }).sort({ createdAt: -1 });
    res.json(pendingData);
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

// গ. আবেদন অনুমোদন (Approve) করার রুট (POST)
// স্ট্যাটাস 'pending' থেকে 'approved' এ পরিবর্তন হবে এবং মেইন ড্যাশবোর্ড ক্যালকুলেশনে ঢুকে যাবে
app.post('/api/:fundName/pending/:id/approve', async (req, res) => {
  try {
    const { id, fundName } = req.params;
    const approvedApplication = await Transaction.findByIdAndUpdate(
      id,
      { status: 'approved', fundId: fundName }, // স্ট্যাটাস পরিবর্তন ও ফান্ড নিশ্চিত করা
      { new: true }
    );
    if (!approvedApplication) return res.status(404).json({ message: "আবেদনটি খুঁজে পাওয়া যায়নি।" });
    res.json({ message: "আবেদনটি সফলভাবে অনুমোদন করা হয়েছে।", data: approvedApplication });
  } catch (err) { 
    res.status(400).json({ error: err.message }); 
  }
});

// ঘ. আবেদন বাতিল (Reject/Delete) করার রুট (DELETE)
// আবেদনটি ডাটাবেজ থেকে সম্পূর্ণ মুছে ফেলা হবে অথবা আপনি চাইলে status: 'rejected' করতে পারেন (এখানে ডিলিট করে দেওয়া হয়েছে)
app.delete('/api/:fundName/pending/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const rejectedApplication = await Transaction.findByIdAndDelete(id);
    if (!rejectedApplication) return res.status(404).json({ message: "আবেদনটি খুঁজে পাওয়া যায়নি।" });
    res.json({ message: "আবেদনটি সফলভাবে বাতিল বা মুছে ফেলা হয়েছে।" });
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

// ==========================================


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