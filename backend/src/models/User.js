// src/models/User.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },

    password: {
      type: String,
      required: true,
    },

    displayName: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["Student", "AdvisorAdmin", "SuperAdmin", "Recruiter"],
      default: "Student",
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending", // ต้องรออนุมัติจาก Admin
    },

    studentCardUrl: String,
    employeeCardUrl: String,

    provider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },

    /* ✅ NEW field for university (โชว์ใน UI เช่น KMUTT) */
    university: {
      type: String,
      default: "KMUTT", // ตั้งค่าเริ่มต้น หรือให้ frontend กรอกเองก็ได้
    },

    /* ✅ Optional profile fields */
    bio: String,
    contactEmail: String,
    phone: String,
    profileImageUrl: String,

    socialLinks: {
      linkedin: String,
      github: String,
      facebook: String,
      website: String,
    },

    /* ✅ Optional: reset password feature */
    resetPasswordToken: String,
    resetPasswordExpires: Date,
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
