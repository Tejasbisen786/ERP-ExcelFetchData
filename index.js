// server/index.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const asyncHandler = require("express-async-handler");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

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

UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

UserSchema.methods.comparePassword = function (password) {
  return bcrypt.compare(password, this.password);
};

const User = mongoose.model("User", UserSchema);

// Employee model
const EmployeeSchema = new mongoose.Schema({
  employeeId: String,
  name: String,
  role: String,
  employmentType: String,
  status: String,
  checkIn: String,
  checkOut: String,
  workType: String,
});

const Employee = mongoose.model("Employee", EmployeeSchema);

// Middleware to authenticate JWT
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  console.log(authHeader);

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    console.log(token);

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      console.log(token);

      if (err) return res.sendStatus(403); // Forbidden

      req.user = user; // Attach user info to request
      next();
    });
  } else {
    res.sendStatus(401); // Unauthorized
  }
}

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

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({ token });
  })
);

app.get(
  "/api/employees",
  authenticateJWT,
  asyncHandler(async (req, res) => {
    const { google } = require("googleapis");
    const sheets = google.sheets({
      version: "v4",
      auth: process.env.GOOGLE_API_KEY,
    });

    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.SPREADSHEET_ID,
        range: "Sheet1!A2:H",
      });
      const rows = response.data.values;

      if (rows.length) {
        // Prepare an array to hold employee documents
        const employees = rows.map((row) => ({
          employeeId: row[0],
          name: row[1],
          role: row[2],
          employmentType: row[3],
          status: row[4],
          checkIn: row[5],
          checkOut: row[6],
          workType: row[7],
        }));

        // Store each employee document in MongoDB
        await Employee.insertMany(employees); // Use insertMany for bulk insert

        res.json(employees); // Send back the employees as a response
      } else {
        res.status(404).send("No data found.");
      }
    } catch (error) {
      console.error(error); // Log the error for debugging
      res.status(500).send(error.message);
    }
  })
);

// Post user data to Google Sheets
app.post(
  "/api/employees",
  authenticateJWT,
  asyncHandler(async (req, res) => {
    const { google } = require("googleapis");
    const sheets = google.sheets({
      version: "v4",
      auth: process.env.GOOGLE_API_KEY,
    });

    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.SPREADSHEET_ID,
        range: "Sheet1!A:H",
        valueInputOption: "RAW",
        resource: {
          values: [
            [
              req.body.employeeId,
              req.body.name,
              req.body.role,
              req.body.employmentType,
              req.body.status,
              req.body.checkIn,
              req.body.checkOut,
              req.body.workType,
            ],
          ],
        },
      });
      res.status(201).send("Data added to Google Sheets.");
    } catch (error) {
      res.status(500).send(error.message);
    }
  })
);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
