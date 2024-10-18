const mongoose = require("mongoose");

const EmployeeSchema = new mongoose.Schema({
  employeeId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  role: { type: String, required: true },
  employmentType: { type: String, required: true },
  status: { type: String, required: true },
  checkIn: { type: String, required: true },
  checkOut: { type: String, required: true },
  workType: { type: String, required: true },
});

module.exports = mongoose.model("Employee", EmployeeSchema);
