// server/index.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const asyncHandler = require("express-async-handler");
const XLSX = require("xlsx"); // Import xlsx package

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error(err));

// User model
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

// Hash password before saving
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare passwords
UserSchema.methods.comparePassword = function (password) {
  return bcrypt.compare(password, this.password);
};

const User = mongoose.model("User", UserSchema);

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

const Employee = mongoose.model("Employee", EmployeeSchema);

// Middleware to authenticate JWT
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) return res.sendStatus(403); // Forbidden

      req.user = user; // Attach user info to request
      next();
    });
  } else {
    res.sendStatus(401); // Unauthorized
  }
}

// Function to read data from a local Excel file and store it in MongoDB
app.post(
  "/api/read-excel",
  authenticateJWT,
  asyncHandler(async (req, res) => {
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

      let existingEmployee = [];
      // Check for existing employeeIds in MongoDB
      for (const employee of formattedData) {
        existingEmployee = await Employee.findOne({
          employeeId: employee.employeeId,
        });

        if (!existingEmployee) {
          await Employee.create(employee); // Insert if it doesn't exist
        } else {
          console.log(
            `Employee with ID ${employee.employeeId} already exists. Skipping...`
          );
        }
      }

      res
        .status(200)
        .json({ msg: "Data inserted successfully", data: formattedData });
    } catch (error) {
      console.error("Error reading Excel file:", error);
      res.status(500).send("Error reading Excel file");
    }
  })
);

// Function to write new data to a local Excel file without deleting existing data
// app.post(
//   "/api/write-excel",
//   authenticateJWT,
//   asyncHandler(async (req, res) => {
//     const { filePath, employeeData } = req.body;

//     // Check for duplicate employee IDs in the incoming data
//     const employeeIds = employeeData.map(employee => employee.employeeId);
//     const duplicateIds = employeeIds.filter((id, index) => employeeIds.indexOf(id) !== index);

//     if (duplicateIds.length > 0) {
//       return res.status(400).json({
//         msg: "Duplicate employee IDs found in the provided data",
//         duplicates: duplicateIds
//       });
//     }

//     try {
//       let existingData = [];
//       try {
//         const workbook = XLSX.readFile(filePath);
//         const sheetName = workbook.SheetNames[0];
//         existingData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
//       } catch (error) {
//         console.log("No existing Excel file found. Creating a new one.");
//       }

//       const combinedData = [...existingData, ...employeeData];

//       // Update or insert employee data in MongoDB
//       for (const employee of combinedData) {
//         await Employee.updateOne(
//           { employeeId: employee.employeeId },
//           { $set: employee },
//           { upsert: true }
//         );
//       }

//       // Write combined data to Excel file
//       const newWorkbook = XLSX.utils.book_new();
//       const newSheet = XLSX.utils.json_to_sheet(combinedData);
//       XLSX.utils.book_append_sheet(newWorkbook, newSheet, 'Employees');
//       XLSX.writeFile(newWorkbook, filePath);

//       res.status(201).send("Data written to Excel file successfully.");
//     } catch (error) {
//       console.error("Error writing to Excel file:", error);
//       res.status(500).send("Error writing to Excel file");
//     }
//   })
// );

app.post(
  "/api/write-excel",
  authenticateJWT,
  asyncHandler(async (req, res) => {
    const { filePath, employeeData } = req.body;

    // Check for duplicate employee IDs in the incoming data
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

      // Fetch existing employee IDs from the database
      const existingEmployees = await Employee.find({
        employeeId: { $in: employeeIds },
      });
      const existingEmployeeIds = existingEmployees.map(
        (emp) => emp.employeeId
      );

      // Filter out duplicates from the employeeData
      const filteredEmployeeData = employeeData.filter(
        (employee) => !existingEmployeeIds.includes(employee.employeeId)
      );

      if (filteredEmployeeData.length === 0) {
        return res.status(400).json({
          msg: "All employee IDs already exist in the database.",
        });
      }

      // Update or insert filtered employee data in MongoDB
      for (const employee of filteredEmployeeData) {
        await Employee.updateOne(
          { employeeId: employee.employeeId },
          { $set: employee },
          { upsert: true }
        );
      }

      // Combine existing and new data for the Excel file
      const combinedData = [...existingData, ...filteredEmployeeData];

      // Write combined data to Excel file
      const newWorkbook = XLSX.utils.book_new();
      const newSheet = XLSX.utils.json_to_sheet(combinedData);
      XLSX.utils.book_append_sheet(newWorkbook, newSheet, "Employees");
      XLSX.writeFile(newWorkbook, filePath);

      res.status(201).send("Data written to Excel file successfully.");
    } catch (error) {
      console.error("Error writing to Excel file:", error);
      res.status(500).send("Error writing to Excel file");
    }
  })
);

// User registration route
app.post(
  "/api/register",
  asyncHandler(async (req, res) => {
    const { username, password } = req.body;

    const userExists = await User.findOne({ username });

    if (userExists) {
      return res.status(400).send("User already exists.");
    }

    const user = new User({ username, password });
    await user.save();

    res.status(201).send("User registered successfully.");
  })
);

// User login route
app.post(
  "/api/login",
  asyncHandler(async (req, res) => {
    const { username, password } = req.body;

    const user = await User.findOne({ username });

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).send("Invalid credentials.");
    }

    // Generate JWT token for authenticated user
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({ token });
  })
);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
