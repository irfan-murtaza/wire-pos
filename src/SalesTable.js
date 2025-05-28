import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, addDoc, where, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { generatePrintableHTML } from './PrintableReceipt';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import EditSaleModal from './EditSaleModal';

function SalesTable({ onAddNewSale, refreshTrigger }) {
  const [sales, setSales] = useState([]);
  const [filteredSales, setFilteredSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [productFilter, setProductFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [showOnlyDebt, setShowOnlyDebt] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentComment, setPaymentComment] = useState('');
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [paymentErrors, setPaymentErrors] = useState({});
  const [chequeNumber, setChequeNumber] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editSale, setEditSale] = useState(null);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);

  useEffect(() => {
    fetchSales();
  }, [refreshTrigger]);

  useEffect(() => {
    filterSales();
  }, [sales, selectedMonth, selectedYear, productFilter, customerFilter, showOnlyDebt]);

  const filterSales = () => {
    const filtered = sales.filter(sale => {
      const saleDate = new Date(sale.date);
      console.log("sales selected month: ", selectedMonth)
      console.log("sales selected Year: ", selectedYear)
      const monthMatch = saleDate.getMonth() === selectedMonth;
      const yearMatch = saleDate.getFullYear() === selectedYear;
      const productMatch = productFilter === '' || 
        sale.items.some(item => 
          item.name.toLowerCase().includes(productFilter.toLowerCase())
        );
      const customerMatch = customerFilter === '' || 
        sale.customerName.toLowerCase().includes(customerFilter.toLowerCase());
      const debtMatch = !showOnlyDebt || (sale.remainingAmount > 0);
      
      return monthMatch && yearMatch && productMatch && customerMatch && debtMatch;
    });
    setFilteredSales(filtered);
  };

  const fetchSales = async () => {
    try {
      const salesQuery = query(collection(db, 'receipts'), orderBy('date', 'desc'));
      const querySnapshot = await getDocs(salesQuery);
      const salesList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSales(salesList);
    } catch (error) {
      console.error('Error fetching sales:', error);
      alert('Error fetching sales. Please check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateMonthlyTotal = () => {
    return filteredSales.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
  };

  const calculateMonthlyDebt = () => {
    return filteredSales.reduce((sum, sale) => sum + (sale.remainingAmount || 0), 0);
  };

  const handlePrint = async (sale) => {
    try {
      // Get payment history for the sale
      const paymentHistoryQuery = query(
        collection(db, 'paymentHistory'),
        where('saleId', '==', sale.id),
        orderBy('date', 'desc')
      );
      
      const querySnapshot = await getDocs(paymentHistoryQuery);
      const paymentHistory = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        date: doc.data().date || new Date().toISOString(),
        amount: Math.round(doc.data().amount || 0)
      }));

      const html = generatePrintableHTML({
        customerName: sale.customerName,
        customerPhone: sale.customerPhone,
        items: sale.items,
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
        paymentHistory: paymentHistory,
        billNumber: sale.billNumber,
        builteNo: sale.builteNo || '-'
      });
    
      const printWindow = window.open('', '_blank', 'width=800,height=600');
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    } catch (error) {
      console.error('Error generating printable receipt:', error);
      alert('Error generating receipt. Please check console for details.');
    }
  };

  const handleViewDetails = async (sale) => {
    setSelectedSale(sale);
    console.log('Selected Sale Items:', sale.items);
    try {
      console.log('Fetching payment history for sale:', sale.id);
      
      // Get payment history from paymentHistory collection
      const paymentHistoryQuery = query(
        collection(db, 'paymentHistory'),
        where('saleId', '==', sale.id),
        orderBy('date', 'desc')
      );
      
      const querySnapshot = await getDocs(paymentHistoryQuery);
      console.log('Query snapshot:', querySnapshot.docs.map(doc => doc.data()));
      
      let history = [];
      
      // Get all payment records
      const paymentRecords = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date || new Date().toISOString(),
        amount: Math.round(doc.data().amount || 0)
      }));

      // Find the initial payment record
      const initialPayment = paymentRecords.find(payment => payment.type === 'Initial Payment');
      
      // Add initial payment if it exists
      if (initialPayment) {
        history.push(initialPayment);
      }

      // Add additional payments (excluding the initial payment)
      const additionalPayments = paymentRecords.filter(payment => payment.type === 'Additional Payment');
      history = [...history, ...additionalPayments];

      // Sort payments by date
      history = history.sort((a, b) => new Date(b.date) - new Date(a.date));

      console.log('Processed payment history:', history);
      setPaymentHistory(history);
      setShowPaymentHistory(true);
    } catch (error) {
      console.error('Error fetching payment history:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      setPaymentHistory([]);
      setShowPaymentHistory(true);
    }
  };

  const handleDownloadReport = () => {
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(16);
    doc.text(`Monthly Sales Report - ${months[selectedMonth]} ${selectedYear}`, 14, 15);
    
    // Add filter information
    doc.setFontSize(10);
    let yPos = 25;
    if (productFilter) {
      doc.text(`Product Filter: ${productFilter}`, 14, yPos);
      yPos += 5;
    }
    if (customerFilter) {
      doc.text(`Customer Filter: ${customerFilter}`, 14, yPos);
      yPos += 5;
    }
    if (showOnlyDebt) {
      doc.text('Showing Only Debt Sales', 14, yPos);
      yPos += 5;
    }
    
    // Add summary
    doc.setFontSize(12);
    doc.text('Summary', 14, yPos + 5);
    doc.setFontSize(10);
    doc.text(`Total Sales: Rs ${Math.round(calculateMonthlyTotal())}`, 14, yPos + 12);
    doc.text(`Total Paid: Rs ${Math.round(filteredSales.reduce((sum, sale) => sum + (sale.paidAmount || 0), 0))}`, 14, yPos + 17);
    doc.text(`Total Debt: Rs ${Math.round(calculateMonthlyDebt())}`, 14, yPos + 22);
    
    // Prepare table data
    const tableData = filteredSales.map(sale => {
      // Format items as a string with line breaks
      const itemsText = sale.items.map(item => 
        `${item.name} (${item.quantity}: ${Math.round(item.price || item.unitPrice)})`
      ).join('\n');

      // Format discount information
      const discountText = sale.discount > 0 ? 
        `${sale.discount}% (Rs ${Math.round(sale.discountAmount || 0)})` : '-';

      // Format payment method with details
      let paymentInfo = sale.paymentMethod;
      if (sale.paymentMethod === 'Cheque' && sale.chequeNumber) {
        paymentInfo = `Cheque #${sale.chequeNumber}`;
      } else if (sale.paymentMethod === 'Other' && sale.comment) {
        paymentInfo = sale.comment;
      }

      // Format customer name with phone number
      const customerInfo = `${sale.customerName}\n${sale.customerPhone || '-'}`;

      return [
        sale.billNumber || '-',
        sale.builteNo || '-',
        formatDate(sale.date),
        customerInfo,
        paymentInfo,
        Math.round(sale.totalAmount),
        itemsText
      ];
    });

    // Add main table
    autoTable(doc, {
      startY: yPos + 30,
      head: [['Bill No', 'Builte No', 'Date', 'Customer', 'Payment', 'Total', 'Items (Qty: Unit Price in PKR)']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
      styles: { fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 20 },
        2: { cellWidth: 30 },
        3: { cellWidth: 30 },
        4: { cellWidth: 20 },
        5: { cellWidth: 15 },
        6: { cellWidth: 40, cellPadding: 2 }
      }
    });

    // Save the PDF
    doc.save(`sales_report_${months[selectedMonth]}_${selectedYear}.pdf`);
  };

  const handleDelete = async (saleId) => {
    if (!window.confirm('Are you sure you want to delete this sale? This action cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, 'receipts', saleId));
      fetchSales();
    } catch (error) {
      alert('Error deleting sale: ' + error.message);
    }
  };

  const handleEdit = (sale) => {
    setEditSale(sale);
    setShowEditModal(true);
  };

  const handleEditSave = async (updatedSale) => {
    try {
      const saleDoc = doc(db, 'receipts', updatedSale.id);
      await updateDoc(saleDoc, {
        customerName: updatedSale.customerName,
        customerPhone: updatedSale.customerPhone,
        items: updatedSale.items,
        totalAmount: updatedSale.totalAmount,
        paidAmount: updatedSale.paidAmount,
        remainingAmount: updatedSale.remainingAmount,
        date: updatedSale.date,
        paymentMethod: updatedSale.paymentMethod,
        chequeNumber: updatedSale.chequeNumber || '',
        comment: updatedSale.comment || '',
        discount: updatedSale.discount || 0,
        discountAmount: updatedSale.discountAmount || 0,
        subtotal: updatedSale.subtotal || 0,
        isDebt: updatedSale.isDebt || false,
        billNumber: updatedSale.billNumber,
        builteNo: updatedSale.builteNo || ''
      });
      setShowEditModal(false);
      setEditSale(null);
      fetchSales();
    } catch (error) {
      alert('Error updating sale: ' + error.message);
    }
  };

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
        <h2 className="text-2xl font-semibold text-gray-800">Sales History</h2>
        <div className="flex items-center space-x-4">
          <button
            onClick={handleDownloadReport}
            className="text-green-600 hover:text-green-800 p-2 rounded-full hover:bg-green-50"
            title="Download Monthly Report"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            {months.map((month, index) => (
              <option key={month} value={index}>{month}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
          <input
            type="text"
            placeholder="Search by product"
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
          <input
            type="text"
            placeholder="Search by customer"
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            value={showOnlyDebt ? 'debt' : 'all'}
            onChange={(e) => setShowOnlyDebt(e.target.value === 'debt')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Sales</option>
            <option value="debt">Only Debt</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 bg-gray-50 border-b">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">
              Showing {filteredSales.length} sales for {months[selectedMonth]} {selectedYear}
              {productFilter && `, containing product "${productFilter}"`}
              {customerFilter && `, for customer "${customerFilter}"`}
            </span>
            <div className="flex flex-col items-end">
              <span className="text-sm font-medium text-gray-900">
                Monthly Total: Rs {Math.round(calculateMonthlyTotal())}
              </span>
              <span className="text-sm font-medium text-red-600">
                Monthly Debt: Rs {Math.round(calculateMonthlyDebt())}
              </span>
            </div>
          </div>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Bill No</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Builte No</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Customer</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Payment</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Total (PKR)</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredSales.map((sale) => (
              <tr key={sale.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">{sale.billNumber || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">{sale.builteNo || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                  {formatDate(sale.date)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                  {sale.customerName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                  {sale.paymentMethod}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                  {Math.round(sale.totalAmount) || '0'}
                  {sale.discount > 0 && (
                    <span className="text-xs text-red-600 ml-1">
                      (-{sale.discount}%)
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-center space-x-2">
                  <button
                    onClick={() => handlePrint(sale)}
                    className="text-blue-600 hover:text-blue-800"
                    title="Print Receipt"
                  >
                    <svg className="w-5 h-5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleViewDetails(sale)}
                    className="text-purple-600 hover:text-purple-800 ml-2"
                    title="View Details"
                  >
                    <svg className="w-5 h-5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleEdit(sale)}
                    className="text-yellow-600 hover:text-yellow-800 ml-2"
                    title="Edit Sale"
                  >
                    <svg className="w-5 h-5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6-6m2 2l-6 6m-2 2h6" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(sale.id)}
                    className="text-red-600 hover:text-red-800 ml-2"
                    title="Delete Sale"
                  >
                    <svg className="w-5 h-5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Payment History Modal */}
      {showPaymentHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Sale Details</h3>
                <p className="text-sm text-gray-500 mt-1">Customer: {selectedSale?.customerName}</p>
                <p className="text-sm text-gray-500">Phone: {selectedSale?.customerPhone || '-'}</p>
                <p className="text-sm text-gray-500">Date: {formatDate(selectedSale?.date)}</p>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => handlePrint(selectedSale)}
                  className="text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-50"
                  title="Print Details"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                </button>
                <button
                  onClick={() => setShowPaymentHistory(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="space-y-6">
              {/* Items Section */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Items</h4>
                <table className="w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="w-2/5 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                      <th className="w-1/5 px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                      <th className="w-1/5 px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Price (PKR)</th>
                      <th className="w-1/5 px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total (PKR)</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {selectedSale?.items.map((item, index) => {
                      const price = item.unitPrice || item.price || 0;
                      const quantity = item.quantity || 0;
                      const total = price * quantity;
                      return (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-sm text-gray-900">{item.name || '-'}</td>
                          <td className="px-3 py-2 text-sm text-gray-500 text-right">{quantity}</td>
                          <td className="px-3 py-2 text-sm text-gray-500 text-right">{Math.round(price)}</td>
                          <td className="px-3 py-2 text-sm text-gray-900 text-right">{Math.round(total)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-100">
                    <tr>
                      <td colSpan="3" className="px-3 py-2 text-right text-sm font-medium text-gray-900">Subtotal:</td>
                      <td className="px-3 py-2 text-right text-sm font-medium text-gray-900">
                        {Math.round(selectedSale?.totalAmount + (selectedSale?.discountAmount || 0))}
                      </td>
                    </tr>
                    {selectedSale?.discount > 0 && (
                      <tr>
                        <td colSpan="3" className="px-3 py-2 text-right text-sm font-medium text-red-600">
                          Discount ({selectedSale.discount}%):
                        </td>
                        <td className="px-3 py-2 text-right text-sm font-medium text-red-600">
                          -{Math.round(selectedSale.discountAmount)}
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td colSpan="3" className="px-3 py-2 text-right text-sm font-medium text-gray-900">Total Amount:</td>
                      <td className="px-3 py-2 text-right text-sm font-medium text-gray-900">
                        {Math.round(selectedSale?.totalAmount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Payment History Section */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Payment History</h4>
                {paymentHistory.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">
                    No payment history found for this sale.
                  </div>
                ) : (
                  <table className="w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="w-1/5 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="w-1/5 px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount (PKR)</th>
                        <th className="w-1/5 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                        <th className="w-1/5 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                        <th className="w-1/5 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {paymentHistory.map((payment) => (
                        <tr key={payment.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-sm text-gray-500">
                            {formatDate(payment.date)}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900 text-right">
                            {Math.round(payment.amount) || '0'}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-500">
                            {payment.paymentMethod}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-500">
                            {payment.chequeNumber ? `Cheque #${payment.chequeNumber}` : payment.comment || '-'}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-500">
                            {payment.type}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditModal && editSale && (
        <EditSaleModal sale={editSale} onSave={handleEditSave} onClose={() => setShowEditModal(false)} />
      )}
    </div>
  );
}

export default SalesTable; 