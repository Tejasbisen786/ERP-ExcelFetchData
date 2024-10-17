const router = express.Router();

router.get("/", async (req, res) => {
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
});

module.exports = {
  router
};
