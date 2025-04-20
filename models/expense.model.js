// models/expense.model.js
import mongoose from "mongoose";

const ExpenseSchema = new mongoose.Schema(
  {
    category: { type: String, required: true },
    subcategory: { type: String, required: true },
    mode: { type: String, required: true },
    amount: { type: Number, required: true },
    date: { type: Date,   required: true },
    comments: String,
  },
  { timestamps: true }
);

export default mongoose.model("Expense", ExpenseSchema);
