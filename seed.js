import mongoose from "mongoose";
import dotenv from "dotenv";
import Expense from "./models/expense.model.js";
import Config from "./models/config.model.js";
// import sampleExpenses from "./sampleExpenses.json" assert { type: "json" };
// import initialConfig from "./initialConfig.json"  assert { type: "json" };

dotenv.config();
await mongoose.connect(process.env.MONGODB_URI);

 await Expense.deleteMany({});
// await Expense.insertMany(sampleExpenses);

 await Config.deleteMany({});
// await Config.create(initialConfig);

console.log("✅  Seed complete");
process.exit(0);
