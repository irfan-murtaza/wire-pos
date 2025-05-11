import React, { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  orderBy
} from 'firebase/firestore';
import { db } from './firebase';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const ProfitLossSummary = () => {
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [summary, setSummary] = useState({
    totalPurchases: 0,
    totalSales: 0,
    totalMiscPayments: 0,
    netProfit: 0
  });

  const calculateMonthlySummary = async () => {
    try {
      // Parse selected month
      const [year, month] = selectedMonth.split('-').map(Number);
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      console.log('Querying for period:', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      // --- Purchases from suppliers in period ---
      const purchasesQuery = query(
        collection(db, 'supplierProducts'),
        orderBy('createdAt', 'desc')
      );
      const purchasesSnap = await getDocs(purchasesQuery);
      let totalPurchases = 0;
      purchasesSnap.forEach(doc => {
        const data = doc.data();
        const purchaseDate = new Date(data.createdAt);
        if (purchaseDate >= startDate && purchaseDate <= endDate) {
          console.log('Purchase data:', data);
          totalPurchases += parseFloat(data.totalPrice) || 0;
        }
      });

      console.log('Total purchases:', totalPurchases);

      // --- Sales Revenue in period ---
      const salesQuery = query(
        collection(db, 'receipts'),
        orderBy('createdAt', 'desc')
      );
      const salesSnap = await getDocs(salesQuery);
      let totalSales = 0;
      salesSnap.forEach(doc => {
        const data = doc.data();
        const saleDate = new Date(data.createdAt);
        if (saleDate >= startDate && saleDate <= endDate) {
          console.log('Sale data:', data);
          totalSales += parseFloat(data.totalAmount) || 0;
        }
      });

      console.log('Total sales:', totalSales);

      // --- Miscellaneous Payments in period ---
      const miscQuery = query(
        collection(db, 'miscellaneousPayments'),
        orderBy('date', 'desc')
      );
      const miscSnap = await getDocs(miscQuery);
      let totalMiscPayments = 0;
      miscSnap.forEach(doc => {
        const data = doc.data();
        const paymentDate = new Date(data.date);
        if (paymentDate >= startDate && paymentDate <= endDate) {
          console.log('Misc payment data:', data);
          totalMiscPayments += parseFloat(data.amount) || 0;
        }
      });

      console.log('Total misc payments:', totalMiscPayments);

      // --- Calculate Net Profit ---
      const netProfit = totalSales - totalPurchases - totalMiscPayments;

      console.log('Final summary:', {
        totalPurchases,
        totalSales,
        totalMiscPayments,
        netProfit
      });

      setSummary({
        totalPurchases: Math.round(totalPurchases),
        totalSales: Math.round(totalSales),
        totalMiscPayments: Math.round(totalMiscPayments),
        netProfit: Math.round(netProfit)
      });
    } catch (error) {
      console.error('Error calculating Profit & Loss:', error);
    }
  };

  useEffect(() => {
    calculateMonthlySummary();
  }, [selectedMonth]);

  const formatCurrency = amount =>
    new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);

  // Chart data
  const chartData = {
    labels: ['Purchases', 'Miscellaneous', 'Sales', 'Net Profit/Loss'],
    datasets: [
      {
        label: 'Amount (PKR)',
        data: [
          summary.totalPurchases,
          summary.totalMiscPayments,
          summary.totalSales,
          summary.netProfit
        ],
        backgroundColor: [
          'rgba(239, 68, 68, 0.6)', // Red for purchases
          'rgba(245, 158, 11, 0.6)', // Orange for misc
          'rgba(34, 197, 94, 0.6)', // Green for sales
          summary.netProfit >= 0
            ? 'rgba(34, 197, 94, 0.6)' // Green for profit
            : 'rgba(239, 68, 68, 0.6)' // Red for loss
        ],
        borderColor: [
          'rgb(239, 68, 68)', // Red for purchases
          'rgb(245, 158, 11)', // Orange for misc
          'rgb(34, 197, 94)', // Green for sales
          summary.netProfit >= 0
            ? 'rgb(34, 197, 94)' // Green for profit
            : 'rgb(239, 68, 68)' // Red for loss
        ],
        borderWidth: 1
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: true,
        text: 'Monthly Financial Summary (PKR)',
        font: {
          size: 16
        }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            return formatCurrency(context.raw);
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value) {
            return formatCurrency(value);
          }
        }
      }
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Profit & Loss Summary</h2>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Select Month:</label>
        <input
          type="month"
          className="block w-48 rounded-md border-gray-300 shadow-sm"
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
          <table className="min-w-full divide-y divide-gray-300">
            <tbody className="divide-y divide-gray-200 bg-white">
              <tr>
                <td className="px-3 py-4 text-sm">Total Purchases</td>
                <td className="px-3 py-4 text-sm text-right text-red-600">
                  ({formatCurrency(summary.totalPurchases)})
                </td>
              </tr>
              <tr>
                <td className="px-3 py-4 text-sm">Miscellaneous Payments</td>
                <td className="px-3 py-4 text-sm text-right text-orange-600">
                  ({formatCurrency(summary.totalMiscPayments)})
                </td>
              </tr>
              <tr>
                <td className="px-3 py-4 text-sm">Total Sales</td>
                <td className="px-3 py-4 text-sm text-right text-green-600">
                  {formatCurrency(summary.totalSales)}
                </td>
              </tr>
              <tr className="bg-blue-50">
                <td className="px-3 py-4 text-sm font-medium">Net Profit/Loss</td>
                <td className={`px-3 py-4 text-sm font-medium text-right ${
                  summary.netProfit >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formatCurrency(summary.netProfit)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="bg-white p-4 rounded-lg shadow ring-1 ring-black ring-opacity-5">
          <Bar data={chartData} options={chartOptions} />
        </div>
      </div>
    </div>
  );
};

export default ProfitLossSummary;
