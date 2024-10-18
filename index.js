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
app.post("/api/read-excel", authenticateJWT, asyncHandler(async (req, res) => {
    const filePath = req.body.filePath; // Get the file path from the request body

    try {
        // Read the Excel file
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0]; // Get the first sheet name
        const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]); // Convert sheet to JSON

        // Store data in MongoDB
        await Employee.insertMany(sheetData); // Save data to Employee collection

        res.status(200).json(sheetData); // Send back the data as response
    } catch (error) {
        console.error('Error reading Excel file:', error);
        res.status(500).send('Error reading Excel file');
    }
}));

// Function to write new data to a local Excel file without deleting existing data
app.post("/api/write-excel", authenticateJWT, asyncHandler(async (req, res) => {
    const { filePath, employeeData } = req.body; // Get the file path and employee data from the request body

    try {
        let existingData = [];

        // Check if the file exists and read existing data
        try {
            const workbook = XLSX.readFile(filePath);
            const sheetName = workbook.SheetNames[0]; // Get the first sheet name
            existingData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]); // Convert sheet to JSON
        } catch (error) {
            console.log('No existing Excel file found. Creating a new one.');
        }

        // Combine existing and new employee data
        const combinedData = [...existingData, ...employeeData];

        // Create a new workbook and worksheet with combined data
        const newWorkbook = XLSX.utils.book_new();
        const newWorksheet = XLSX.utils.json_to_sheet(combinedData); // Convert combined JSON to worksheet

        XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, "Employees"); // Append worksheet to workbook

        // Write to the specified Excel file
        XLSX.writeFile(newWorkbook, filePath);

        res.status(201).send("Data written to Excel file successfully.");
    } catch (error) {
        console.error('Error writing to Excel file:', error);
        res.status(500).send('Error writing to Excel file');
    }
}));

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