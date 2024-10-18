# //Register API
http://localhost:5000/api/auth/register

payload:

{
  "username": "testuser",
  "password": "testpassword"
}


# //Login API
http://localhost:5000/api/auth/login

payload :

{
  "username": "testuser",
  "password": "testpassword"
}

# // Read Excel Data [API}

URL: http://localhost:5000/api/employees/read-excel

payload:
{
  "filePath": "path/to/your/excel/file.xlsx"
}

#  Write Excel Data [API]
URL: http://localhost:5000/api/employees/write-excel

payload:-

{
  "filePath": "path/to/your/excel/file.xlsx",
  "employeeData": [
    {
      "employeeId": "123",
      "name": "John Doe",
      "role": "Developer",
      "employmentType": "Full-time",
      "status": "Active",
      "checkIn": "9:00 AM",
      "checkOut": "5:00 PM",
      "workType": "Remote"
    }
  ]
}
