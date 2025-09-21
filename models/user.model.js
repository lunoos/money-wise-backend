import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
      name:         { type: String, required: true, trim: true },
      passwordHash: { type: String, required: true },
      relation:     { type: String, required: true },
      isAdmin:      { type: Boolean, default: false }
    },
    { timestamps: true }
  );

export default mongoose.model('User', userSchema);
