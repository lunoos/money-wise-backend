import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import expenseRoutes from "./routes/expenses.js";

dotenv.config();

await mongoose.connect(process.env.MONGODB_URI);
console.log("✅  MongoDB connected");

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api", expenseRoutes);

app.listen(process.env.PORT, () =>
  console.log(`🚀  API ready on http://localhost:${process.env.PORT}`)
);
