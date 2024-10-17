// src/App.js
import React, { useState } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Register from './components/Register';
import Login from './components/Login';
import EmployeeList from './components/EmployeeList';

function App() {
    const [token, setToken] = useState('');

    return (
        <Router>
            <div className="container mx-auto border">
                <Routes>
                    <Route path="/" element={<Login setToken={setToken} />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/employees" element={<EmployeeList token={token} />} />
                </Routes>
            </div>
        </Router>
    );
}

export default App;