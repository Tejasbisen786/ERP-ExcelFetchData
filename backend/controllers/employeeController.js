const Employee = require("../models/Employee");
const XLSX = require("xlsx");
const asyncHandler = require("express-async-handler");

exports.readExcel = asyncHandler(async (req, res) => {
  const filePath = req.body.filePath;

  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    const formattedData = sheetData.map((item) => ({
      employeeId: item["Employee ID"],
      name: item["Name"],
      role: item["Role"],
      employmentType: item["Employment Type"],
      status: item["Status"],
      checkIn: item["Check-In"],
      checkOut: item["Check-Out"],
      workType: item["Work Type"],
    }));

    const employeeIds = formattedData.map((employee) => employee.employeeId);
    const duplicateIds = employeeIds.filter(
      (id, index) => employeeIds.indexOf(id) !== index
    );

    if (duplicateIds.length > 0) {
      return res.status(400).json({
        msg: "Duplicate employee IDs found in the Excel sheet",
        duplicates: duplicateIds,
      });
    }

    for (const employee of formattedData) {
      const existingEmployee = await Employee.findOne({
        employeeId: employee.employeeId,
      });

      if (!existingEmployee) {
        await Employee.create(employee); // Insert if it doesn't exist
      } else {
        console.log(`Employee with ID ${employee.employeeId} already exists. Skipping...`);
      }
    }

    res.status(200).json({ msg: "Data inserted successfully", data: formattedData });
  } catch (error) {
    console.error("Error reading Excel file:", error);
    res.status(500).send("Error reading Excel file");
  }
});

exports.writeExcel = asyncHandler(async (req, res) => {
  const { filePath, employeeData } = req.body;

  const employeeIds = employeeData.map((employee) => employee.employeeId);
  const duplicateIds = employeeIds.filter(
    (id, index) => employeeIds.indexOf(id) !== index
  );

  if (duplicateIds.length > 0) {
    return res.status(400).json({
      msg: "Duplicate employee IDs found in the provided data",
      duplicates: duplicateIds,
    });
  }

  try {
    let existingData = [];
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      existingData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    } catch (error) {
      console.log("No existing Excel file found. Creating a new one.");
    }

    const existingEmployees = await Employee.find({
      employeeId: { $in: employeeIds },
    });
    const existingEmployeeIds = existingEmployees.map((emp) => emp.employeeId);

    const filteredEmployeeData = employeeData.filter(
      (employee) => !existingEmployeeIds.includes(employee.employeeId)
    );

    if (filteredEmployeeData.length === 0) {
      return res.status(400).json({
        msg: "All employee IDs already exist in the database.",
      });
    }

    for (const employee of filteredEmployeeData) {
      await Employee.updateOne(
        { employeeId: employee.employeeId },
        { $set: employee },
        { upsert: true }
      );
    }

    const combinedData = [...existingData, ...filteredEmployeeData];

    const newWorkbook = XLSX.utils.book_new();
    const newSheet = XLSX.utils.json_to_sheet(combinedData);
    XLSX.utils.book_append_sheet(newWorkbook, newSheet, "Employees");
    XLSX.writeFile(newWorkbook, filePath);

    res.status(201).send("Data written to Excel file successfully.");
  } catch (error) {
    console.error("Error writing to Excel file:", error);
    res.status(500).send("Error writing to Excel file");
  }
});
