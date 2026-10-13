import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import Overview from './pages/Overview';
import Sales from './pages/Sales';
import Products from './pages/Products';
import Customers from './pages/Customers';
import Returns from './pages/Returns';
import Demand from './pages/Demand';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Overview />} />
          <Route path="sales" element={<Sales />} />
          <Route path="products" element={<Products />} />
          <Route path="customers" element={<Customers />} />
          <Route path="returns" element={<Returns />} />
          <Route path="demand" element={<Demand />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
