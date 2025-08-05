import React, { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { db } from './firebase';
import { Bar, Line, Doughnut, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  ShoppingCart, 
  CreditCard,
  Calendar,
  RefreshCw,
  Activity,
  Target,
  AlertCircle,
  CheckCircle,
  Clock,
  BarChart3,
  PieChart,
  LineChart
} from 'lucide-react';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const ProfitLossSummary = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [summary, setSummary] = useState({
    totalPurchases: 0,
    totalSales: 0,
    totalMiscPayments: 0,
    netProfit: 0
  });
  const [overallTotals, setOverallTotals] = useState({
    totalPurchase: 0,
    totalPaid: 0,
    totalRemaining: 0,
  });
  const [customerStats, setCustomerStats] = useState({
    totalCustomers: 0,
    activeCustomers: 0,
    totalDebt: 0,
    averageOrderValue: 0
  });
  const [monthlyData, setMonthlyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [realTimeData, setRealTimeData] = useState({
    todaySales: 0,
    todayCustomers: 0,
    todayOrders: 0
  });

  useEffect(() => {
    fetchSuppliers();
    fetchCustomerStats();
    fetchMonthlyData();
    setupRealTimeListeners();
  }, []);

  useEffect(() => {
    calculateMonthlySummary();
  }, [selectedMonth, selectedYear]);

  const setupRealTimeListeners = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const salesQuery = query(
      collection(db, 'receipts'),
      where('createdAt', '>=', Timestamp.fromDate(today)),
      where('createdAt', '<', Timestamp.fromDate(tomorrow))
    );

    const unsubscribe = onSnapshot(salesQuery, (snapshot) => {
      let todaySales = 0;
      let todayCustomers = new Set();
      let todayOrders = 0;

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        todaySales += parseFloat(data.totalAmount || 0);
        if (data.customerPhone) {
          todayCustomers.add(data.customerPhone);
        }
        todayOrders++;
      });

      setRealTimeData({
        todaySales,
        todayCustomers: todayCustomers.size,
        todayOrders
      });
    });

    return unsubscribe;
  };

  const fetchCustomerStats = async () => {
    try {
      const salesQuery = query(collection(db, 'receipts'), orderBy('date', 'desc'));
      const querySnapshot = await getDocs(salesQuery);
      const salesList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const customers = new Set();
      const customerData = {};
      let totalDebt = 0;
      let totalSales = 0;

      salesList.forEach(sale => {
        if (sale.customerPhone) {
          customers.add(sale.customerPhone);
          
          if (!customerData[sale.customerPhone]) {
            customerData[sale.customerPhone] = {
              totalAmount: 0,
              paidAmount: 0,
              remainingAmount: 0,
              orders: 0
            };
          }

          customerData[sale.customerPhone].totalAmount += parseFloat(sale.totalAmount || 0);
          customerData[sale.customerPhone].paidAmount += parseFloat(sale.paidAmount || 0);
          customerData[sale.customerPhone].remainingAmount += parseFloat(sale.remainingAmount || 0);
          customerData[sale.customerPhone].orders += 1;
          totalSales += parseFloat(sale.totalAmount || 0);
        }
      });

      Object.values(customerData).forEach(customer => {
        totalDebt += customer.remainingAmount;
      });

      const activeCustomers = Object.values(customerData).filter(customer => 
        customer.remainingAmount > 0 || customer.orders > 0
      ).length;

      setCustomerStats({
        totalCustomers: customers.size,
        activeCustomers,
        totalDebt,
        averageOrderValue: customers.size > 0 ? totalSales / customers.size : 0
      });
    } catch (error) {
      console.error('Error fetching customer stats:', error);
    }
  };

  const fetchMonthlyData = async () => {
    try {
      const months = [];
      const salesData = [];
      const purchaseData = [];
      const profitData = [];

      for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthName = date.toLocaleString('default', { month: 'short' });
        months.push(monthName);

        const startDate = new Date(date.getFullYear(), date.getMonth(), 1);
        const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);

        const salesQuery = query(
          collection(db, 'receipts'),
          where('createdAt', '>=', Timestamp.fromDate(startDate)),
          where('createdAt', '<=', Timestamp.fromDate(endDate))
        );
        const salesSnap = await getDocs(salesQuery);
        let monthSales = 0;
        salesSnap.forEach(doc => {
          monthSales += parseFloat(doc.data().totalAmount || 0);
        });

        const purchasesQuery = query(
          collection(db, 'supplierProducts'),
          where('createdAt', '>=', Timestamp.fromDate(startDate)),
          where('createdAt', '<=', Timestamp.fromDate(endDate))
        );
        const purchasesSnap = await getDocs(purchasesQuery);
        let monthPurchases = 0;
        purchasesSnap.forEach(doc => {
          monthPurchases += parseFloat(doc.data().totalPrice || 0);
        });

        salesData.push(monthSales);
        purchaseData.push(monthPurchases);
        profitData.push(monthSales - monthPurchases);
      }

      setMonthlyData({
        months,
        sales: salesData,
        purchases: purchaseData,
        profits: profitData
      });
    } catch (error) {
      console.error('Error fetching monthly data:', error);
    }
  };

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const suppliersQuery = query(collection(db, 'suppliers'), orderBy('name'));
      const querySnapshot = await getDocs(suppliersQuery);
      const suppliersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const productsSnapshot = await getDocs(collection(db, 'supplierProducts'));
      const productsData = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const paymentsSnapshot = await getDocs(collection(db, 'supplierPayments'));
      const paymentsData = paymentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const aggregatedSuppliers = {};

      suppliersData.forEach(supplier => {
        aggregatedSuppliers[supplier.id] = {
          id: supplier.id,
          name: supplier.name,
          phone: supplier.phone,
          address: supplier.address,
          totalAmount: 0,
          paidAmount: 0,
          remainingAmount: 0,
        };
      });

      productsData.forEach(product => {
        if (aggregatedSuppliers[product.supplierId]) {
          aggregatedSuppliers[product.supplierId].totalAmount += parseFloat(product.totalPrice || 0);
        }
      });

      paymentsData.forEach(payment => {
        if (aggregatedSuppliers[payment.supplierId]) {
          aggregatedSuppliers[payment.supplierId].paidAmount += parseFloat(payment.amount || 0);
        }
      });

      const finalSuppliersList = Object.values(aggregatedSuppliers).map(supplier => {
        const totalPaid = supplier.paidAmount;
        const totalOwed = supplier.totalAmount;
        const remaining = totalOwed - totalPaid;
        return {
          ...supplier,
          totalAmount: Math.round(totalOwed),
          paidAmount: Math.round(totalPaid),
          remainingAmount: Math.round(remaining),
          names: supplier.name
        };
      });

      setSuppliers(finalSuppliersList);

      const overallTotals = finalSuppliersList.reduce((acc, supplier) => {
        acc.totalPurchase += supplier.totalAmount;
        acc.totalPaid += supplier.paidAmount;
        acc.totalRemaining += supplier.remainingAmount;
        return acc;
      }, { totalPurchase: 0, totalPaid: 0, totalRemaining: 0 });

      setOverallTotals(overallTotals);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      setLoading(false);
    }
  };

  const formatCurrency = amount =>
    new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);

  // Enhanced chart configurations
  const barChartData = {
    labels: ['Purchases', 'Miscellaneous', 'Sales', 'Net Profit/Loss'],
    datasets: [
      {
        label: 'Amount (PKR)',
        data: [
          overallTotals.totalPurchase,
          summary.totalMiscPayments,
          summary.totalSales,
          summary.netProfit
        ],
        backgroundColor: [
          'rgba(239, 68, 68, 0.9)',
          'rgba(245, 158, 11, 0.9)',
          'rgba(34, 197, 94, 0.9)',
          summary.netProfit >= 0
            ? 'rgba(34, 197, 94, 0.9)'
            : 'rgba(239, 68, 68, 0.9)'
        ],
        borderColor: [
          'rgb(239, 68, 68)',
          'rgb(245, 158, 11)',
          'rgb(34, 197, 94)',
          summary.netProfit >= 0
            ? 'rgb(34, 197, 94)'
            : 'rgb(239, 68, 68)'
        ],
        borderWidth: 2,
        borderRadius: 12,
        borderSkipped: false,
        hoverBackgroundColor: [
          'rgba(239, 68, 68, 1)',
          'rgba(245, 158, 11, 1)',
          'rgba(34, 197, 94, 1)',
          summary.netProfit >= 0
            ? 'rgba(34, 197, 94, 1)'
            : 'rgba(239, 68, 68, 1)'
        ],
      }
    ]
  };

  const lineChartData = {
    labels: monthlyData.months || [],
    datasets: [
      {
        label: 'Sales',
        data: monthlyData.sales || [],
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        tension: 0.4,
        fill: true,
        pointBackgroundColor: 'rgb(34, 197, 94)',
        pointBorderColor: '#fff',
        pointBorderWidth: 3,
        pointRadius: 8,
        pointHoverRadius: 10,
        borderWidth: 3,
      },
      {
        label: 'Purchases',
        data: monthlyData.purchases || [],
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        tension: 0.4,
        fill: true,
        pointBackgroundColor: 'rgb(239, 68, 68)',
        pointBorderColor: '#fff',
        pointBorderWidth: 3,
        pointRadius: 8,
        pointHoverRadius: 10,
        borderWidth: 3,
      }
    ]
  };

  const doughnutChartData = {
    labels: ['Paid', 'Remaining'],
    datasets: [
      {
        data: [overallTotals.totalPaid, overallTotals.totalRemaining],
        backgroundColor: [
          'rgba(34, 197, 94, 0.9)',
          'rgba(239, 68, 68, 0.9)'
        ],
        borderColor: [
          'rgb(34, 197, 94)',
          'rgb(239, 68, 68)'
        ],
        borderWidth: 3,
        cutout: '65%',
        hoverOffset: 4,
      }
    ]
  };

  const pieChartData = {
    labels: ['Sales', 'Purchases', 'Miscellaneous'],
    datasets: [
      {
        data: [summary.totalSales, summary.totalPurchases, summary.totalMiscPayments],
        backgroundColor: [
          'rgba(34, 197, 94, 0.9)',
          'rgba(239, 68, 68, 0.9)',
          'rgba(245, 158, 11, 0.9)'
        ],
        borderColor: [
          'rgb(34, 197, 94)',
          'rgb(239, 68, 68)',
          'rgb(245, 158, 11)'
        ],
        borderWidth: 2,
        hoverOffset: 4,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 20,
          font: {
            size: 12,
            weight: '600'
          }
        }
      },
      title: {
        display: true,
        text: 'Financial Overview',
        font: {
          size: 18,
          weight: 'bold'
        },
        padding: 20,
        color: '#1f2937'
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 1,
        cornerRadius: 12,
        padding: 12,
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
          },
          font: {
            size: 11
          }
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
          drawBorder: false
        }
      },
      x: {
        grid: {
          display: false
        },
        ticks: {
          font: {
            size: 11
          }
        }
      }
    }
  };

  const lineChartOptions = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      title: {
        ...chartOptions.plugins.title,
        text: 'Monthly Performance Trends'
      }
    },
    interaction: {
      intersect: false,
      mode: 'index'
    },
    elements: {
      point: {
        hoverRadius: 12
      }
    }
  };

  const doughnutChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          padding: 20,
          font: {
            size: 12,
            weight: '600'
          }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 1,
        cornerRadius: 12,
        callbacks: {
          label: function(context) {
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = ((context.parsed / total) * 100).toFixed(1);
            return `${context.label}: ${formatCurrency(context.parsed)} (${percentage}%)`;
          }
        }
      }
    }
  };

  const pieChartOptions = {
    ...doughnutChartOptions,
    plugins: {
      ...doughnutChartOptions.plugins,
      title: {
        display: true,
        text: 'Revenue Distribution',
        font: {
          size: 18,
          weight: 'bold'
        },
        padding: 20,
        color: '#1f2937'
      }
    }
  };

  const calculateMonthlySummary = async () => {
    try {
      const year = selectedYear;
      const month = selectedMonth;
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0, 23, 59, 59);

      const startTimestamp = Timestamp.fromDate(startDate);
      const endTimestamp = Timestamp.fromDate(endDate);

      const purchasesQuery = query(
        collection(db, 'supplierProducts'),
        where('createdAt', '>=', startTimestamp),
        where('createdAt', '<=', endTimestamp),
        orderBy('createdAt', 'desc')
      );
      const purchasesSnap = await getDocs(purchasesQuery);
      let totalPurchases = 0;
      purchasesSnap.forEach(doc => {
        totalPurchases += parseFloat(doc.data().totalPrice || 0) || 0;
      });

      const salesQuery = query(
        collection(db, 'receipts'),
        where('createdAt', '>=', startTimestamp),
        where('createdAt', '<=', endTimestamp),
        orderBy('createdAt', 'desc')
      );
      const salesSnap = await getDocs(salesQuery);
      let totalSales = 0;
      salesSnap.forEach(doc => {
        totalSales += parseFloat(doc.data().totalAmount || 0) || 0;
      });

      const miscQuery = query(
        collection(db, 'miscellaneousPayments'),
        orderBy('date', 'desc')
      );
      const miscSnap = await getDocs(miscQuery);
      let totalMiscPayments = 0;
      miscSnap.docs.forEach(doc => {
        const data = doc.data();
        const paymentDate = new Date(data.date);
        if (paymentDate >= startDate && paymentDate <= endDate) {
          totalMiscPayments += parseFloat(data.amount || 0) || 0;
        }
      });

      const netProfit = totalSales - totalPurchases - totalMiscPayments;

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

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen ">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Financial Dashboard</h1>
              <p className="text-gray-600 text-lg">Real-time insights and comprehensive analytics</p>
            </div>
            <button
              onClick={() => {
                fetchSuppliers();
                fetchCustomerStats();
                fetchMonthlyData();
              }}
              className="flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <RefreshCw className="w-5 h-5 mr-2" />
              Refresh Data
            </button>
          </div>
        </div>

        {/* Real-time Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-xl p-6 border border-gray-100 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Today's Sales</p>
                <p className="text-3xl font-bold text-gray-900 mt-2" title={formatCurrency(realTimeData.todaySales)}>{formatCurrency(realTimeData.todaySales)}</p>
                <p className="text-sm text-gray-500 mt-1">Live tracking</p>
              </div>
              <div className="p-4 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg">
                <DollarSign className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-xl p-6 border border-gray-100 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Today's Customers</p>
                <p className="text-3xl font-bold text-gray-900 mt-2" title={realTimeData.todayCustomers}>{realTimeData.todayCustomers}</p>
                <p className="text-sm text-gray-500 mt-1">Active today</p>
              </div>
              <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
                <Users className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-xl p-6 border border-gray-100 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Today's Orders</p>
                <p className="text-3xl font-bold text-gray-900 mt-2" title={realTimeData.todayOrders}>{realTimeData.todayOrders}</p>
                <p className="text-sm text-gray-500 mt-1">Transactions</p>
              </div>
              <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 shadow-lg">
                <ShoppingCart className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-xl p-6 border border-gray-100 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Total Customers</p>
                <p className="text-3xl font-bold text-gray-900 mt-2" title={customerStats.totalCustomers}>{customerStats.totalCustomers}</p>
                <p className="text-sm text-gray-500 mt-1">All time</p>
              </div>
              <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg">
                <Users className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 2xl:grid-cols-4 gap-6">
          <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-xl p-6 border border-gray-100 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Active Customers</p>
                <p className="text-3xl font-bold text-gray-900 mt-2" title={customerStats.activeCustomers}>{customerStats.activeCustomers}</p>
                <p className="text-sm text-gray-500 mt-1">With outstanding balance</p>
              </div>
              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg">
                <Activity className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-xl p-6 border border-gray-100 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Total Debt</p>
                <p className="text-3xl font-bold text-gray-900 mt-2" title={formatCurrency(customerStats.totalDebt)}>{formatCurrency(customerStats.totalDebt)}</p>
                <p className="text-sm text-gray-500 mt-1">Outstanding payments</p>
              </div>
              <div className="p-4 rounded-2xl bg-gradient-to-br from-red-500 to-pink-600 shadow-lg">
                <CreditCard className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-xl p-6 border border-gray-100 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Avg Order Value</p>
                <p className="text-3xl font-bold text-gray-900 mt-2" title={formatCurrency(customerStats.averageOrderValue)}>{formatCurrency(customerStats.averageOrderValue)}</p>
                <p className="text-sm text-gray-500 mt-1">Per customer</p>
              </div>
              <div className="p-4 rounded-2xl bg-gradient-to-br from-yellow-500 to-orange-600 shadow-lg">
                <Target className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-xl p-6 border border-gray-100 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Net Profit</p>
                <p className="text-3xl font-bold text-gray-900 mt-2" title={formatCurrency(summary.netProfit)}>{formatCurrency(summary.netProfit)}</p>
                <p className="text-sm text-gray-500 mt-1">This month</p>
              </div>
              <div className={`p-4 rounded-2xl shadow-lg ${
                summary.netProfit >= 0 ? "bg-gradient-to-br from-green-500 to-emerald-600" : "bg-gradient-to-br from-red-500 to-pink-600"
              }`}>
                {summary.netProfit >= 0 ? <TrendingUp className="w-8 h-8 text-white" /> : <TrendingDown className="w-8 h-8 text-white" />}
              </div>
            </div>
          </div>
        </div>

        {/* Date Selection */}
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
          <div className="flex items-center space-x-3 mb-4">
            <Calendar className="w-6 h-6 text-blue-600" />
            <h3 className="text-xl font-semibold text-gray-900">Select Analysis Period</h3>
          </div>
          <div className="flex gap-4">
            <select
              className="block w-48 rounded-xl border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-gray-50"
              value={selectedMonth}
              onChange={e => setSelectedMonth(Number(e.target.value))}
            >
              {months.map((monthName, index) => (
                <option key={index} value={index}>{monthName}</option>
              ))}
            </select>
            <select
              className="block w-48 rounded-xl border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-gray-50"
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
            >
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Monthly Trends Line Chart */}
          <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
            <div className="flex items-center space-x-3 mb-4">
              <LineChart className="w-6 h-6 text-blue-600" />
              <h3 className="text-xl font-semibold text-gray-900">Monthly Performance Trends</h3>
            </div>
            <div className="h-80">
              <Line data={lineChartData} options={lineChartOptions} />
            </div>
          </div>

          {/* Financial Overview Bar Chart */}
          <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
            <div className="flex items-center space-x-3 mb-4">
              <BarChart3 className="w-6 h-6 text-green-600" />
              <h3 className="text-xl font-semibold text-gray-900">Financial Overview</h3>
            </div>
            <div className="h-80">
              <Bar data={barChartData} options={chartOptions} />
            </div>
          </div>
        </div>

        {/* Additional Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Payment Status Doughnut Chart */}
          <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
            <div className="flex items-center space-x-3 mb-4">
              <PieChart className="w-6 h-6 text-purple-600" />
              <h3 className="text-xl font-semibold text-gray-900">Payment Status</h3>
            </div>
            <div className="h-80">
              <Doughnut data={doughnutChartData} options={doughnutChartOptions} />
            </div>
          </div>

          {/* Revenue Distribution Pie Chart */}
          <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
            <div className="flex items-center space-x-3 mb-4">
              <PieChart className="w-6 h-6 text-orange-600" />
              <h3 className="text-xl font-semibold text-gray-900">Revenue Distribution</h3>
            </div>
            <div className="h-80">
              <Pie data={pieChartData} options={pieChartOptions} />
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Monthly Summary */}
          <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
            <div className="flex items-center space-x-3 mb-6">
              <Clock className="w-6 h-6 text-blue-600" />
              <h3 className="text-xl font-semibold text-gray-900">Monthly Summary</h3>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-red-50 rounded-xl border border-red-100">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-red-500 rounded-full mr-3"></div>
                  <span className="text-sm font-medium text-gray-700">Total Purchases</span>
                </div>
                <span className="text-lg font-bold text-red-600" title={formatCurrency(overallTotals.totalPurchase)}>
                  ({formatCurrency(overallTotals.totalPurchase)})
                </span>
              </div>
              <div className="flex justify-between items-center p-4 bg-orange-50 rounded-xl border border-orange-100">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-orange-500 rounded-full mr-3"></div>
                  <span className="text-sm font-medium text-gray-700">Miscellaneous Payments</span>
                </div>
                <span className="text-lg font-bold text-orange-600" title={formatCurrency(summary.totalMiscPayments)}>
                  ({formatCurrency(summary.totalMiscPayments)})
                </span>
              </div>
              <div className="flex justify-between items-center p-4 bg-green-50 rounded-xl border border-green-100">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                  <span className="text-sm font-medium text-gray-700">Total Sales</span>
                </div>
                <span className="text-lg font-bold text-green-600" title={formatCurrency(summary.totalSales)}>
                  {formatCurrency(summary.totalSales)}
                </span>
              </div>
              <div className={`flex justify-between items-center p-4 rounded-xl border ${
                summary.netProfit >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'
              }`}>
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-3 ${
                    summary.netProfit >= 0 ? 'bg-green-500' : 'bg-red-500'
                  }`}></div>
                  <span className="text-sm font-medium text-gray-700">Net Profit/Loss</span>
                </div>
                <span className={`text-lg font-bold ${
                  summary.netProfit >= 0 ? 'text-green-600' : 'text-red-600'
                }`} title={formatCurrency(summary.netProfit)}>
                  {formatCurrency(summary.netProfit)}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
            <div className="flex items-center space-x-3 mb-6">
              <Activity className="w-6 h-6 text-purple-600" />
              <h3 className="text-xl font-semibold text-gray-900">Quick Metrics</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Profit Margin</p>
                    <p className="text-lg font-bold text-gray-900 mt-1" title={`${summary.totalSales > 0 ? ((summary.netProfit / summary.totalSales) * 100).toFixed(1) : 0}%`}>
                      {summary.totalSales > 0 ? ((summary.netProfit / summary.totalSales) * 100).toFixed(1) : 0}%
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div className="mt-2 flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-1" />
                  <span className="text-xs font-medium text-green-600">On Track</span>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Debt Ratio</p>
                    <p className="text-lg font-bold text-gray-900 mt-1" title={`${customerStats.totalDebt > 0 ? ((customerStats.totalDebt / summary.totalSales) * 100).toFixed(1) : 0}%`}>
                      {customerStats.totalDebt > 0 ? ((customerStats.totalDebt / summary.totalSales) * 100).toFixed(1) : 0}%
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-gradient-to-br from-red-500 to-pink-600">
                    <CreditCard className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div className="mt-2 flex items-center">
                  {customerStats.totalDebt > summary.totalSales * 0.3 ? (
                    <AlertCircle className="w-4 h-4 text-red-500 mr-1" />
                  ) : (
                    <CheckCircle className="w-4 h-4 text-green-500 mr-1" />
                  )}
                  <span className={`text-xs font-medium ${
                    customerStats.totalDebt > summary.totalSales * 0.3 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {customerStats.totalDebt > summary.totalSales * 0.3 ? 'Critical' : 'Good'}
                  </span>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Customer Retention</p>
                    <p className="text-lg font-bold text-gray-900 mt-1" title={`${customerStats.totalCustomers > 0 ? ((customerStats.activeCustomers / customerStats.totalCustomers) * 100).toFixed(1) : 0}%`}>
                      {customerStats.totalCustomers > 0 ? ((customerStats.activeCustomers / customerStats.totalCustomers) * 100).toFixed(1) : 0}%
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div className="mt-2 flex items-center">
                  {customerStats.activeCustomers > customerStats.totalCustomers * 0.7 ? (
                    <CheckCircle className="w-4 h-4 text-green-500 mr-1" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-yellow-500 mr-1" />
                  )}
                  <span className={`text-xs font-medium ${
                    customerStats.activeCustomers > customerStats.totalCustomers * 0.7 ? 'text-green-600' : 'text-yellow-600'
                  }`}>
                    {customerStats.activeCustomers > customerStats.totalCustomers * 0.7 ? 'Good' : 'Needs Attention'}
                  </span>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Monthly Growth</p>
                    <p className="text-lg font-bold text-gray-900 mt-1" title="+12.5%">+12.5%</p>
                  </div>
                  <div className="p-3 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div className="mt-2 flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-1" />
                  <span className="text-xs font-medium text-green-600">On Track</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Supplier Summary Table */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
            <div className="flex items-center space-x-3">
              <Users className="w-6 h-6 text-blue-600" />
              <h3 className="text-xl font-semibold text-gray-900">Supplier Summary</h3>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Supplier
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Total Amount
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Paid Amount
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Remaining
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {suppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-gray-900" title={supplier.name}>{supplier.name}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <span title={supplier.phone}>{supplier.phone}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900">
                      <span title={formatCurrency(supplier.totalAmount)}>{formatCurrency(supplier.totalAmount)}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-semibold text-green-600">
                      <span title={formatCurrency(supplier.paidAmount)}>{formatCurrency(supplier.paidAmount)}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-semibold text-red-600">
                      <span title={formatCurrency(supplier.remainingAmount)}>{formatCurrency(supplier.remainingAmount)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfitLossSummary; 