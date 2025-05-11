import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, Timestamp, orderBy } from 'firebase/firestore';
import { db } from './firebase';

const ProfitLossSummary = () => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [summary, setSummary] = useState({
    openingInventory: 0,
    purchases: 0,
    closingInventory: 0,
    cogs: 0,
    salesRevenue: 0,
    grossProfit: 0
  });

  const calculateMonthlySummary = async () => {
    try {
      const [year, month] = selectedMonth.split('-');
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      // Get all products for inventory calculation
      const productsQuery = query(collection(db, 'products'));
      const productsSnapshot = await getDocs(productsQuery);
      
      // Calculate opening inventory (from previous month)
      let openingInventory = 0;
      productsSnapshot.forEach(doc => {
        const data = doc.data();
        openingInventory += (data.quantity || 0) * (data.unitPrice || 0);
      });

      // Get purchases for the month from supplierProducts
      const purchasesQuery = query(
        collection(db, 'supplierProducts'),
        where('createdAt', '>=', startDate.toISOString()),
        where('createdAt', '<=', endDate.toISOString())
      );
      const purchasesSnapshot = await getDocs(purchasesQuery);
      let purchases = 0;
      purchasesSnapshot.forEach(doc => {
        const data = doc.data();
        purchases += (data.totalPrice || 0);
      });

      // Calculate closing inventory (current month)
      let closingInventory = 0;
      productsSnapshot.forEach(doc => {
        const data = doc.data();
        closingInventory += (data.quantity || 0) * (data.unitPrice || 0);
      });

      // Get sales revenue from receipts
      const salesQuery = query(
        collection(db, 'receipts'),
        where('date', '>=', Timestamp.fromDate(startDate)),
        where('date', '<=', Timestamp.fromDate(endDate))
      );
      const salesSnapshot = await getDocs(salesQuery);
      let salesRevenue = 0;
      salesSnapshot.forEach(doc => {
        const data = doc.data();
        salesRevenue += (data.totalAmount || 0);
      });

      // Calculate COGS and Gross Profit
      const cogs = openingInventory + purchases - closingInventory;
      const grossProfit = salesRevenue - cogs;

      console.log('Summary Calculations:', {
        openingInventory,
        purchases,
        closingInventory,
        cogs,
        salesRevenue,
        grossProfit
      });

      setSummary({
        openingInventory: Math.round(openingInventory),
        purchases: Math.round(purchases),
        closingInventory: Math.round(closingInventory),
        cogs: Math.round(cogs),
        salesRevenue: Math.round(salesRevenue),
        grossProfit: Math.round(grossProfit)
      });
    } catch (error) {
      console.error('Error calculating summary:', error);
    }
  };

  useEffect(() => {
    calculateMonthlySummary();
  }, [selectedMonth]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Profit & Loss Summary</h2>
      
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Select Month:</label>
        <input
          type="month"
          className="block w-48 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
        />
      </div>

      <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
        <table className="min-w-full divide-y divide-gray-300">
          <tbody className="divide-y divide-gray-200 bg-white">
            <tr>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">Opening Inventory</td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 text-right">{formatCurrency(summary.openingInventory)}</td>
            </tr>
            <tr>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">+ Purchases</td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 text-right">{formatCurrency(summary.purchases)}</td>
            </tr>
            <tr>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">– Closing Inventory</td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-red-600 text-right">
                ({formatCurrency(summary.closingInventory)})
              </td>
            </tr>
            <tr className="bg-blue-50">
              <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900">→ COGS</td>
              <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900 text-right">{formatCurrency(summary.cogs)}</td>
            </tr>
            <tr>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">Sales Revenue</td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 text-right">{formatCurrency(summary.salesRevenue)}</td>
            </tr>
            <tr className="bg-green-50">
              <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900">→ Gross Profit</td>
              <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900 text-right">{formatCurrency(summary.grossProfit)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProfitLossSummary; 