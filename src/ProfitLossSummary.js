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
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth()); // Month is 0-indexed
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [summary, setSummary] = useState({
    totalPurchases: 0,
    totalSales: 0,
    totalMiscPayments: 0,
    netProfit: 0
  });

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

  const totalSaleValue = async () => {
    try {
      const salesQuery = query(collection(db, 'receipts'), orderBy('date', 'desc'));
      const querySnapshot = await getDocs(salesQuery);
      const salesList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const filtered = salesList.filter(sale => {
        const saleDate = new Date(sale.date);
        console.log("month: ", selectedMonth )
        console.log("month: ", selectedYear)
        const monthMatch = saleDate.getMonth() === selectedMonth;
        const yearMatch = saleDate.getFullYear() === selectedYear;
        
        return monthMatch && yearMatch
      });
      return filtered.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);

    } catch (error) {
      console.error('Error fetching sales:', error);
      alert('Error fetching sales. Please check console for details.');
    }
    
  };

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);

  const calculateMonthlySummary = async () => {
    try {
      // Parse selected month and year
      const year = selectedYear; // Use selectedYear state
      const month = selectedMonth; // Use selectedMonth state (0-indexed)
      const startDate = new Date(year, month, 1); // Corrected to use 0-indexed month
      const endDate = new Date(year, month + 1, 0, 23, 59, 59); // Corrected to use 0-indexed month + 1 for end of month

      // Convert dates to Firestore Timestamps for Timestamp fields
      const startTimestamp = Timestamp.fromDate(startDate);
      const endTimestamp = Timestamp.fromDate(endDate);

      console.log('Querying for period:', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        startTimestamp: startTimestamp.toDate(),
        endTimestamp: endTimestamp.toDate()
      });

      // --- Purchases from suppliers in period ---
      const purchasesQuery = query(
        collection(db, 'supplierProducts'),
        where('createdAt', '>=', startTimestamp), // Filter by date range on Timestamp
        where('createdAt', '<=', endTimestamp),
        orderBy('createdAt', 'desc')
      );
      const purchasesSnap = await getDocs(purchasesQuery);
      let totalPurchases = 0;
      console.log(`Fetched ${purchasesSnap.docs.length} purchase documents for ${selectedMonth}`);
      purchasesSnap.forEach(doc => {
        const data = doc.data();
        console.log('Purchase data:', data);
        totalPurchases += parseFloat(data.totalPrice || 0) || 0;
      });

      console.log('Total purchases:', totalPurchases);

      // --- Sales Revenue in period -- -
      const salesQuery = query(
        collection(db, 'receipts'),
        where('createdAt', '>=', startTimestamp), // Filter by date range on Timestamp
        where('createdAt', '<=', endTimestamp),
        orderBy('createdAt', 'desc')
      );
      const salesSnap = await getDocs(salesQuery);
      let totalSales = 0;
      console.log(`Fetched ${salesSnap.docs.length} sales documents for ${selectedMonth}`);
      const fetchedSalesData = [];
      salesSnap.forEach(doc => {
        const data = doc.data();
        fetchedSalesData.push(data);
        totalSales += parseFloat(data.totalAmount || 0) || 0;
      });

      console.log('Total sales:', totalSales);
      console.log('Fetched sales data:', fetchedSalesData);

      // --- Miscellaneous Payments in period ---
      const miscQuery = query(
        collection(db, 'miscellaneousPayments'),
        orderBy('date', 'desc') // Fetch all or potentially filter by year if index exists
      );
      const miscSnap = await getDocs(miscQuery);
      let totalMiscPayments = 0;
      const fetchedMiscData = [];
      miscSnap.docs.forEach(doc => {
        const data = doc.data();
        const paymentDate = new Date(data.date); // Assuming date is stored as a parseable string
        // Client-side filter by month and year
        if (paymentDate >= startDate && paymentDate <= endDate) {
           console.log('Misc payment data (filtered client-side):', data);
           fetchedMiscData.push(data);
           totalMiscPayments += parseFloat(data.amount || 0) || 0;
        }
      });
       console.log(`Fetched ${fetchedMiscData.length} miscellaneous payment documents for ${selectedMonth} (after client-side filter)`); // Log filtered misc count
      console.log('Total misc payments:', totalMiscPayments);
       console.log('Fetched miscellaneous payments data (filtered client-side):', fetchedMiscData); // Log the filtered data array


      // --- Calculate Net Profit ---
      const netProfit = totalSales - totalPurchases - totalMiscPayments;

      const total = await totalSaleValue()
      console.log('Final summary:', {
        totalPurchases,
        total,
        totalMiscPayments,
        netProfit
      });

      setSummary({
        totalPurchases: Math.round(totalPurchases),
        totalSales: Math.round(total),
        totalMiscPayments: Math.round(totalMiscPayments),
        netProfit: Math.round(netProfit)
      });
    } catch (error) {
      console.error('Error calculating Profit & Loss:', error);
    }
  };

  useEffect(() => {
    calculateMonthlySummary();
  }, [selectedMonth, selectedYear]); // Trigger recalculation when month or year changes

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Profit & Loss Summary</h2>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Select Month:</label>
        <div className="flex gap-4">
          <select
            className="block w-48 rounded-md border-gray-300 shadow-sm"
            value={selectedMonth}
            onChange={e => setSelectedMonth(Number(e.target.value))}
          >
            {months.map((monthName, index) => (
              <option key={index} value={index}>{monthName}</option>
            ))}
          </select>
          <select
            className="block w-48 rounded-md border-gray-300 shadow-sm"
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
          >
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
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
