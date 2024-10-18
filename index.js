// server/index.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const asyncHandler = require("express-async-handler");
const { google } = require("googleapis");

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

// Function to authenticate and get OAuth2 client for Google Sheets API
function authorize() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } =
    process.env;

  const oAuth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );

  // Load previously stored token or request new authorization
  let token;

  try {
    token = process.env.GOOGLE_TOKEN; // Assuming you store your token in the environment variable as well
    if (!token || token === "{}") throw new Error("Token not found"); // Check if token is missing or empty
    oAuth2Client.setCredentials(JSON.parse(token));
  } catch (error) {
    console.error("Token not found:", error);
    throw new Error("Authorization required");
  }

  return oAuth2Client;
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

    // Generate JWT token for authenticated user
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({ token });
  })
);

// Google OAuth authorization route
app.get("/api/auth/google", (req, res) => {
  const { GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI } = process.env;

  const oAuth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    "",
    GOOGLE_REDIRECT_URI
  );

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/spreadsheets", // Scope for Google Sheets
    ],
  });

  res.redirect(authUrl);
});

// Google OAuth callback route
app.get("/api/auth/google/callback", async (req, res) => {
  const { code } = req.query;

  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } =
    process.env;

  const oAuth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );

  try {
    const { tokens } = await oAuth2Client.getToken(code);

    // Save the token in an environment variable or a database for future use
    process.env.GOOGLE_TOKEN = JSON.stringify(tokens); // For testing purposes; consider using a more secure storage solution

    res.send("Authorization successful! You can now use the API.");
  } catch (error) {
    console.error("Error during OAuth callback:", error);
    res.status(500).send("Failed to retrieve access token");
  }
});

// Get employees from Google Sheets and store in MongoDB
app.get(
  "/api/employees",
  authenticateJWT,
  asyncHandler(async (req, res) => {
    const auth = authorize(); // Get authenticated client for Google Sheets API
    const sheets = google.sheets({ version: "v4", auth });

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
    try {
      const auth = authorize(); // Get authenticated client for Google Sheets API
      const sheets = google.sheets({ version: "v4", auth });

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
      console.error("Error adding data to Google Sheets:", error);
      res.status(500).send(error.message);
    }
  })
);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
