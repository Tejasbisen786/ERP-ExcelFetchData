const express = require("express");
const { readExcel, writeExcel } = require("../controllers/employeeController");
const authenticateJWT = require("../middlewares/authMiddleware");

const router = express.Router();

router.post("/read-excel", authenticateJWT, readExcel);
router.post("/write-excel", authenticateJWT, writeExcel);

module.exports = router;
