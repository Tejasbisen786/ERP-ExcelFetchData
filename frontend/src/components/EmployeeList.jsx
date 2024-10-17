
// ### Step 3: Create Employee Management Components

// 1. **Create Employee List Component**:
// Create a file named `EmployeeList.js` in the `components` directory:
// ```javascript
// // src/components/EmployeeList.js

import React, { useEffect, useState } from 'react';
import axios from 'axios';

const EmployeeList = ({ token }) => {
    const [employees, setEmployees] = useState([]);
    const [newEmployee, setNewEmployee] = useState({
        employeeId: '',
        name: '',
        role: '',
        employmentType: '',
        status: '',
        checkIn: '',
        checkOut: '',
        workType: ''
    });

    useEffect(() => {
        const fetchEmployees = async () => {
            try {
                const response = await axios.get('http://localhost:5000/api/employees', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setEmployees(response.data);
            } catch (error) {
                console.error(error);
            }
        };
        fetchEmployees();
    }, [token]);

    const handleChange = (e) => {
        setNewEmployee({ ...newEmployee, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post('http://localhost:5000/api/employees', newEmployee, {
                headers: { Authorization: `Bearer ${token}` }
            });
            // Refresh employee list after adding new employee
            const response = await axios.get('http://localhost:5000/api/employees', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setEmployees(response.data);
            // Reset form fields
            setNewEmployee({
                employeeId: '',
                name: '',
                role: '',
                employmentType: '',
                status: '',
                checkIn: '',
                checkOut: '',
                workType: ''
            });
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="container mx-auto mt-10">
            <h2 className="text-xl font-bold mb-4">Employee List</h2>
            <form onSubmit={handleSubmit} className="mb-6 bg-white p-4 rounded shadow-md">
                <h3 className="text-lg font-semibold mb-2">Add New Employee</h3>
                {Object.keys(newEmployee).map((key) => (
                    <input key={key} name={key} value={newEmployee[key]} onChange={handleChange} placeholder={key.charAt(0).toUpperCase() + key.slice(1)} className="mb-4 p-2 border border-gray-300 rounded w-full" required />
                ))}
                <button type="submit" className="w-full bg-green-500 text-white p-2 rounded hover:bg-green-600">Add Employee</button>
            </form>

            <table className="min-w-full bg-white border border-gray-300">
                <thead>
                    <tr>
                        {['Employee ID', 'Name', 'Role', 'Employment Type', 'Status', 'Check-In', 'Check-Out', 'Work Type'].map((header) => (
                            <th key={header} className="border-b py-2 text-left px-4">{header}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {employees.map((emp) => (
                        <tr key={emp.employeeId}>
                            {Object.values(emp).map((value) => (
                                <td key={value} className="border-b py-2 px-4">{value}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default EmployeeList;