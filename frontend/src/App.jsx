import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Storefront from './Storefront';
import AdminLayout from './admin/AdminLayout';
import Login from './admin/Login';
import Dashboard from './admin/Dashboard';
import ImportData from './admin/ImportData';
import DotCompanyTest from './admin/DotCompanyTest';
import ManagePhotos from './admin/ManagePhotos';

function PrivateRoute({ children }) {
  const token = localStorage.getItem('@BemEstar:adminToken');
  return token ? children : <Navigate to="/admin/login" />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Main Storefront Route */}
        <Route path="/" element={<Storefront />} />

        {/* Admin Routes */}
        <Route path="/admin/login" element={<Login />} />
        <Route 
          path="/admin" 
          element={
            <PrivateRoute>
              <AdminLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="photos" element={<ManagePhotos />} />
          <Route path="import" element={<ImportData />} />
          <Route path="categories" element={<div>Módulo de Categorias em construção...</div>} />
          <Route path="dotcompany" element={<DotCompanyTest />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
