// src/models/Portfolio.js
import mongoose from "mongoose";

const PortfolioSchema = new mongoose.Schema(
  {
    // เจ้าของผลงาน
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // ===== ฟิลด์หลัก =====
    title: { type: String, required: true },     // Title
    description: { type: String, default: "" },  // Description
    year: { type: Number, required: true },      // Year (ใช้ field นี้จริง ๆ)
    category: { type: String, required: true },  // Category (AI, Web, UX, ...)

    // Attach files (images 1–10)
    images: { type: [String], default: [] },
    coverImageUrl: { type: String },

    // ===== เวิร์กโฟลว์ =====
    visibility: {
      type: String,
      enum: ["public", "private"],
      default: "private",
      index: true,
    },
    statusV2: {
      type: String,
      enum: ["Draft", "Pending", "InProcess", "Approved", "Rejected"],
      default: "Draft",
      index: true,
    },
    reviewComment: { type: String },
    reviewer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    revision: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// ✅ ปรับ index ให้ใช้ year (ไม่ใช่ yearOfProject)
PortfolioSchema.index({
  visibility: 1,
  statusV2: 1,
  year: 1,
  category: 1,
  owner: 1,
});

// ❌ ไม่ต้องมี transform แปลง yearOfProject -> year อีกต่อไป เพราะเราเก็บเป็น year แล้ว

const Portfolio = mongoose.model("Portfolio", PortfolioSchema);
export default Portfolio;
