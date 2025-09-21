import { Router } from "express";
import bcrypt from "bcrypt";
import Expense from "../models/expense.model.js";
import User from "../models/user.model.js";
import Config from "../models/config.model.js";

const router = Router();

const THIRTY_DAYS_MS = 1000 * 60 * 60 * 24 * 30;
const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "mw.sid";
const isProduction = process.env.NODE_ENV === "production";
const CLEAR_COOKIE_OPTIONS = {
  path: "/",
  httpOnly: true,
  sameSite: isProduction ? "none" : "lax",
  secure: isProduction,
};

const buildUserResponse = (user) => ({
  id: user._id,
  name: user.name,
  relation: user.relation,
  isAdmin: Boolean(user.isAdmin),
});

const startUserSession = (req, user) =>
  new Promise((resolve, reject) => {
    req.session.regenerate((regenerateErr) => {
      if (regenerateErr) {
        return reject(regenerateErr);
      }

      const payload = buildUserResponse(user);
      req.session.userId = user._id.toString();
      req.session.user = payload;
      req.session.cookie.maxAge = THIRTY_DAYS_MS;

      req.session.save((saveErr) => {
        if (saveErr) {
          return reject(saveErr);
        }

        resolve(payload);
      });
    });
  });

const ensureAuthenticated = (req, res, next) => {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Authentication required." });
  }

  next();
};

router.post("/auth/register", async (req, res) => {
  try {
    const { name, password, relation } = req.body;

    if (!name?.trim() || !password || !relation?.trim()) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const normalizedName = name.trim();
    const normalizedRelation = relation.trim();
    const exists = await User.exists({ name: normalizedName });
    if (exists) {
      return res.status(409).json({ message: "User already registered." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const newUser = await User.create({
      name: normalizedName,
      passwordHash,
      relation: normalizedRelation,
    });

    const payload = await startUserSession(req, newUser);
    return res.status(201).json(payload);
  } catch (err) {
    console.error("Registration error:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/auth/login", async (req, res) => {
  const { name, email, password } = req.body;
  const identifier = name?.trim() || email?.trim();

  if (!identifier || !password) {
    return res
      .status(400)
      .json({ message: "Name and password are required." });
  }

  try {
    const user = await User.findOne({ name: identifier });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const payload = await startUserSession(req, user);
    return res.status(200).json(payload);
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/auth/logout", (req, res) => {
  const finalizeLogout = () => {
    res.clearCookie(SESSION_COOKIE_NAME, CLEAR_COOKIE_OPTIONS);
    return res.status(200).json({ message: "Logged out" });
  };

  if (!req.session) {
    return finalizeLogout();
  }

  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err);
      return res.status(500).json({ message: "Failed to log out." });
    }

    return finalizeLogout();
  });
});

router.use(ensureAuthenticated);

// POST /api/expenses
router.post("/addExpenses", async (req, res) => {
  try {
    const doc = await Expense.create(req.body);
    return res.status(201).json(doc);
  } catch (err) {
    console.error("Expense create error:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

// GET /api/expenses (optionally filtered by query-params)
router.get("/", async (req, res) => {
  const {
    startDate,
    endDate,
    category,
    subcategory,
    mode,
  } = req.query;

  try {
    const query = {};
    if (startDate && endDate)
      query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    if (category && category !== "all-categories") query.category = category;
    if (subcategory && subcategory !== "all-subcategories")
      query.subcategory = subcategory;
    if (mode && mode !== "all-modes") query.mode = mode;

    const docs = await Expense.find(query).sort({ date: -1 });
    return res.json(docs);
  } catch (err) {
    console.error("Expenses fetch error:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

// GET /api/expenses/summary?type=weekly|monthly
router.get("/summary", async (req, res) => {
  const { type } = req.query;
  if (!["weekly", "monthly"].includes(type))
    return res.status(400).json({ error: "type must be weekly or monthly" });

  try {
    const now = new Date();
    const first =
      type === "weekly"
        ? new Date(now.setDate(now.getDate() - (now.getDay() || 7) + 1)) // Mon
        : new Date(now.getFullYear(), now.getMonth(), 1);

    const sum = await Expense.aggregate([
      { $match: { date: { $gte: first } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    return res.json({ total: sum[0]?.total || 0 });
  } catch (err) {
    console.error("Expenses summary error:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/config", async (_req, res) => {
  try {
    let config = await Config.findOne();
    if (!config) {
      config = await Config.create({});
      console.log("Created default config document");
    }

    return res.status(200).json(config);
  } catch (err) {
    console.error("Config fetch error:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.put("/config", async (req, res) => {
  const payload = req.body; // ExpenseConfig sent by React
  try {
    const updatedConfig = await Config.findOneAndUpdate(
      {},
      { ...payload, updatedBy: "api" }, // merge / override fields
      { new: true, upsert: true, runValidators: true }
    );
    return res.status(200).json(updatedConfig);
  } catch (err) {
    console.error("Config update error:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/expenses", async (_req, res) => {
  try {
    let expenses = await Expense.find();
    if (!expenses) {
      expenses = await Config.create({});
      console.log("Created default expenses document");
    }

    return res.status(200).json(expenses);
  } catch (err) {
    console.error("Expenses fetch error:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

// DELETE /api/expenses/:id
router.delete("/expenses/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Expense.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ message: "Expense not found" });
    }

    return res.status(200).json({ message: "Expense deleted successfully" });
  } catch (err) {
    console.error("Expense delete error:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;
