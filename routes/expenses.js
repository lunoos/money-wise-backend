import { Router } from "express";
import Expense from "../models/expense.model.js";
import User from "../models/user.model.js" 
import bcrypt from 'bcrypt';
import Config from "../models/config.model.js"

const router = Router();

// POST /api/expenses
router.post("/addExpenses", async (req, res) => {
  const doc = await Expense.create(req.body);
  res.status(201).json(doc);
});


// GET /api/expenses (optionally filtered by query‑params)
router.get("/", async (req, res) => {
  const {
    startDate,
    endDate,
    category,
    subcategory,
    mode,
  } = req.query;

  const query = {};
  if (startDate && endDate)
    query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
  if (category && category !== "all-categories")     query.category    = category;
  if (subcategory && subcategory !== "all-subcategories") query.subcategory = subcategory;
  if (mode && mode !== "all-modes")                 query.mode        = mode;

  const docs = await Expense.find(query).sort({ date: -1 });
  res.json(docs);
});

// GET /api/expenses/summary?type=weekly|monthly
router.get("/summary", async (req, res) => {
  const { type } = req.query;
  if (!["weekly", "monthly"].includes(type))
    return res.status(400).json({ error: "type must be weekly or monthly" });

  const now = new Date();
  const first =
    type === "weekly"
      ? new Date(now.setDate(now.getDate() - (now.getDay() || 7) + 1)) // Mon
      : new Date(now.getFullYear(), now.getMonth(), 1);

  const sum = await Expense.aggregate([
    { $match: { date: { $gte: first } } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  res.json({ total: sum[0]?.total || 0 });
});

router.post('/auth/register', async (req, res) => {
  try {
    const { name, password, relation } = req.body;

    if (!name || !password || !relation) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const exists = await User.exists({ name });
    if (exists) {
      return res.status(409).json({ message: 'User already registered.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const newUser      = await User.create({ name, passwordHash, relation });

    return res.status(201).json({
      id:        newUser._id,
      name:      newUser.name,
      relation:  newUser.relation,
      createdAt: newUser.createdAt
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  console.log("email: "+email+" password "+password);
  if (!email || !password)
    return res.status(400).json({ message: 'Email and password are required.' });

  try {
    const user = await User.findOne({ name: email });
    const passwordMatch = user && await bcrypt.compare(password, user.passwordHash);
    console.log("user "+user);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    return res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        relation: user.relation
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.get('/config', async (_req, res) => {
  try {
    let config = await Config.findOne();
    console.log("config "+config);
    // If no config document exists, seed a default one
    if (!config) {
      config = await Config.create({});
      console.log('Created default config document');
    }

    return res.status(200).json(config);
  } catch (err) {
    console.error('Config fetch error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.put('/config', async (req, res) => {
  const payload = req.body;                    // ExpenseConfig sent by React
  console.log("payload "+payload);
  try {
    // upsert:true → create if none exists; new:true → return updated doc
    const updatedConfig = await Config.findOneAndUpdate(
      {},
      { ...payload, updatedBy: 'api' },         // merge / override fields
      { new: true, upsert: true, runValidators: true }
    );
    return res.status(200).json(updatedConfig);
  } catch (err) {
    console.error('Config update error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.get('/expenses', async (_req, res) => {
  try {
    let expenses = await Expense.find();
    console.log("expenses "+expenses);
    // If no config document exists, seed a default one
    if (!expenses) {
      expenses = await Config.create({});
      console.log('Created default expenses document');
    }

    return res.status(200).json(expenses);
  } catch (err) {
    console.error('expenses fetch error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// DELETE /api/expenses/:id
router.delete('/expenses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Expense.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    return res.status(200).json({ message: 'Expense deleted successfully' });
  } catch (err) {
    console.error('Expense delete error:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
});



export default router;
