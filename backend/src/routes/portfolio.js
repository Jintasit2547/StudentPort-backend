// src/routes/portfolio.js
import express from "express";
import { auth, allowRoles } from "../middleware/auth.js";
import Portfolio from "../models/Portfolio.js";

const router = express.Router();

/* ------------------------ Sprint 1 (เดิม) ------------------------ */
/**
 * POST /api/portfolio
 * สร้าง portfolio ใหม่ (Sprint 1)
 */
router.post("/", auth, async (req, res) => {
  try {
    const { title, desc, fileUrl, visibility } = req.body;

    const portfolio = await Portfolio.create({
      owner: req.user.id,
      title,
      desc,
      fileUrl: fileUrl || null,
      visibility: visibility || "private",
      status: "submitted",
      // กันกรณียังไม่เคยมี statusV2 ใน schema เก่า
      statusV2: "Draft",
    });

    return res.status(201).json({ message: "Portfolio created", data: portfolio });
  } catch (err) {
    console.error("Create portfolio error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * GET /api/portfolio/mine
 * ดู portfolio ของตัวเอง
 */
router.get("/mine", auth, async (req, res) => {
  try {
    const list = await Portfolio.find({ owner: req.user.id }).sort({ createdAt: -1 });
    return res.json(list);
  } catch (err) {
    console.error("Get my portfolio error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * PUT /api/portfolio/:id/visibility
 * เจ้าของเปลี่ยน public/private ได้
 */
router.put("/:id/visibility", auth, async (req, res) => {
  try {
    const { visibility } = req.body;

    if (!["public", "private"].includes(visibility)) {
      return res.status(400).json({ message: "Invalid visibility value" });
    }

    const portfolio = await Portfolio.findById(req.params.id);
    if (!portfolio) return res.status(404).json({ message: "Portfolio not found" });

    if (portfolio.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: "You cannot change this portfolio" });
    }

    // ✅ เพิ่ม: อนุญาตเฉพาะงานที่ Approved ให้ public ได้
    if (visibility === "public" && portfolio.statusV2 !== "Approved") {
      return res.status(400).json({ message: "Only Approved portfolios can be set to public" });
    }

    portfolio.visibility = visibility;
    await portfolio.save();

    return res.json({ message: "Visibility updated", data: portfolio });
  } catch (err) {
    console.error("Update visibility error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/* ------------------------ Sprint 3 (ต่อเติม) ------------------------ */
/** helper: map สถานะเก่ามาเป็น v2 (กันพังเวลางานเก่าจาก sprint 1) */
function normalizeV2Status(p) {
  if (p.statusV2) return; // มีอยู่แล้ว
  if (p.status === "approved") p.statusV2 = "Approved";
  else if (p.status === "rejected") p.statusV2 = "Rejected";
  else p.statusV2 = "Pending"; // เดิมคือ submitted
}

/**
 * GET /api/portfolio/review/pending
 * ดูงานที่ Pending (เฉพาะ Admin)
 */
router.get(
  "/review/pending",
  auth,
  allowRoles("AdvisorAdmin", "SuperAdmin"),
  async (req, res) => {
    try {
      const list = await Portfolio.find({ statusV2: "Pending" }).populate(
        "owner",
        "displayName email"
      );
      return res.json(list);
    } catch (err) {
      console.error("review/pending error:", err);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * POST /api/portfolio/:id/review/approve
 * AdvisorAdmin → ส่งต่อให้ SuperAdmin (Pending -> InProcess)
 */
router.post(
  "/:id/review/approve",
  auth,
  allowRoles("AdvisorAdmin"),
  async (req, res) => {
    try {
      const portfolio = await Portfolio.findById(req.params.id);
      if (!portfolio) return res.status(404).json({ message: "Not found" });

      normalizeV2Status(portfolio);

      if (portfolio.statusV2 !== "Pending") {
        return res.status(400).json({ message: "Only Pending allowed" });
      }

      portfolio.statusV2 = "InProcess";
      portfolio.reviewer = req.user.id;
      portfolio.reviewComment = req.body?.comment || "";
      await portfolio.save();

      return res.json({ message: "Forwarded to SuperAdmin", portfolio });
    } catch (err) {
      console.error("review/approve error:", err);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * POST /api/portfolio/:id/review/reject
 * AdvisorAdmin → ปฏิเสธ (→ Rejected, บวก revision)
 */
router.post(
  "/:id/review/reject",
  auth,
  allowRoles("AdvisorAdmin"),
  async (req, res) => {
    try {
      const portfolio = await Portfolio.findById(req.params.id);
      if (!portfolio) return res.status(404).json({ message: "Not found" });

      normalizeV2Status(portfolio);

      portfolio.statusV2 = "Rejected";
      portfolio.reviewer = req.user.id;
      portfolio.reviewComment = req.body?.comment || "No comment";
      portfolio.revision = (portfolio.revision ?? 0) + 1;
      await portfolio.save();

      return res.json({ message: "Rejected", portfolio });
    } catch (err) {
      console.error("review/reject error:", err);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * POST /api/portfolio/:id/final/approve
 * SuperAdmin → อนุมัติขั้นสุดท้าย (InProcess -> Approved)
 */
router.post(
  "/:id/final/approve",
  auth,
  allowRoles("SuperAdmin"),
  async (req, res) => {
    try {
      const portfolio = await Portfolio.findById(req.params.id);
      if (!portfolio) return res.status(404).json({ message: "Not found" });

      normalizeV2Status(portfolio);

      if (!["InProcess", "Pending"].includes(portfolio.statusV2)) {
        return res.status(400).json({ message: "Only InProcess/Pending can be approved" });
      }

      portfolio.statusV2 = "Approved";
      portfolio.reviewComment = req.body?.comment || "";
      await portfolio.save();

      return res.json({ message: "Final Approved", portfolio });
    } catch (err) {
      console.error("final/approve error:", err);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * POST /api/portfolio/:id/final/reject
 * SuperAdmin → ปฏิเสธขั้นสุดท้าย (→ Rejected, บวก revision)
 */
router.post(
  "/:id/final/reject",
  auth,
  allowRoles("SuperAdmin"),
  async (req, res) => {
    try {
      const portfolio = await Portfolio.findById(req.params.id);
      if (!portfolio) return res.status(404).json({ message: "Not found" });

      normalizeV2Status(portfolio);

      portfolio.statusV2 = "Rejected";
      portfolio.reviewComment = req.body?.comment || "";
      portfolio.revision = (portfolio.revision ?? 0) + 1;
      await portfolio.save();

      return res.json({ message: "Final Rejected", portfolio });
    } catch (err) {
      console.error("final/reject error:", err);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

/** -------------------------------------------
 * ✅ Sprint 4: Search / View + Edit & Resubmit + Profile Filter
 * ------------------------------------------*/

/**
 * GET /api/portfolio/public
 * ดูผลงานสาธารณะ (Approved เท่านั้น) + ตัวกรองพื้นฐาน
 * query:
 *  - q       : keyword (title/description/category)
 *  - year    : year
 *  - category: category
 *  - page,limit: pagination
 */
router.get("/public", async (req, res) => {
  try {
    const { q, year, category, page = 1, limit = 12 } = req.query;

    const filter = { visibility: "public", statusV2: "Approved" };

    if (year) filter.yearOfProject = Number(year);
    if (category) filter.category = String(category).trim();

    if (q) {
      const regex = new RegExp(String(q).trim(), "i");
      filter.$or = [{ title: regex }, { description: regex }, { category: regex }];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Portfolio.find(filter)
        .populate("owner", "displayName email university role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Portfolio.countDocuments(filter),
    ]);

    return res.json({ page: Number(page), limit: Number(limit), total, items });
  } catch (err) {
    console.error("public search error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * GET /api/portfolio/:id/public
 * รายละเอียดงานสาธารณะ (Approved + public เท่านั้น)
 */
router.get("/:id/public", async (req, res) => {
  try {
    const p = await Portfolio.findOne({
      _id: req.params.id,
      visibility: "public",
      statusV2: "Approved",
    }).populate("owner", "displayName email role");

    if (!p) return res.status(404).json({ message: "Not found or not public" });
    return res.json(p);
  } catch (err) {
    console.error("get public by id error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/* ------------------------ Sprint 4: Edit & Resubmit ------------------------ */
/**
 * PUT /api/portfolio/:id/edit
 * นักศึกษาแก้งานได้เฉพาะ Draft / Rejected
 * ฟิลด์: title, description, year, category
 */
router.put("/:id/edit", auth, async (req, res) => {
  try {
    const { title, description, year, category } = req.body;

    const p = await Portfolio.findById(req.params.id);
    if (!p) return res.status(404).json({ message: "Not found" });
    if (p.owner.toString() !== req.user.id)
      return res.status(403).json({ message: "Not yours" });
    if (!["Draft", "Rejected"].includes(p.statusV2))
      return res.status(400).json({ message: "Only Draft/Rejected can be edited" });

    if (title !== undefined) p.title = title;
    if (description !== undefined) p.description = description;
    if (category !== undefined) p.category = category;
    if (year !== undefined) {
      const y = Number(year);
      if (!Number.isInteger(y) || y < 1900 || y > 3000)
        return res.status(400).json({ message: "Year must be a valid year" });
      p.yearOfProject = y;
    }

    p.reviewComment = "";
    await p.save();
    return res.json({ message: "Updated draft", data: p });
  } catch (err) {
    console.error("edit error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/* ------------------------ Sprint 4: Filter Portfolio by User Profile ------------------------ */
/**
 * GET /api/portfolio/user/:userId
 * ดูผลงานของคนหนึ่ง (Public only if guest)
 * query: q, year, category
 */
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { q, year, category } = req.query;

    const filter = { owner: userId, statusV2: "Approved" };
    if (!req.user || req.user.id !== userId) filter.visibility = "public";

    if (year) filter.yearOfProject = Number(year);
    if (category) filter.category = String(category).trim();

    if (q) {
      const regex = new RegExp(String(q).trim(), "i");
      filter.$or = [{ title: regex }, { description: regex }, { category: regex }];
    }

    const items = await Portfolio.find(filter)
      .populate("owner", "displayName email university role")
      .sort({ createdAt: -1 });

    return res.json(items);
  } catch (err) {
    console.error("filter by user error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
