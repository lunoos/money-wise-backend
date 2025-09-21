import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import session from "express-session";
import MongoStore from "connect-mongo";
import expenseRoutes from "./routes/expenses.js";

dotenv.config();

await mongoose.connect(process.env.MONGODB_URI);
console.log("✅  MongoDB connected");

const app = express();
const isProduction = process.env.NODE_ENV === "production";
const THIRTY_DAYS_MS = 1000 * 60 * 60 * 24 * 30;
const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "mw.sid";

app.set("trust proxy", 1);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
      : true,
    credentials: true,
  })
);
app.use(express.json());
app.use(
  session({
    name: SESSION_COOKIE_NAME,
    secret: process.env.SESSION_SECRET || "change-me",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      ttl: THIRTY_DAYS_MS / 1000,
    }),
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: THIRTY_DAYS_MS,
    },
  })
);

app.use("/api", expenseRoutes);

app.listen(process.env.PORT, () =>
  console.log(`🚀  API ready on http://localhost:${process.env.PORT}`)
);
