// models/config.model.js
import mongoose from "mongoose";

const ConfigSchema = new mongoose.Schema({
  categories:    [String],
  subcategories: mongoose.Schema.Types.Mixed, // { "House": ["Rent", ...] }
  modes:         [String],
});

export default mongoose.model("Config", ConfigSchema);
