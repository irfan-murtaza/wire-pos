import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, where, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { generatePrintableHTML } from './PrintableReceipt';

function CustomerManagement() {
  const [customers, setCustomers] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSale, setSelectedSale] = useState(null);
  const [showSaleDetails, setShowSaleDetails] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentCustomer, setPaymentCustomer] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentComment, setPaymentComment] = useState('');
  const [chequeNumber, setChequeNumber] = useState('');
  const [paymentErrors, setPaymentErrors] = useState({});
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', pendingAmount: '' });
  const [addCustomerErrors, setAddCustomerErrors] = useState({});
  const [showAddPendingModal, setShowAddPendingModal] = useState(false);
  const [pendingCustomer, setPendingCustomer] = useState(null);
  const [pendingAmount, setPendingAmount] = useState('');
  const [pendingError, setPendingError] = useState('');
  const [pendingReason, setPendingReason] = useState('');
  const [newCustomerReason, setNewCustomerReason] = useState('');
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printCustomer, setPrintCustomer] = useState(null);
  const [previousDayDebt, setPreviousDayDebt] = useState(0);
  const [printDate, setPrintDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchCustomerData();
  }, []);

  const fetchCustomerData = async () => {
    try {
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
        const cleanName = sale.customerName ? sale.customerName.trim() : '';
        if (!customerData[customerKey]) {
          customerData[customerKey] = {
            names: cleanName ? [cleanName] : [],
            phone: sale.customerPhone,
            totalAmount: sale.totalAmount || 0,
            paidAmount: sale.paidAmount || 0,
            remainingAmount: sale.remainingAmount || 0,
            sales: [sale],
            items: {}
          };
          sale.items.forEach(item => {
            const itemKey = item.name;
            customerData[customerKey].items[itemKey] = {
              name: item.name,
              totalQuantity: item.quantity || 0,
              totalValue: (item.quantity || 0) * (item.price || 0)
            };
          });
        } else {
          // Add name if not already present (case-insensitive, trimmed)
          if (cleanName && !customerData[customerKey].names.some(n => n.trim().toLowerCase() === cleanName.toLowerCase())) {
            customerData[customerKey].names.push(cleanName);
          }
          customerData[customerKey].totalAmount += sale.totalAmount || 0;
          customerData[customerKey].paidAmount += sale.paidAmount || 0;
          customerData[customerKey].remainingAmount += sale.remainingAmount || 0;
          customerData[customerKey].sales.push(sale);
          sale.items.forEach(item => {
            const itemKey = item.name;
            if (!customerData[customerKey].items[itemKey]) {
              customerData[customerKey].items[itemKey] = {
                name: item.name,
                totalQuantity: 0,
                totalValue: 0
              };
            }
            customerData[customerKey].items[itemKey].totalQuantity += item.quantity || 0;
            customerData[customerKey].items[itemKey].totalValue += (item.quantity || 0) * (item.price || 0);
          });
        }
      });

      setCustomers(customerData);
    } catch (error) {
      console.error('Error fetching customer data:', error);
      alert('Error fetching customer data. Please check console for details.');
    } finally {
      setLoading(false);
    }
  };

  // Helper to check if a date is today
  const isToday = (dateString) => {
    const today = new Date();
    const date = new Date(dateString);
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  };

  // Helper to check if a date matches the selected print date (robust to format/timezone)
  const isPrintDate = (dateString) => {
    const selected = new Date(printDate);
    const saleDate = new Date(dateString);
    // Normalize both dates to local year, month, day
    return (
      selected.getFullYear() === saleDate.getFullYear() &&
      selected.getMonth() === saleDate.getMonth() &&
      selected.getDate() === saleDate.getDate()
    );
  };

  // New print handler to use modal values
  const handlePrintWithDebt = () => {
    if (!printCustomer) return;
    const customer = printCustomer;
    const customerName = (customer.names && customer.names[0]) || customer.name || customer.phone || '-';
    let items = [];
    customer.sales.forEach(sale => {
      if (isPrintDate(sale.date)) {
        if (sale.paymentMethod === 'Manual Debt') {
          items.push({
            name: 'Manual Pending Payment',
            quantity: 1,
            price: sale.totalAmount
          });
        } else if (Array.isArray(sale.items)) {
          sale.items.forEach(item => {
            items.push({
              name: item.name,
              quantity: item.quantity,
              price: item.price
            });
          });
        }
      }
    });
    // Add previous day debt if entered and > 0
    if (previousDayDebt && Number(previousDayDebt) > 0) {
      items.push({
        name: 'Previous Day Debt',
        quantity: 1,
        price: Number(previousDayDebt)
      });
    }
    const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    // Calculate paid amount for the selected date
    const paidAmountForSelectedDate = customer.sales
      .filter(sale => sale.paidAmount && sale.paidAmount > 0 && sale.paymentMethod !== 'Manual Debt' && isPrintDate(sale.date))
      .reduce((sum, sale) => sum + sale.paidAmount, 0);
    // Calculate remaining amount for the receipt
    const remainingAmount = totalAmount - paidAmountForSelectedDate;
    const paymentHistory = customer.sales
      .filter(sale => sale.paidAmount && sale.paidAmount > 0 && sale.paymentMethod !== 'Manual Debt' && isPrintDate(sale.date))
      .map(sale => ({
        date: sale.date,
        amount: sale.paidAmount,
        paymentMethod: sale.paymentMethod,
        chequeNumber: sale.chequeNumber,
        comment: sale.comment,
        type: sale.paymentMethod || 'Sale'
      }));
    const html = generatePrintableHTML({
      customerName,
      customerPhone: customer.phone,
      items,
      totalAmount,
      paidAmount: paidAmountForSelectedDate,
      remainingAmount,
      date: printDate,
      isCustomerReport: true,
      subtotal: totalAmount,
      paymentMethod: 'Customer Report',
      paymentHistory
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
    setShowPrintModal(false);
    setPrintCustomer(null);
    setPreviousDayDebt(0);
    setPrintDate(new Date().toISOString().split('T')[0]);
  };

  const handlePrint = (customer) => {
    const customerName = (customer.names && customer.names[0]) || customer.name || customer.phone || '-';
    let items = [];
    customer.sales.forEach(sale => {
      if (sale.paymentMethod === 'Manual Debt') {
        // Only add a single manual pending payment line for this sale
        items.push({
          name: 'Manual Pending Payment',
          quantity: 1,
          price: sale.totalAmount
        });
      } else if (Array.isArray(sale.items)) {
        // Add all product items for normal sales
        sale.items.forEach(item => {
          items.push({
            name: item.name,
            quantity: item.quantity,
            price: item.price
          });
        });
      }
    });
    // Calculate total amount (products + manual debts)
    const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    // Calculate paid amount for the selected date
    const paidAmountForSelectedDate = customer.sales
      .filter(sale => sale.paidAmount && sale.paidAmount > 0 && sale.paymentMethod !== 'Manual Debt' && isPrintDate(sale.date))
      .reduce((sum, sale) => sum + sale.paidAmount, 0);
    // Calculate remaining amount for the receipt
    const remainingAmount = totalAmount - paidAmountForSelectedDate;
    const paymentHistory = customer.sales
      .filter(sale => sale.paidAmount && sale.paidAmount > 0 && sale.paymentMethod !== 'Manual Debt' && isPrintDate(sale.date))
      .map(sale => ({
        date: sale.date,
        amount: sale.paidAmount,
        paymentMethod: sale.paymentMethod,
        chequeNumber: sale.chequeNumber,
        comment: sale.comment,
        type: sale.paymentMethod || 'Sale'
      }));
    const html = generatePrintableHTML({
      customerName,
      customerPhone: customer.phone,
      items,
      totalAmount,
      paidAmount: paidAmountForSelectedDate,
      remainingAmount,
      date: new Date().toISOString(),
      isCustomerReport: true,
      subtotal: totalAmount,
      paymentMethod: 'Customer Report',
      paymentHistory
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

  const handleViewDetails = (customer) => {
    setSelectedCustomer(customer);
    setShowDetails(true);
  };

  const handleViewSaleDetails = (sale) => {
    setSelectedSale(sale);
    setShowSaleDetails(true);
  };

  const handleAddPaymentClick = (customer) => {
    console.log('Opening payment modal for customer:', customer.phone);
    // Close all modals first
    setShowDetails(false);
    setShowSaleDetails(false);
    setShowAddCustomerModal(false);
    setShowAddPendingModal(false);
    setShowPrintModal(false);
    
    // Reset all modal-related states
    setSelectedCustomer(null);
    setSelectedSale(null);
    setPrintCustomer(null);
    
    // Then open payment modal
    setPaymentCustomer(customer);
    setPaymentAmount(customer.remainingAmount);
    setPaymentMethod('Cash');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentComment('');
    setChequeNumber('');
    setPaymentErrors({});
    setShowPaymentModal(true);
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    const amount = Math.round(parseFloat(paymentAmount));
    const remaining = Math.round(paymentCustomer.remainingAmount);
    const newErrors = {};
    if (!paymentAmount || amount <= 0) {
      newErrors.amount = 'Please enter a valid payment amount';
    }
    if (paymentMethod === 'Cheque' && !chequeNumber.trim()) {
      newErrors.chequeNumber = 'Cheque number is required';
    }
    if (paymentMethod === 'Other' && !paymentComment.trim()) {
      newErrors.comment = 'Comment is required for "Other" payment method';
    }
    setPaymentErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    try {
      // Add payment record to paymentHistory
      await addDoc(collection(db, 'paymentHistory'), {
        customerPhone: paymentCustomer.phone,
        amount: amount,
        paymentMethod,
        comment: paymentMethod === 'Other' ? paymentComment : '',
        chequeNumber: paymentMethod === 'Cheque' ? chequeNumber : '',
        date: new Date(paymentDate).toISOString(),
        type: 'Customer Payment'
      });
      // Update all sales for this customer with remaining > 0
      const salesToUpdate = paymentCustomer.sales.filter(sale => sale.remainingAmount > 0);
      let remainingToPay = amount;
      for (const sale of salesToUpdate) {
        if (remainingToPay <= 0) break;
        const payAmount = Math.min(remainingToPay, sale.remainingAmount);
        const saleDoc = doc(db, 'receipts', sale.id);
        await updateDoc(saleDoc, {
          paidAmount: (sale.paidAmount || 0) + payAmount,
          remainingAmount: Math.max(0, sale.remainingAmount - payAmount),
          isDebt: sale.remainingAmount - payAmount > 0
        });
        remainingToPay -= payAmount;
      }
      // If there is still remainingToPay (i.e., customer had no dues or overpayment), record as negative remainingAmount (credit)
      if (remainingToPay > 0) {
        // Optionally, you can store this as a special credit record or update a customer credit field
        // For now, just add a negative sale to reflect the credit
        await addDoc(collection(db, 'receipts'), {
          customerName: paymentCustomer.name,
          customerPhone: paymentCustomer.phone,
          totalAmount: 0,
          paidAmount: 0,
          remainingAmount: -remainingToPay,
          date: new Date(paymentDate).toISOString(),
          paymentMethod,
          chequeNumber: paymentMethod === 'Cheque' ? chequeNumber : '',
          comment: paymentMethod === 'Other' ? paymentComment : '',
          items: [],
          isCredit: true
        });
      }
      setShowPaymentModal(false);
      setPaymentCustomer(null);
      setPaymentAmount('');
      setPaymentMethod('Cash');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setPaymentComment('');
      setChequeNumber('');
      setPaymentErrors({});
      // Refresh customer data
      fetchCustomerData();
    } catch (error) {
      alert('Error saving payment: ' + error.message);
    }
  };

  const handlePrintSale = (sale, customer) => {
    const html = generatePrintableHTML({
      customerName: (customer.names && customer.names[0]) || customer.name || '-',
      customerPhone: customer.phone,
      items: sale.items || [],
      totalAmount: sale.totalAmount,
      paidAmount: sale.paidAmount || 0,
      remainingAmount: sale.remainingAmount || 0,
      date: sale.date,
      paymentMethod: sale.paymentMethod,
      chequeNumber: sale.chequeNumber,
      comment: sale.comment,
      discount: sale.discount || 0,
      discountAmount: sale.discountAmount || 0,
      subtotal: sale.totalAmount + (sale.discountAmount || 0),
      paymentHistory: [],
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

  const filteredCustomers = Object.values(customers).filter(customer =>
    (customer.name?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
    (customer.phone?.includes(searchTerm) || false)
  );

  // Add console log for debugging
  useEffect(() => {
    console.log('Search term:', searchTerm);
    console.log('Filtered customers:', filteredCustomers);
  }, [searchTerm, filteredCustomers]);

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
        <h2 className="text-2xl font-semibold text-gray-800">Customer Management</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddCustomerModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md shadow-sm transition-all"
          >
            Add Customer
          </button>
          <div className="w-64">
            <input
              type="text"
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Names</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total (PKR)</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Paid (PKR)</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Remaining (PKR)</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredCustomers.map((customer, index) => (
              <tr key={index} className={`hover:bg-gray-50 ${customer.remainingAmount > 0 ? 'bg-red-50' : customer.remainingAmount < 0 ? 'bg-green-50' : ''}`}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{customer.names?.join(', ')}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{customer.phone}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                  {Math.round(customer.totalAmount)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                  {Math.round(customer.paidAmount)}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm text-right ${customer.remainingAmount > 0 ? 'text-green-600' : customer.remainingAmount < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {customer.remainingAmount !== 0 ? Math.round(customer.remainingAmount) : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-center space-x-2">
                  <button
                    onClick={() => { setPrintCustomer(customer); setShowPrintModal(true); }}
                    className="text-blue-600 hover:text-blue-800"
                    title="Print Report"
                  >
                    <svg className="w-5 h-5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleViewDetails(customer)}
                    className="text-purple-600 hover:text-purple-800 ml-2"
                    title="View Details"
                  >
                    <svg className="w-5 h-5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleAddPaymentClick(customer)}
                    className="ml-2 text-green-600 hover:text-green-800"
                    title="Add Payment"
                  >
                    <svg className="w-5 h-5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      console.log('Opening add pending modal for customer:', customer.phone);
                      // Close all modals first
                      setShowDetails(false);
                      setShowSaleDetails(false);
                      setShowPaymentModal(false);
                      setShowAddCustomerModal(false);
                      setShowPrintModal(false);
                      
                      // Reset all modal-related states
                      setSelectedCustomer(null);
                      setSelectedSale(null);
                      setPrintCustomer(null);
                      setPaymentCustomer(null);
                      
                      // Then open add pending modal
                      setPendingCustomer(customer);
                      setPendingAmount('');
                      setPendingReason('');
                      setPendingError('');
                      setShowAddPendingModal(true);
                    }}
                    className="ml-2 text-orange-600 hover:text-orange-800"
                    title="Add Pending Payment"
                  >
                    <svg className="w-5 h-5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Customer Details Modal */}
      {showDetails && selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Customer Details</h3>
                <p className="text-sm text-gray-500 mt-1">Name: {selectedCustomer.name}</p>
                <p className="text-sm text-gray-500">Phone: {selectedCustomer.phone}</p>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => handlePrint(selectedCustomer)}
                  className="text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-50"
                  title="Print Details"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                </button>
                <button
                  onClick={() => setShowDetails(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="space-y-6">
              {/* Summary Section */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Summary</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white p-4 rounded-lg shadow">
                    <div className="text-sm text-gray-500">Total Amount</div>
                    <div className="text-xl font-semibold text-gray-900">
                      Rs {Math.round(selectedCustomer.totalAmount)}
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow">
                    <div className="text-sm text-gray-500">Total Paid</div>
                    <div className="text-xl font-semibold text-gray-900">
                      Rs {Math.round(selectedCustomer.paidAmount)}
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow">
                    <div className="text-sm text-gray-500">Remaining Amount</div>
                    <div className={`text-xl font-semibold ${selectedCustomer.remainingAmount > 0 ? 'text-green-600' : selectedCustomer.remainingAmount < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                      Rs {Math.round(selectedCustomer.remainingAmount)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sales History Section */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Sales History</h4>
                <table className="w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="w-1/5 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date & Time</th>
                      <th className="w-1/5 px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total (PKR)</th>
                      <th className="w-1/5 px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Paid (PKR)</th>
                      <th className="w-1/5 px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Remaining (PKR)</th>
                      <th className="w-1/5 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Payment Method</th>
                      <th className="w-1/5 px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Details</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {selectedCustomer.sales.map((sale, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-sm text-gray-500">
                          {new Date(sale.date).toLocaleString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-900 text-right">
                          {Math.round(sale.totalAmount)}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-900 text-right">
                          {Math.round(sale.paidAmount || 0)}
                        </td>
                        <td className="px-3 py-2 text-sm text-red-600 text-right">
                          {sale.remainingAmount > 0 ? Math.round(sale.remainingAmount) : '-'}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-500">
                          {sale.paymentMethod}
                          {sale.chequeNumber && ` (Cheque #${sale.chequeNumber})`}
                          {sale.comment && ` - ${sale.comment}`}
                        </td>
                        <td className="px-3 py-2 text-sm text-center">
                          <button
                            onClick={() => handleViewSaleDetails(sale)}
                            className="text-blue-600 hover:text-blue-800 mr-2"
                            title="View Sale Details"
                          >
                            <svg className="w-5 h-5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handlePrintSale(sale, selectedCustomer)}
                            className="text-green-600 hover:text-green-800"
                            title="Print Sale Receipt"
                          >
                            <svg className="w-5 h-5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sale Details Modal */}
      {showSaleDetails && selectedSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Sale Details</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Date: {new Date(selectedSale.date).toLocaleString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
              <button
                onClick={() => setShowSaleDetails(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-6">
              {/* Items Section */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Items Purchased</h4>
                <table className="w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="w-2/5 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                      <th className="w-1/5 px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                      <th className="w-1/5 px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Unit Price (PKR)</th>
                      <th className="w-1/5 px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total (PKR)</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {selectedSale.items.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-sm text-gray-900">{item.name}</td>
                        <td className="px-3 py-2 text-sm text-gray-500 text-right">{item.quantity}</td>
                        <td className="px-3 py-2 text-sm text-gray-900 text-right">{Math.round(item.price)}</td>
                        <td className="px-3 py-2 text-sm text-gray-900 text-right">{Math.round(item.quantity * item.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary Section */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-lg shadow">
                    <div className="text-sm text-gray-500">Payment Method</div>
                    <div className="text-lg font-semibold text-gray-900">
                      {selectedSale.paymentMethod}
                      {selectedSale.chequeNumber && ` (Cheque #${selectedSale.chequeNumber})`}
                      {selectedSale.comment && ` - ${selectedSale.comment}`}
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow">
                    <div className="text-sm text-gray-500">Total Amount</div>
                    <div className="text-lg font-semibold text-gray-900">
                      Rs {Math.round(selectedSale.totalAmount)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPrintModal && printCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Print Customer Report for {printCustomer.names?.[0] || printCustomer.phone}
              </h3>
              <button onClick={() => setShowPrintModal(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={printDate}
                  onChange={e => setPrintDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePrintWithDebt}
                className="px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700"
              >
                Print
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Payment Modal */}
      {showPaymentModal && paymentCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add Payment for {paymentCustomer.names?.[0] || paymentCustomer.phone}</h3>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setPaymentCustomer(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handlePaymentSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (PKR)</label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  className={`w-full px-4 py-2 border rounded-md shadow-sm ${paymentErrors.amount ? 'border-red-500' : 'border-gray-300'}`}
                  min="1"
                  required
                />
                {paymentErrors.amount && <p className="text-red-600 text-xs mt-1">{paymentErrors.amount}</p>}
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm"
                >
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              {paymentMethod === 'Cheque' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cheque Number</label>
                  <input
                    type="text"
                    value={chequeNumber}
                    onChange={e => setChequeNumber(e.target.value)}
                    className={`w-full px-4 py-2 border rounded-md shadow-sm ${paymentErrors.chequeNumber ? 'border-red-500' : 'border-gray-300'}`}
                    required
                  />
                  {paymentErrors.chequeNumber && <p className="text-red-600 text-xs mt-1">{paymentErrors.chequeNumber}</p>}
                </div>
              )}
              {paymentMethod === 'Other' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Comment</label>
                  <input
                    type="text"
                    value={paymentComment}
                    onChange={e => setPaymentComment(e.target.value)}
                    className={`w-full px-4 py-2 border rounded-md shadow-sm ${paymentErrors.comment ? 'border-red-500' : 'border-gray-300'}`}
                    required
                  />
                  {paymentErrors.comment && <p className="text-red-600 text-xs mt-1">{paymentErrors.comment}</p>}
                </div>
              )}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={e => setPaymentDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm"
                  required
                />
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowPaymentModal(false);
                    setPaymentCustomer(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-md shadow-sm hover:bg-green-700"
                >
                  Add Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Pending Modal */}
      {showAddPendingModal && pendingCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add Pending Payment for {pendingCustomer.names?.[0] || pendingCustomer.phone}</h3>
              <button
                onClick={() => {
                  setShowAddPendingModal(false);
                  setPendingCustomer(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <form onSubmit={e => {
              e.preventDefault();
              // Validation
              let error = '';
              if (!pendingAmount || isNaN(Number(pendingAmount))) error = 'Please enter a valid amount';
              if (!pendingReason.trim()) error = 'Please enter a reason';
              if (error) {
                setPendingError(error);
                return;
              }
              // Add manual debt as a new sale/receipt
              addDoc(collection(db, 'receipts'), {
                customerName: pendingCustomer.names?.[0] || '',
                customerPhone: pendingCustomer.phone,
                totalAmount: Number(pendingAmount),
                paidAmount: 0,
                remainingAmount: Number(pendingAmount),
                date: new Date().toISOString(),
                paymentMethod: 'Manual Debt',
                comment: pendingReason,
                items: [],
                isDebt: true
              }).then(() => {
                setShowAddPendingModal(false);
                setPendingCustomer(null);
                setPendingAmount('');
                setPendingReason('');
                setPendingError('');
                fetchCustomerData();
              }).catch(err => {
                setPendingError('Error saving pending payment: ' + err.message);
              });
            }}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (PKR)</label>
                <input
                  type="number"
                  value={pendingAmount}
                  onChange={e => setPendingAmount(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm"
                  min="1"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <input
                  type="text"
                  value={pendingReason}
                  onChange={e => setPendingReason(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={new Date().toISOString().split('T')[0]}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 cursor-not-allowed"
                />
              </div>
              {pendingError && <p className="text-red-600 text-xs mb-2">{pendingError}</p>}
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddPendingModal(false);
                    setPendingCustomer(null);
                    setPendingAmount('');
                    setPendingReason('');
                    setPendingError('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-600 text-white rounded-md shadow-sm hover:bg-orange-700"
                >
                  Add Pending
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomerManagement;
