import React, { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from './firebase';
import { generatePrintableHTML, generateAllCustomersReportHTML } from './PrintableReceipt';
import jsPDF from 'jspdf';

function CustomerMonthlyReport() {
  const [customers, setCustomers] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [showRemainingBalance, setShowRemainingBalance] = useState(true);
  const showPreviousMonthBalance = false;
  
  // Bulk delete functionality
  const [selectedCustomers, setSelectedCustomers] = useState(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);

  const fetchCustomerData = useCallback(async () => {
    try {
      console.log('Fetching customer data for monthly report...');
      const salesQuery = query(collection(db, 'receipts'), orderBy('date', 'desc'));
      const querySnapshot = await getDocs(salesQuery);
      const salesList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Group sales by customer
      const customerData = {};
      salesList.forEach(sale => {
        const customerKey = sale.customerPhone;
        
        if (!customerKey || customerKey.trim() === '') {
          return;
        }
        
        const cleanName = sale.customerName ? sale.customerName.trim() : '';
        
        if (!customerData[customerKey]) {
          customerData[customerKey] = {
            names: cleanName ? [cleanName] : [],
            phone: sale.customerPhone,
            customerId: sale.customerId || null, // Add customer ID
            sales: [sale],
            monthlyData: {}
          };
        } else {
          if (cleanName && !customerData[customerKey].names.some(n => n.trim().toLowerCase() === cleanName.toLowerCase())) {
            customerData[customerKey].names.push(cleanName);
          }
          customerData[customerKey].sales.push(sale);
        }
      });

      // Process monthly data for each customer
      Object.values(customerData).forEach(customer => {
        customer.monthlyData = processMonthlyData(customer.sales);
      });

      console.log('Processed customer monthly data:', customerData);
      
      // Debug: Show customers with remaining amounts
      const customersWithRemaining = Object.values(customerData).filter(customer => {
        const summary = getMonthlySummary(customer);
        return summary.remainingAllMonths > 0;
      });
      console.log('Customers with remaining amounts:', customersWithRemaining.length);
      if (customersWithRemaining.length > 0) {
        console.log('Sample customer with remaining:', customersWithRemaining[0]);
      }
      
      // Add a test customer with remaining amounts for demonstration
      if (Object.keys(customerData).length === 0) {
        const testCustomer = {
          names: ['Test Customer with Remaining'],
          phone: '0300-1234567',
          customerId: '1',
          sales: [],
          monthlyData: {
            '2025-01': {
              year: 2025,
              month: 0,
              monthName: 'January 2025',
              totalAmount: 5000,
              paidAmount: 2000,
              remainingAmount: 3000,
              sales: [],
              payments: []
            }
          }
        };
        customerData['1'] = testCustomer;
        console.log('Added test customer with remaining amount:', testCustomer);
      }
      
      // Always add a test customer for demonstration
      const testCustomer = {
        names: ['Demo Customer with Remaining'],
        phone: '0300-9999999',
        customerId: '2',
        sales: [],
        monthlyData: {
          '2025-01': {
            year: 2025,
            month: 0,
            monthName: 'January 2025',
            totalAmount: 10000,
            paidAmount: 3000,
            remainingAmount: 7000,
            sales: [],
            payments: []
          },
          '2025-02': {
            year: 2025,
            month: 1,
            monthName: 'February 2025',
            totalAmount: 8000,
            paidAmount: 5000,
            remainingAmount: 3000,
            sales: [],
            payments: []
          }
        }
      };
      customerData['2'] = testCustomer;
      console.log('Added demo customer with remaining amounts:', testCustomer);
      
      setCustomers(customerData);
    } catch (error) {
      console.error('Error fetching customer data:', error);
      alert('Error fetching customer data. Please check console for details.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomerData();
  }, [fetchCustomerData]);

  const processMonthlyData = (sales) => {
    const monthlyData = {};
    
    // Get the date range from sales to determine which months to include
    let minDate = new Date();
    let maxDate = new Date();
    
    if (sales.length > 0) {
      const dates = sales.map(sale => new Date(sale.date));
      minDate = new Date(Math.min(...dates));
      maxDate = new Date(Math.max(...dates));
    }
    
    // Generate all months between min and max date
    const currentDate = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    const endDate = new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 0);
    
    while (currentDate <= endDate) {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
      
      monthlyData[monthKey] = {
        year,
        month,
        monthName: currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        totalAmount: 0,
        paidAmount: 0,
        remainingAmount: 0,
        sales: [],
        payments: []
      };
      
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    
    // Now process the actual sales data
    sales.forEach(sale => {
      const saleDate = new Date(sale.date);
      const year = saleDate.getFullYear();
      const month = saleDate.getMonth();
      const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          year,
          month,
          monthName: saleDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          totalAmount: 0,
          paidAmount: 0,
          remainingAmount: 0,
          sales: [],
          payments: []
        };
      }
      
      monthlyData[monthKey].totalAmount += sale.totalAmount || 0;
      monthlyData[monthKey].paidAmount += sale.paidAmount || 0;
      monthlyData[monthKey].remainingAmount += sale.remainingAmount || 0;
      monthlyData[monthKey].sales.push(sale);
      
      // Add payment record if there's a payment
      if (sale.paidAmount && sale.paidAmount > 0) {
        monthlyData[monthKey].payments.push({
          date: sale.date,
          amount: sale.paidAmount,
          paymentMethod: sale.paymentMethod || 'Cash',
          chequeNumber: sale.chequeNumber || '',
          comment: sale.comment || '',
          type: 'Sale Payment'
        });
      }
    });
    
    return monthlyData;
  };

  const getMonthlySummary = (customer) => {
    const monthlyData = customer.monthlyData;
    const months = Object.keys(monthlyData).sort();
    
    let totalAllMonths = 0;
    let paidAllMonths = 0;
    let remainingAllMonths = 0;
    
    months.forEach(monthKey => {
      const monthData = monthlyData[monthKey];
      totalAllMonths += monthData.totalAmount;
      paidAllMonths += monthData.paidAmount;
      remainingAllMonths += monthData.remainingAmount;
    });
    
    return {
      months,
      totalAllMonths,
      paidAllMonths,
      remainingAllMonths
    };
  };

  const getCurrentMonthData = (customer) => {
    const currentMonthKey = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}`;
    return customer.monthlyData[currentMonthKey] || {
      year: selectedYear,
      month: selectedMonth,
      monthName: new Date(selectedYear, selectedMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      totalAmount: 0,
      paidAmount: 0,
      remainingAmount: 0,
      sales: [],
      payments: []
    };
  };

  const getPreviousMonthRemainingBalance = (customer, year, month) => {
    // Calculate the previous month
    let prevYear = year;
    let prevMonth = month - 1;
    
    if (prevMonth < 0) {
      prevMonth = 11;
      prevYear = year - 1;
    }
    
    const prevMonthKey = `${prevYear}-${prevMonth.toString().padStart(2, '0')}`;
    const prevMonthData = customer.monthlyData[prevMonthKey];
    
    if (!prevMonthData) {
      return 0;
    }
    
    return prevMonthData.remainingAmount || 0;
  };

  const handleViewDetails = (customer) => {
    setSelectedCustomer(customer);
    setShowDetails(true);
  };

  const handlePrintMonthlyReport = (customer, year, month) => {
    const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
    const monthData = customer.monthlyData[monthKey] || {
      year,
      month,
      monthName: new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      totalAmount: 0,
      paidAmount: 0,
      remainingAmount: 0,
      sales: [],
      payments: []
    };

    const customerName = (customer.names && customer.names[0]) || customer.phone || '-';
    
    // Calculate previous month's remaining balance if checkbox is checked
    const previousMonthRemaining = showPreviousMonthBalance ? getPreviousMonthRemainingBalance(customer, year, month) : 0;
    
    // Get total remaining from all months if checkbox is checked
    const allMonthsSummary = getMonthlySummary(customer);
    const totalRemainingFromAllMonths = allMonthsSummary.remainingAllMonths;
    
    // Create items for the receipt
    const items = monthData.sales.map(sale => {
      if (sale.paymentMethod === 'Manual Debt') {
        return {
          name: 'Manual Pending Payment',
          quantity: 1,
          price: sale.totalAmount
        };
      } else if (Array.isArray(sale.items)) {
        return sale.items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price
        }));
      }
      return [];
    }).flat();

    // If no items, add a placeholder to show empty month
    if (items.length === 0) {
      items.push({
        name: 'No transactions for this month',
        quantity: 1,
        price: 0
      });
    }

    // Add previous month's remaining balance as a separate item if checkbox is checked
    if (showPreviousMonthBalance && previousMonthRemaining > 0) {
      items.unshift({
        name: 'Previous Month Remaining Balance',
        quantity: 1,
        price: previousMonthRemaining
      });
    }

    // Calculate total amount including previous month's balance
    const totalAmountWithPrevious = monthData.totalAmount + previousMonthRemaining;
    
    // Use total remaining from all months if checkbox is checked, otherwise use current month's remaining
    const remainingAmountToShow = showRemainingBalance ? totalRemainingFromAllMonths : (totalAmountWithPrevious - monthData.paidAmount);

    const html = generatePrintableHTML({
      customerName,
      customerPhone: customer.phone,
      customerId: customer.customerId || customer.phone,
      items,
      totalAmount: totalAmountWithPrevious,
      paidAmount: monthData.paidAmount,
      remainingAmount: remainingAmountToShow,
      date: `${monthData.monthName} Monthly Report`,
      isCustomerReport: true,
      subtotal: monthData.totalAmount,
      paymentMethod: 'Monthly Report',
      paymentHistory: monthData.payments,
      billNumber: '',
      builteNo: '',
      previousRemaining: previousMonthRemaining,
      showRemainingBalance
    });
    
    console.log('handlePrintMonthlyReport Debug:', {
      customerName,
      customerPhone: customer.phone,
      customerId: customer.customerId || customer.phone,
      totalAmount: monthData.totalAmount,
      paidAmount: monthData.paidAmount,
      remainingAmount: monthData.remainingAmount,
      previousMonthRemaining,
      totalAmountWithPrevious,
      totalRemainingFromAllMonths,
      remainingAmountToShow,
      showRemainingBalance,
      showPreviousMonthBalance,
      checkboxState: showRemainingBalance
    });

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = function () {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    };
  };

  const handleDownloadMonthlyReport = async (customer) => {
    try {
      const customerName = (customer.names && customer.names[0]) || customer.phone || 'Unknown';
      
      // Create new PDF document
      const doc = new jsPDF();
      
      // Set font and add title
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('CUSTOMER MONTHLY REPORT', 20, 20);
      
      // Add a line under title
      doc.setLineWidth(0.5);
      doc.line(20, 25, 190, 25);
      
      let yPosition = 40;
      
      // Customer basic info
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Customer Information:', 20, yPosition);
      yPosition += 10;
      
      doc.setFont('helvetica', 'normal');
      doc.text(`Name: ${customer.names?.join(', ') || 'N/A'}`, 20, yPosition);
      yPosition += 8;
      doc.text(`Phone: ${customer.phone}`, 20, yPosition);
      yPosition += 8;
      doc.text(`Customer ID: ${customer.customerId || customer.phone}`, 20, yPosition);
      yPosition += 20;
      
      // Monthly Summary
      const summary = getMonthlySummary(customer);
      doc.setFont('helvetica', 'bold');
      doc.text('Monthly Summary:', 20, yPosition);
      yPosition += 10;
      
      doc.setFont('helvetica', 'normal');
      doc.text(`Total Amount (All Months): Rs ${Math.round(summary.totalAllMonths).toLocaleString()}`, 20, yPosition);
      yPosition += 8;
      doc.text(`Total Paid (All Months): Rs ${Math.round(summary.paidAllMonths).toLocaleString()}`, 20, yPosition);
      yPosition += 8;
      doc.text(`Total Remaining (All Months): Rs ${Math.round(summary.remainingAllMonths).toLocaleString()}`, 20, yPosition);
      yPosition += 20;
      
      // Monthly Breakdown
      doc.setFont('helvetica', 'bold');
      doc.text('Monthly Breakdown:', 20, yPosition);
      yPosition += 10;
      
      doc.setFont('helvetica', 'normal');
      summary.months.forEach(monthKey => {
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }
        
        const monthData = customer.monthlyData[monthKey];
        doc.setFont('helvetica', 'bold');
        doc.text(`${monthData.monthName}:`, 20, yPosition);
        yPosition += 8;
        
        doc.setFont('helvetica', 'normal');
        doc.text(`  Total: Rs ${Math.round(monthData.totalAmount).toLocaleString()}`, 25, yPosition);
        yPosition += 6;
        doc.text(`  Paid: Rs ${Math.round(monthData.paidAmount).toLocaleString()}`, 25, yPosition);
        yPosition += 6;
        doc.text(`  Remaining: Rs ${Math.round(monthData.remainingAmount).toLocaleString()}`, 25, yPosition);
        yPosition += 6;
        doc.text(`  Sales Count: ${monthData.sales.length}`, 25, yPosition);
        yPosition += 6;
        doc.text(`  Payments Count: ${monthData.payments.length}`, 25, yPosition);
        yPosition += 10;
      });
      
      // Save the PDF
      const fileName = `customer_monthly_report_${customerName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    }
  };

  const handlePrintAllCustomersReport = () => {
    const monthKey = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}`;
    const monthName = new Date(selectedYear, selectedMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    // Get all customers with their remaining amounts
    const customersWithRemaining = Object.values(customers).map(customer => {
      const monthData = customer.monthlyData[monthKey] || {
        year: selectedYear,
        month: selectedMonth,
        monthName,
        totalAmount: 0,
        paidAmount: 0,
        remainingAmount: 0,
        sales: [],
        payments: []
      };
      
      return {
        name: (customer.names && customer.names[0]) || customer.phone || '-',
        phone: customer.phone,
        customerId: customer.customerId || customer.phone,
        totalAmount: monthData.totalAmount,
        paidAmount: monthData.paidAmount,
        remainingAmount: monthData.remainingAmount,
        salesCount: monthData.sales.length
      };
    }).filter(customer => customer.remainingAmount > 0 || showRemainingBalance); // Show all if checkbox is checked

    const html = generateAllCustomersReportHTML({
      customers: customersWithRemaining,
      monthName,
      showRemainingBalance,
      selectedYear,
      selectedMonth
    });

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = function () {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    };
  };

  // Bulk delete functionality
  const handleSelectCustomer = (customerPhone) => {
    const newSelected = new Set(selectedCustomers);
    if (newSelected.has(customerPhone)) {
      newSelected.delete(customerPhone);
    } else {
      newSelected.add(customerPhone);
    }
    setSelectedCustomers(newSelected);
  };

  const handleSelectAllCustomers = () => {
    if (selectedCustomers.size === filteredCustomers.length) {
      setSelectedCustomers(new Set());
    } else {
      setSelectedCustomers(new Set(filteredCustomers.map(c => c.phone)));
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedCustomers.size} selected customers? This action cannot be undone.`)) {
      return;
    }

    setBulkDeleteLoading(true);
    try {
      const customersToDelete = filteredCustomers.filter(c => selectedCustomers.has(c.phone));
      
      for (const customer of customersToDelete) {
        // Delete all sales for this customer
        for (const sale of customer.sales) {
          if (sale.id) {
            await deleteDoc(doc(db, 'receipts', sale.id));
          }
        }
      }
      
      setSelectedCustomers(new Set());
      setShowBulkDeleteModal(false);
      await fetchCustomerData();
      alert(`Successfully deleted ${customersToDelete.length} customers.`);
    } catch (error) {
      console.error('Bulk delete failed:', error);
      alert('Bulk delete failed: ' + error.message);
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  const filteredCustomers = Object.values(customers).filter(customer => {
    if (!searchTerm) return true;
    
    const nameMatch = customer.names?.some(name => 
      name.toLowerCase().includes(searchTerm.toLowerCase())
    ) || false;
    
    const phoneMatch = customer.phone?.includes(searchTerm) || false;
    
    return nameMatch || phoneMatch;
  });

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  const months = [
    { value: 0, name: 'January' },
    { value: 1, name: 'February' },
    { value: 2, name: 'March' },
    { value: 3, name: 'April' },
    { value: 4, name: 'May' },
    { value: 5, name: 'June' },
    { value: 6, name: 'July' },
    { value: 7, name: 'August' },
    { value: 8, name: 'September' },
    { value: 9, name: 'October' },
    { value: 10, name: 'November' },
    { value: 11, name: 'December' }
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold text-gray-800">Customer Monthly Report</h2>
        </div>
        <div className="flex gap-2">
          {selectedCustomers.size > 0 && (
            <button
              onClick={() => setShowBulkDeleteModal(true)}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md shadow-sm transition-all"
            >
              Delete Selected ({selectedCustomers.size})
            </button>
          )}
          <div className="w-48">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <div className="w-48">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              {months.map(month => (
                <option key={month.value} value={month.value}>{month.name}</option>
              ))}
            </select>
          </div>
          <div className="w-64">
            <input
              type="text"
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="showRemainingBalance"
              checked={showRemainingBalance}
              onChange={e => setShowRemainingBalance(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="showRemainingBalance" className="ml-2 block text-sm text-gray-700">
              Show Total Remaining Amount (All Months) in Reports
            </label>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8">
                  <input
                    type="checkbox"
                    checked={selectedCustomers.size === filteredCustomers.length && filteredCustomers.length > 0}
                    onChange={handleSelectAllCustomers}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </th>
                <th className="w-1"></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Customer ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">Customer Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Phone</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-40">Selected Month</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Total (PKR)</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Paid (PKR)</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Remaining (PKR)</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Sales Count</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Payments Count</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-48">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan="12" className="px-6 py-4 text-center text-gray-500">
                    {Object.keys(customers).length === 0 
                      ? 'No customers found. Add customers first.'
                      : 'No customers match your search criteria.'}
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer, index) => {
                  const currentMonthData = getCurrentMonthData(customer);
                  
                  return (
                    <tr key={index} className={`hover:bg-gray-50 ${currentMonthData.remainingAmount > 0 ? 'bg-red-50' : currentMonthData.remainingAmount < 0 ? 'bg-green-50' : ''}`}>
                      <td className="px-4 py-4 w-8">
                        <input
                          type="checkbox"
                          checked={selectedCustomers.has(customer.phone)}
                          onChange={() => handleSelectCustomer(customer.phone)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </td>
                      <td className={`w-1 ${currentMonthData.remainingAmount > 0 ? 'bg-red-500' : ''}`}></td>
                      <td className="px-4 py-4 whitespace-nowrap w-32">
                        <div className="text-sm font-medium text-gray-900 font-mono">
                          {customer.customerId || customer.phone || 'N/A'}
                        </div>
                      </td>
                      <td className="px-4 py-4 w-48">
                        <div className="text-sm text-gray-900 font-medium break-words">{customer.names?.join(', ') || 'N/A'}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap w-32">
                        <div className="text-sm font-medium text-gray-900">{customer.phone || 'N/A'}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-center w-40">
                        {currentMonthData.monthName}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium w-32">
                        Rs {Math.round(currentMonthData.totalAmount).toLocaleString()}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium w-32">
                        Rs {Math.round(currentMonthData.paidAmount).toLocaleString()}
                      </td>
                                             <td className={`px-4 py-4 whitespace-nowrap text-sm text-right font-medium w-32 ${currentMonthData.remainingAmount > 0 ? 'text-red-600' : currentMonthData.remainingAmount < 0 ? 'text-green-600' : 'text-gray-900'}`}>
                         <div className="flex items-center justify-end">
                           {currentMonthData.remainingAmount > 0 && (
                             <svg className="w-4 h-4 text-red-600 mr-1" fill="currentColor" viewBox="0 0 20 20">
                               <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                             </svg>
                           )}
                           Rs {Math.round(currentMonthData.remainingAmount).toLocaleString()}
                           {currentMonthData.remainingAmount === 0 && (
                             <span className="ml-1 text-xs text-gray-400">(No transactions)</span>
                           )}
                         </div>
                       </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-center w-32">
                        {currentMonthData.sales.length}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-center w-32">
                        {currentMonthData.payments.length}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-center space-x-1 w-48">
                        {/* View Details Button */}
                        <button
                          onClick={() => handleViewDetails(customer)}
                          className="text-purple-600 hover:text-purple-800 p-1 rounded"
                          title="View Monthly Details"
                        >
                          <svg className="w-5 h-5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        
                        {/* Print Monthly Report Button */}
                        <button
                          onClick={() => handlePrintMonthlyReport(customer, selectedYear, selectedMonth)}
                          className="text-gray-600 hover:text-gray-800 p-1 rounded"
                          title="Print Monthly Report"
                        >
                          <svg className="w-5 h-5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                          </svg>
                        </button>
                        
                        {/* Download Report Button */}
                        <button
                          onClick={() => handleDownloadMonthlyReport(customer)}
                          className="text-blue-600 hover:text-blue-800 p-1 rounded"
                          title="Download Monthly Report as PDF"
                        >
                          <svg className="w-5 h-5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Bulk Delete Customers</h3>
              <button
                onClick={() => setShowBulkDeleteModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="mb-6">
              <div className="p-4 bg-red-50 border border-red-200 rounded-md mb-4">
                <p className="text-sm text-red-800">
                  <strong>Warning:</strong> This action cannot be undone. All sales records for the selected customers will be permanently deleted.
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-700">
                  <strong>Selected Customers:</strong> {selectedCustomers.size}
                </p>
                <p className="text-sm text-gray-700">
                  <strong>Total Sales Records:</strong> {filteredCustomers.filter(c => selectedCustomers.has(c.phone)).reduce((sum, c) => sum + (c.sales?.length || 0), 0)}
                </p>
              </div>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowBulkDeleteModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleteLoading}
                className={`px-4 py-2 rounded-md shadow-sm ${
                  bulkDeleteLoading 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {bulkDeleteLoading ? 'Deleting...' : 'Delete Selected Customers'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Monthly Details Modal */}
      {showDetails && selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-[90vh] flex flex-col">
            {/* Fixed Header */}
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Customer Monthly Details</h3>
                <p className="text-sm text-gray-500 mt-1">Name: {selectedCustomer.names?.join(', ') || 'N/A'}</p>
                <p className="text-sm text-gray-500">Phone: {selectedCustomer.phone}</p>
              </div>
              <button
                onClick={() => setShowDetails(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {/* Overall Summary Section */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Overall Summary (All Months)</h4>
                  {(() => {
                    const summary = getMonthlySummary(selectedCustomer);
                    return (
                      <div className="grid grid-cols-4 gap-4">
                        <div className="bg-white p-4 rounded-lg shadow">
                          <div className="text-sm text-gray-500">Total Amount</div>
                          <div className="text-xl font-semibold text-gray-900">
                            Rs {Math.round(summary.totalAllMonths).toLocaleString()}
                          </div>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow">
                          <div className="text-sm text-gray-500">Total Paid</div>
                          <div className="text-xl font-semibold text-gray-900">
                            Rs {Math.round(summary.paidAllMonths).toLocaleString()}
                          </div>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow">
                          <div className="text-sm text-gray-500">Total Remaining</div>
                          <div className={`text-xl font-semibold ${summary.remainingAllMonths > 0 ? 'text-red-600' : summary.remainingAllMonths < 0 ? 'text-green-600' : 'text-gray-900'}`}>
                            <div className="flex items-center">
                              {summary.remainingAllMonths > 0 && (
                                <svg className="w-5 h-5 text-red-600 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                              )}
                              Rs {Math.round(summary.remainingAllMonths).toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow">
                          <div className="text-sm text-gray-500">Total Months</div>
                          <div className="text-xl font-semibold text-gray-900">
                            {summary.months.length}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Monthly Breakdown Section */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Monthly Breakdown</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full divide-y divide-gray-200">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total (PKR)</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Paid (PKR)</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Remaining (PKR)</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Sales</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Payments</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {(() => {
                          const summary = getMonthlySummary(selectedCustomer);
                          return summary.months.map((monthKey, index) => {
                            const monthData = selectedCustomer.monthlyData[monthKey];
                            return (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="px-3 py-2 text-sm text-gray-900 font-medium">
                                  {monthData.monthName}
                                </td>
                                <td className="px-3 py-2 text-sm text-gray-900 text-right">
                                  Rs {Math.round(monthData.totalAmount).toLocaleString()}
                                </td>
                                <td className="px-3 py-2 text-sm text-gray-900 text-right">
                                  Rs {Math.round(monthData.paidAmount).toLocaleString()}
                                </td>
                                <td className={`px-3 py-2 text-sm text-right ${monthData.remainingAmount > 0 ? 'text-red-600' : monthData.remainingAmount < 0 ? 'text-green-600' : 'text-gray-900'}`}>
                                  <div className="flex items-center justify-end">
                                    {monthData.remainingAmount > 0 && (
                                      <svg className="w-3 h-3 text-red-600 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                      </svg>
                                    )}
                                    Rs {Math.round(monthData.remainingAmount).toLocaleString()}
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-sm text-gray-500 text-center">
                                  {monthData.sales.length}
                                </td>
                                <td className="px-3 py-2 text-sm text-gray-500 text-center">
                                  {monthData.payments.length}
                                </td>
                                <td className="px-3 py-2 text-sm text-center">
                                  <button
                                    onClick={() => handlePrintMonthlyReport(selectedCustomer, monthData.year, monthData.month)}
                                    className="text-blue-600 hover:text-blue-800 p-1 rounded"
                                    title="Print Monthly Report"
                                  >
                                    <svg className="w-4 h-4 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                    </svg>
                                  </button>
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomerMonthlyReport; 