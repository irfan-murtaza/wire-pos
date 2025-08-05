import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, where, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { generatePrintableHTML } from './PrintableReceipt';
import jsPDF from 'jspdf';
import { generateUniqueCustomerId } from './utils';
import { migrateExistingCustomerIds } from './migrateCustomerIds';

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
  const [onlinePaymentDetails, setOnlinePaymentDetails] = useState('');
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
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [showEditCustomerModal, setShowEditCustomerModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [editCustomerData, setEditCustomerData] = useState({ name: '', phone: '' });
  const [editCustomerErrors, setEditCustomerErrors] = useState({});
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [deletingCustomer, setDeletingCustomer] = useState(null);
  const [showSearchByCustomerIdModal, setShowSearchByCustomerIdModal] = useState(false);
  const [customerIdSearch, setCustomerIdSearch] = useState('');
  const [searchedCustomer, setSearchedCustomer] = useState(null);
  const [searchedCustomerBills, setSearchedCustomerBills] = useState([]);
  const [searchCustomerLoading, setSearchCustomerLoading] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrationCompleted, setMigrationCompleted] = useState(false);
  const [showRemainingBalance, setShowRemainingBalance] = useState(true);

  useEffect(() => {
    fetchCustomerData();
  }, []);

  // Check if migration has been completed by looking for customer IDs
  useEffect(() => {
    const checkMigrationStatus = () => {
      // Check if any customers are missing customer IDs or have long IDs that need migration
      const hasCustomersNeedingMigration = Object.values(customers).some(customer => {
        // Customers without IDs need migration
        if (!customer.customerId) return true;
        // Customers with long IDs (CUST-...) need migration
        if (customer.customerId && customer.customerId.startsWith('CUST-')) return true;
        // Customers with long cus- IDs (like cus-1753710032884) need migration
        if (customer.customerId && customer.customerId.startsWith('cus-') && customer.customerId.length > 10) return true;
        // Customers with phone numbers as IDs need migration
        if (customer.customerId && customer.customerId === customer.phone) return true;
        return false;
      });
      
      console.log('Migration status check:', {
        totalCustomers: Object.keys(customers).length,
        customersNeedingMigration: Object.values(customers).filter(customer => {
          if (!customer.customerId) return true;
          if (customer.customerId && customer.customerId.startsWith('CUST-')) return true;
          if (customer.customerId && customer.customerId.startsWith('cus-') && customer.customerId.length > 10) return true;
          if (customer.customerId && customer.customerId === customer.phone) return true;
          return false;
        }).length,
        hasCustomersNeedingMigration,
        migrationCompleted: !hasCustomersNeedingMigration && Object.keys(customers).length > 0
      });
      
      if (!hasCustomersNeedingMigration && Object.keys(customers).length > 0) {
        setMigrationCompleted(true);
      } else {
        setMigrationCompleted(false);
      }
    };
    
    if (!loading && Object.keys(customers).length > 0) {
      checkMigrationStatus();
    }
  }, [customers, loading]);

  const fetchCustomerData = async () => {
    try {
      console.log('Fetching customer data...');
      const salesQuery = query(collection(db, 'receipts'), orderBy('date', 'desc'));
      const querySnapshot = await getDocs(salesQuery);
      const salesList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log('Raw sales data:', salesList);

      // Debug: Log first few sales to understand structure
      console.log('=== SALES DATA STRUCTURE DEBUG ===');
      salesList.slice(0, 3).forEach((sale, index) => {
        console.log(`Sale ${index + 1}:`, {
          id: sale.id,
          customerName: sale.customerName,
          customerPhone: sale.customerPhone,
          totalAmount: sale.totalAmount,
          paidAmount: sale.paidAmount,
          remainingAmount: sale.remainingAmount,
          items: sale.items,
          date: sale.date,
          paymentMethod: sale.paymentMethod,
          fullSale: sale
        });
      });
      console.log('=== END SALES STRUCTURE DEBUG ===');

      // Group sales by customer
      const customerData = {};
      salesList.forEach(sale => {
        const customerKey = sale.customerPhone;
        
        // Skip sales without customer phone
        if (!customerKey || customerKey.trim() === '') {
          console.log('Skipping sale without customerPhone:', sale);
          return;
        }
        
        const cleanName = sale.customerName ? sale.customerName.trim() : '';
        
        if (!customerData[customerKey]) {
          customerData[customerKey] = {
            names: cleanName ? [cleanName] : [],
            phone: sale.customerPhone,
            customerId: sale.customerId || null, // Add customer ID
            totalAmount: sale.totalAmount || 0,
            paidAmount: sale.paidAmount || 0,
            remainingAmount: sale.remainingAmount || 0,
            sales: [sale],
            items: {}
          };
          
          // Process items if they exist
          if (sale.items && Array.isArray(sale.items)) {
            sale.items.forEach(item => {
              const itemKey = item.name;
              customerData[customerKey].items[itemKey] = {
                name: item.name,
                totalQuantity: item.quantity || 0,
                totalValue: (item.quantity || 0) * (item.price || 0)
              };
            });
          }
        } else {
          // Add name if not already present (case-insensitive, trimmed)
          if (cleanName && !customerData[customerKey].names.some(n => n.trim().toLowerCase() === cleanName.toLowerCase())) {
            customerData[customerKey].names.push(cleanName);
          }
          
          customerData[customerKey].totalAmount += sale.totalAmount || 0;
          customerData[customerKey].paidAmount += sale.paidAmount || 0;
          customerData[customerKey].remainingAmount += sale.remainingAmount || 0;
          customerData[customerKey].sales.push(sale);
          
          // Process items if they exist
          if (sale.items && Array.isArray(sale.items)) {
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
        }
      });

      console.log('Processed customer data:', customerData);
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
    // Check for same year and month (not specific day)
    return (
      selected.getFullYear() === saleDate.getFullYear() &&
      selected.getMonth() === saleDate.getMonth()
    );
  };

  // New print handler to use modal values
  const handlePrintWithDebt = () => {
    if (!printCustomer) return;
    const customer = printCustomer;
    const customerName = (customer.names && customer.names[0]) || customer.name || customer.phone || '-';
    let items = [];
    
    // Get the selected date and create a date range for the month
    const selectedDate = new Date(printDate);
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0);
    
    customer.sales.forEach(sale => {
      const saleDate = new Date(sale.date);
      // Check if sale is in the selected month
      if (saleDate >= startOfMonth && saleDate <= endOfMonth) {
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
    
    // Calculate paid amount for the selected month
    const paidAmountForSelectedMonth = customer.sales
      .filter(sale => {
        const saleDate = new Date(sale.date);
        return sale.paidAmount && sale.paidAmount > 0 && 
               sale.paymentMethod !== 'Manual Debt' && 
               saleDate >= startOfMonth && saleDate <= endOfMonth;
      })
      .reduce((sum, sale) => sum + sale.paidAmount, 0);
    
    // Calculate remaining amount for the receipt
    const remainingAmount = totalAmount - paidAmountForSelectedMonth;
    
    // Get payment history for the selected month
    const paymentHistory = customer.sales
      .filter(sale => {
        const saleDate = new Date(sale.date);
        return sale.paidAmount && sale.paidAmount > 0 && 
               sale.paymentMethod !== 'Manual Debt' && 
               saleDate >= startOfMonth && saleDate <= endOfMonth;
      })
      .map(sale => ({
        date: sale.date,
        amount: sale.paidAmount,
        paymentMethod: sale.paymentMethod,
        chequeNumber: sale.chequeNumber,
        comment: sale.comment,
        type: sale.paymentMethod || 'Sale'
      }));
    
    console.log('handlePrintWithDebt Debug:', {
      customerName,
      customerPhone: customer.phone,
      customerId: customer.customerId || customer.phone,
      totalAmount,
      paidAmountForSelectedMonth,
      remainingAmount,
      showRemainingBalance
    });
    
    const html = generatePrintableHTML({
      customerName,
      customerPhone: customer.phone,
      customerId: customer.customerId || customer.phone,
      items,
      totalAmount,
      paidAmount: paidAmountForSelectedMonth,
      remainingAmount,
      date: `${new Date(printDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} Report`,
      isCustomerReport: true,
      subtotal: totalAmount,
      paymentMethod: 'Customer Report',
      paymentHistory,
      billNumber: '',
      builteNo: '',
      previousRemaining: 0,
      showRemainingBalance
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
    // Calculate paid amount for the selected month
    const paidAmountForSelectedMonth = customer.sales
      .filter(sale => sale.paidAmount && sale.paidAmount > 0 && sale.paymentMethod !== 'Manual Debt' && isPrintDate(sale.date))
      .reduce((sum, sale) => sum + sale.paidAmount, 0);
    // Calculate remaining amount for the receipt
    const remainingAmount = totalAmount - paidAmountForSelectedMonth;
    
    // Get payment history for the selected month
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
    
    console.log('handlePrint Debug:', {
      customerName,
      customerPhone: customer.phone,
      customerId: customer.customerId || customer.phone,
      totalAmount,
      paidAmountForSelectedMonth,
      remainingAmount,
      showRemainingBalance
    });
    
    const html = generatePrintableHTML({
      customerName,
      customerPhone: customer.phone,
      customerId: customer.customerId || customer.phone,
      items,
      totalAmount,
      paidAmount: paidAmountForSelectedMonth,
      remainingAmount,
      date: `${new Date(printDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} Report`,
      isCustomerReport: true,
      subtotal: totalAmount,
      paymentMethod: 'Customer Report',
      paymentHistory,
      billNumber: '',
      builteNo: '',
      previousRemaining: 0,
      showRemainingBalance
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

  const handleViewDetails = async (customer) => {
    try {
      // Fetch payment history for this customer from paymentHistory collection
      const paymentQuery = query(
        collection(db, 'paymentHistory'),
        where('customerPhone', '==', customer.phone),
        orderBy('date', 'desc')
      );
      const paymentSnapshot = await getDocs(paymentQuery);
      const paymentHistory = paymentSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Extract payment information from sales records
      const salesPayments = customer.sales
        .filter(sale => sale.paidAmount && sale.paidAmount > 0) // Only sales with payments
        .map(sale => ({
          id: `sale_${sale.id}`,
          date: sale.date,
          amount: sale.paidAmount,
          paymentMethod: sale.paymentMethod || 'Cash',
          chequeNumber: sale.chequeNumber || '',
          comment: sale.comment || '',
          type: 'Sale Payment',
          fromSale: true
        }));
      
      // Combine both payment sources and sort by date (newest first)
      const allPayments = [...paymentHistory, ...salesPayments]
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      
      setPaymentHistory(allPayments);
      setSelectedCustomer(customer);
      setShowDetails(true);
    } catch (error) {
      console.error('Error fetching payment history:', error);
      // Still show details even if payment history fails to load
      setPaymentHistory([]);
      setSelectedCustomer(customer);
      setShowDetails(true);
    }
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
    if (paymentMethod === 'Online Payment' && !onlinePaymentDetails.trim()) {
      newErrors.onlinePaymentDetails = 'Online payment details are required';
    }
    setPaymentErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    try {
      // Add payment record to paymentHistory
      await addDoc(collection(db, 'paymentHistory'), {
        customerPhone: paymentCustomer.phone,
        customerId: paymentCustomer.customerId || paymentCustomer.phone,
        amount: amount,
        paymentMethod,
        comment: paymentMethod === 'Other' ? paymentComment : '',
        chequeNumber: paymentMethod === 'Cheque' ? chequeNumber : '',
        onlinePaymentDetails: paymentMethod === 'Online Payment' ? onlinePaymentDetails : '',
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
          customerId: paymentCustomer.customerId || paymentCustomer.phone,
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
    console.log('handlePrintSale Debug:', {
      customerName: (customer.names && customer.names[0]) || customer.name || '-',
      customerPhone: customer.phone,
      customerId: customer.customerId || customer.phone,
      totalAmount: sale.totalAmount,
      paidAmount: sale.paidAmount || 0,
      remainingAmount: sale.remainingAmount || 0,
      date: sale.date,
      showRemainingBalance
    });
    
    const html = generatePrintableHTML({
      customerName: (customer.names && customer.names[0]) || customer.name || '-',
      customerPhone: customer.phone,
      customerId: customer.customerId || customer.phone,
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
      billNumber: sale.billNumber || '',
      builteNo: sale.builteNo || '',
      previousRemaining: 0,
      showRemainingBalance
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

  const filteredCustomers = Object.values(customers).filter(customer => {
    if (!searchTerm) return true; // Show all customers when no search term
    
    const nameMatch = customer.names?.some(name => 
      name.toLowerCase().includes(searchTerm.toLowerCase())
    ) || false;
    
    const phoneMatch = customer.phone?.includes(searchTerm) || false;
    
    return nameMatch || phoneMatch;
  });

  // Enhanced debugging
  useEffect(() => {
    console.log('=== CUSTOMER DATA DEBUG ===');
    console.log('Search term:', searchTerm);
    console.log('Total customers in state:', Object.keys(customers).length);
    console.log('Customers object keys:', Object.keys(customers));
    console.log('Filtered customers count:', filteredCustomers.length);
    
    // Log first customer details if available
    if (filteredCustomers.length > 0) {
      const firstCustomer = filteredCustomers[0];
      console.log('First customer DETAILED:', {
        names: firstCustomer.names,
        phone: firstCustomer.phone,
        totalAmount: firstCustomer.totalAmount,
        paidAmount: firstCustomer.paidAmount,
        remainingAmount: firstCustomer.remainingAmount,
        salesCount: firstCustomer.sales?.length,
        fullCustomerObject: firstCustomer
      });
      
      // Log the first sale for this customer to understand structure
      if (firstCustomer.sales && firstCustomer.sales.length > 0) {
        console.log('First sale for first customer:', firstCustomer.sales[0]);
      }
    }
    
    // Log all customers briefly
    console.log('All customers summary:');
    Object.entries(customers).forEach(([key, customer], index) => {
      console.log(`Customer ${index + 1} (${key}):`, {
        names: customer.names,
        phone: customer.phone,
        total: customer.totalAmount,
        paid: customer.paidAmount,
        remaining: customer.remainingAmount,
        salesCount: customer.sales?.length
      });
    });
    
    console.log('=== END DEBUG ===');
  }, [searchTerm, filteredCustomers, customers]);

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    const errors = {};
    
    if (!newCustomer.name.trim()) {
      errors.name = 'Customer name is required';
    }
    if (!newCustomer.phone.trim()) {
      errors.phone = 'Phone number is required';
    }
    if (newCustomer.pendingAmount && isNaN(Number(newCustomer.pendingAmount))) {
      errors.pendingAmount = 'Please enter a valid amount';
    }
    if (newCustomer.pendingAmount && !newCustomerReason.trim()) {
      errors.reason = 'Reason is required when adding pending amount';
    }
    
    setAddCustomerErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      // Generate a unique, readable customer ID
      const customerId = await generateUniqueCustomerId(db);
      
      // Add new customer as a receipt with the pending amount if provided
      const receiptData = {
        customerName: newCustomer.name.trim(),
        customerPhone: newCustomer.phone.trim(),
        customerId: customerId, // Use generated unique ID
        totalAmount: Number(newCustomer.pendingAmount) || 0,
        paidAmount: 0,
        remainingAmount: Number(newCustomer.pendingAmount) || 0,
        date: new Date().toISOString(),
        paymentMethod: newCustomer.pendingAmount ? 'Manual Debt' : 'Cash',
        comment: newCustomerReason.trim() || 'New customer added',
        items: [],
        isDebt: Number(newCustomer.pendingAmount) > 0
      };

      await addDoc(collection(db, 'receipts'), receiptData);
      
      // Reset form and close modal
      setNewCustomer({ name: '', phone: '', pendingAmount: '' });
      setNewCustomerReason('');
      setAddCustomerErrors({});
      setShowAddCustomerModal(false);
      
      // Refresh customer data
      fetchCustomerData();
    } catch (error) {
      console.error('Error adding customer:', error);
      alert('Error adding customer: ' + error.message);
    }
  };

  const handleEditCustomer = async (e) => {
    e.preventDefault();
    const errors = {};
    
    if (!editCustomerData.name.trim()) {
      errors.name = 'Customer name is required';
    }
    if (!editCustomerData.phone.trim()) {
      errors.phone = 'Phone number is required';
    }
    
    setEditCustomerErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      // Update all sales records for this customer with the new information
      const salesToUpdate = editingCustomer.sales;
      
      for (const sale of salesToUpdate) {
        const saleDoc = doc(db, 'receipts', sale.id);
        await updateDoc(saleDoc, {
          customerName: editCustomerData.name.trim(),
          customerPhone: editCustomerData.phone.trim(),
          customerId: editingCustomer.customerId || editingCustomer.phone // Preserve existing customer ID
        });
      }
      
      // Reset form and close modal
      setEditCustomerData({ name: '', phone: '' });
      setEditCustomerErrors({});
      setShowEditCustomerModal(false);
      setEditingCustomer(null);
      
      // Refresh customer data
      fetchCustomerData();
    } catch (error) {
      console.error('Error updating customer:', error);
      alert('Error updating customer: ' + error.message);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!deletingCustomer) return;

    try {
      // Delete all sales records for this customer
      const salesToDelete = deletingCustomer.sales;
      
      for (const sale of salesToDelete) {
        const saleDoc = doc(db, 'receipts', sale.id);
        await deleteDoc(saleDoc);
      }
      
      // Close modal and reset state
      setShowDeleteConfirmModal(false);
      setDeletingCustomer(null);
      
      // Refresh customer data
      fetchCustomerData();
    } catch (error) {
      console.error('Error deleting customer:', error);
      alert('Error deleting customer: ' + error.message);
    }
  };

  // Download customer details as PDF file
  const handleDownloadCustomerDetails = async (customer) => {
    try {
      const customerName = (customer.names && customer.names[0]) || customer.phone || 'Unknown';
      
      // Fetch payment history for this customer
      const paymentQuery = query(
        collection(db, 'paymentHistory'),
        where('customerPhone', '==', customer.phone),
        orderBy('date', 'desc')
      );
      const paymentSnapshot = await getDocs(paymentQuery);
      const paymentHistory = paymentSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Extract payment information from sales records
      const salesPayments = customer.sales
        .filter(sale => sale.paidAmount && sale.paidAmount > 0) // Only sales with payments
        .map(sale => ({
          id: `sale_${sale.id}`,
          date: sale.date,
          amount: sale.paidAmount,
          paymentMethod: sale.paymentMethod || 'Cash',
          chequeNumber: sale.chequeNumber || '',
          comment: sale.comment || '',
          type: 'Sale Payment',
          fromSale: true
        }));
      
      // Combine both payment sources and sort by date (newest first)
      const allPayments = [...paymentHistory, ...salesPayments]
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      
      // Create new PDF document
      const doc = new jsPDF();
      
      // Set font and add title
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('CUSTOMER DETAILS REPORT', 20, 20);
      
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
      doc.text(`Total Amount: Rs ${Math.round(customer.totalAmount).toLocaleString()}`, 20, yPosition);
      yPosition += 8;
      doc.text(`Paid Amount: Rs ${Math.round(customer.paidAmount).toLocaleString()}`, 20, yPosition);
      yPosition += 8;
      doc.text(`Remaining Amount: Rs ${Math.round(customer.remainingAmount).toLocaleString()}`, 20, yPosition);
      yPosition += 20;
      
      // Payment History Section
      if (allPayments.length > 0) {
        if (yPosition > 250) {
          doc.addPage();
          yPosition = 20;
        }
        
        doc.setFont('helvetica', 'bold');
        doc.text('Payment History:', 20, yPosition);
        yPosition += 10;
        
        doc.setFont('helvetica', 'normal');
        allPayments.forEach((payment, index) => {
          if (yPosition > 270) {
            doc.addPage();
            yPosition = 20;
          }
          
          doc.text(`${index + 1}. Date: ${new Date(payment.date).toLocaleDateString()} ${new Date(payment.date).toLocaleTimeString()}`, 20, yPosition);
          yPosition += 6;
          doc.text(`   Amount Paid: Rs ${Math.round(payment.amount).toLocaleString()}`, 20, yPosition);
          yPosition += 6;
          doc.text(`   Payment Method: ${payment.paymentMethod || 'N/A'}`, 20, yPosition);
          yPosition += 6;
          if (payment.chequeNumber) {
            doc.text(`   Cheque Number: ${payment.chequeNumber}`, 20, yPosition);
            yPosition += 6;
          }
          if (payment.onlinePaymentDetails) {
            doc.text(`   Online Payment Details: ${payment.onlinePaymentDetails}`, 20, yPosition);
            yPosition += 6;
          }
          if (payment.comment) {
            doc.text(`   Comment: ${payment.comment}`, 20, yPosition);
            yPosition += 6;
          }
          doc.text(`   Type: ${payment.type || 'Payment'}`, 20, yPosition);
          yPosition += 10;
        });
        yPosition += 10;
      }
      
      // Purchase History
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }
      
      doc.setFont('helvetica', 'bold');
      doc.text('Purchase History:', 20, yPosition);
      yPosition += 10;
      
      doc.setFont('helvetica', 'normal');
      customer.sales.forEach((sale, index) => {
        if (yPosition > 270) { // Check if we need a new page
          doc.addPage();
          yPosition = 20;
        }
        
        doc.text(`${index + 1}. Date: ${new Date(sale.date).toLocaleDateString()}`, 20, yPosition);
        yPosition += 6;
        doc.text(`   Total: Rs ${Math.round(sale.totalAmount).toLocaleString()}`, 20, yPosition);
        yPosition += 6;
        doc.text(`   Paid: Rs ${Math.round(sale.paidAmount || 0).toLocaleString()}`, 20, yPosition);
        yPosition += 6;
        doc.text(`   Remaining: Rs ${Math.round(sale.remainingAmount || 0).toLocaleString()}`, 20, yPosition);
        yPosition += 6;
        doc.text(`   Payment Method: ${sale.paymentMethod || 'N/A'}`, 20, yPosition);
        yPosition += 6;
        
        if (sale.chequeNumber) {
          doc.text(`   Cheque Number: ${sale.chequeNumber}`, 20, yPosition);
          yPosition += 6;
        }
        if (sale.comment) {
          doc.text(`   Comment: ${sale.comment}`, 20, yPosition);
          yPosition += 6;
        }
        
        if (sale.items && Array.isArray(sale.items) && sale.items.length > 0) {
          doc.text('   Items:', 20, yPosition);
          yPosition += 6;
          sale.items.forEach(item => {
            if (yPosition > 270) { // Check if we need a new page
              doc.addPage();
              yPosition = 20;
            }
            doc.text(`   - ${item.name}: ${item.quantity} x Rs ${Math.round(item.price).toLocaleString()} = Rs ${Math.round(item.quantity * item.price).toLocaleString()}`, 25, yPosition);
            yPosition += 6;
          });
        }
        yPosition += 8; // Extra space between sales
      });
      
      // Product Summary
      if (Object.keys(customer.items).length > 0) {
        if (yPosition > 250) { // Check if we need a new page
          doc.addPage();
          yPosition = 20;
        }
        
        yPosition += 10;
        doc.setFont('helvetica', 'bold');
        doc.text('Product Summary:', 20, yPosition);
        yPosition += 10;
        
        doc.setFont('helvetica', 'normal');
        Object.values(customer.items).forEach(item => {
          if (yPosition > 270) { // Check if we need a new page
            doc.addPage();
            yPosition = 20;
          }
          doc.text(`${item.name}: ${item.totalQuantity} units, Total Value: Rs ${Math.round(item.totalValue).toLocaleString()}`, 20, yPosition);
          yPosition += 8;
        });
      }
      
      // Save the PDF
      const fileName = `customer_${customerName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    }
  };

  const handleSearchByCustomerId = async () => {
    if (!customerIdSearch.trim()) {
      alert('Please enter a customer ID');
      return;
    }

    setSearchCustomerLoading(true);
    try {
      // First search by customer ID in existing data
      const customerByPhone = customers[customerIdSearch.trim()];
      const customerById = Object.values(customers).find(c => c.customerId === customerIdSearch.trim());
      
      if (customerByPhone || customerById) {
        const customer = customerByPhone || customerById;
        setSearchedCustomer(customer);
        setSearchedCustomerBills(customer.sales);
      } else {
        // Search in Firestore by customer ID
        const receiptsQuery = query(
          collection(db, 'receipts'), 
          where('customerId', '==', customerIdSearch.trim()),
          orderBy('date', 'desc')
        );
        const querySnapshot = await getDocs(receiptsQuery);
        if (!querySnapshot.empty) {
          const bills = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          const customerFromBills = {
            names: [...new Set(bills.map(bill => bill.customerName).filter(Boolean))],
            phone: bills[0].customerPhone,
            customerId: bills[0].customerId,
            totalAmount: bills.reduce((sum, bill) => sum + (bill.totalAmount || 0), 0),
            paidAmount: bills.reduce((sum, bill) => sum + (bill.paidAmount || 0), 0),
            remainingAmount: bills.reduce((sum, bill) => sum + (bill.remainingAmount || 0), 0),
            sales: bills
          };
          setSearchedCustomer(customerFromBills);
          setSearchedCustomerBills(bills);
        } else {
          // If not found by customer ID, try searching by phone number as fallback
          const phoneQuery = query(
            collection(db, 'receipts'), 
            where('customerPhone', '==', customerIdSearch.trim()),
            orderBy('date', 'desc')
          );
          const phoneSnapshot = await getDocs(phoneQuery);
          if (!phoneSnapshot.empty) {
            const bills = phoneSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const customerFromBills = {
              names: [...new Set(bills.map(bill => bill.customerName).filter(Boolean))],
              phone: customerIdSearch.trim(),
              customerId: bills[0].customerId,
              totalAmount: bills.reduce((sum, bill) => sum + (bill.totalAmount || 0), 0),
              paidAmount: bills.reduce((sum, bill) => sum + (bill.paidAmount || 0), 0),
              remainingAmount: bills.reduce((sum, bill) => sum + (bill.remainingAmount || 0), 0),
              sales: bills
            };
            setSearchedCustomer(customerFromBills);
            setSearchedCustomerBills(bills);
          } else {
            setSearchedCustomer(null);
            setSearchedCustomerBills([]);
            alert('No customer found with this ID');
          }
        }
      }
    } catch (error) {
      console.error('Error searching by customer ID:', error);
      alert('Error searching for customer: ' + error.message);
    } finally {
      setSearchCustomerLoading(false);
    }
  };

  const handleMigrateCustomerIds = async () => {
    if (!window.confirm('This will add unique customer IDs to all existing receipts. This process may take a few minutes. Continue?')) {
      return;
    }
    
    setMigrating(true);
    try {
      await migrateExistingCustomerIds();
      alert('Customer ID migration completed successfully!');
      setMigrationCompleted(true);
      // Refresh the customer data to show the new customer IDs
      await fetchCustomerData();
    } catch (error) {
      console.error('Migration failed:', error);
      alert('Migration failed: ' + error.message);
    } finally {
      setMigrating(false);
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
        <h2 className="text-2xl font-semibold text-gray-800">Customer Management</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddCustomerModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md shadow-sm transition-all"
          >
            Add Customer
          </button>
          <button
            onClick={() => setShowSearchByCustomerIdModal(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md shadow-sm transition-all"
          >
            Search by Customer ID
          </button>
          {/* {!migrationCompleted && (
            <button
              onClick={handleMigrateCustomerIds}
              disabled={migrating}
              className={`px-4 py-2 rounded-md shadow-sm transition-all ${
                migrating 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-orange-600 hover:bg-orange-700 text-white'
              }`}
            >
              {migrating ? 'Migrating...' : 'Migrate Customer IDs'}
            </button>
          )}
          {migrationCompleted && (
            <div className="px-4 py-2 bg-green-100 text-green-800 rounded-md text-sm">
              ✓ Customer IDs migrated
            </div>
          )} */}
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
        {/* Add horizontal scrolling container */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Customer ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48 max-w-48">Names</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Phone</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Total (PKR)</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Paid (PKR)</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Remaining (PKR)</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-48">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-4 text-center text-gray-500">
                    {Object.keys(customers).length === 0 
                      ? 'No customers found. Add your first customer or check if data is loading properly.'
                      : 'No customers match your search criteria.'}
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer, index) => {
                  return (
                    <tr key={index} className={`hover:bg-gray-50 ${customer.remainingAmount > 0 ? 'bg-red-50' : customer.remainingAmount < 0 ? 'bg-green-50' : ''}`}>
                                          <td className="px-4 py-4 w-32">
                      <div className="text-xs text-gray-700 font-mono">{customer.customerId || customer.phone}</div>
                    </td>
                      <td className="px-4 py-4 w-48 max-w-48">
                        <div className="text-sm text-gray-900 font-medium break-words">{customer.names?.join(', ') || 'N/A'}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap w-32">
                        <div className="text-sm font-medium text-gray-900">{customer.phone || 'N/A'}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium w-32">
                        Rs {customer.totalAmount !== undefined ? Math.round(customer.totalAmount).toLocaleString() : '0'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium w-32">
                        Rs {customer.paidAmount !== undefined ? Math.round(customer.paidAmount).toLocaleString() : '0'}
                      </td>
                      <td className={`px-4 py-4 whitespace-nowrap text-sm text-right font-medium w-32 ${customer.remainingAmount > 0 ? 'text-red-600' : customer.remainingAmount < 0 ? 'text-green-600' : 'text-gray-900'}`}> 
                        {customer.remainingAmount !== undefined && customer.remainingAmount !== 0 ? `Rs ${Math.round(customer.remainingAmount).toLocaleString()}` : '-'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-center space-x-1 w-48">
                        {/* Download Button */}
                        <button
                          onClick={() => handleDownloadCustomerDetails(customer)}
                          className="text-blue-600 hover:text-blue-800 p-1 rounded"
                          title="Download Customer Details as PDF"
                        >
                          <svg className="w-5 h-5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </button>
                        
                        {/* Print Button for Monthly Data */}
                        <button
                          onClick={() => {
                            // Close all other modals first
                            setShowDetails(false);
                            setShowSaleDetails(false);
                            setShowPaymentModal(false);
                            setShowAddCustomerModal(false);
                            setShowAddPendingModal(false);
                            
                            // Reset states
                            setSelectedCustomer(null);
                            setSelectedSale(null);
                            setPaymentCustomer(null);
                            setPendingCustomer(null);
                            
                            // Open print modal
                            setPrintCustomer(customer);
                            setPrintDate(new Date().toISOString().split('T')[0]);
                            setPreviousDayDebt(0);
                            setShowPrintModal(true);
                          }}
                          className="text-gray-600 hover:text-gray-800 p-1 rounded"
                          title="Print Monthly Customer Report"
                        >
                          <svg className="w-5 h-5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                          </svg>
                        </button>
                        
                        {/* View Details Button */}
                        <button
                          onClick={() => handleViewDetails(customer)}
                          className="text-purple-600 hover:text-purple-800 p-1 rounded"
                          title="View Details"
                        >
                          <svg className="w-5 h-5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        
                        {/* Add Payment Button */}
                        <button
                          onClick={() => handleAddPaymentClick(customer)}
                          className="text-green-600 hover:text-green-800 p-1 rounded"
                          title="Add Payment (Reduces Remaining Amount)"
                        >
                          <svg className="w-5 h-5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                        
                        {/* Add Pending Payment Button */}
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
                          className="text-orange-600 hover:text-orange-800 p-1 rounded"
                          title="Add Pending Payment (Increases Remaining Amount)"
                        >
                          <svg className="w-5 h-5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                        
                        {/* Edit Customer Button */}
                        <button
                          onClick={() => {
                            // Close all modals first
                            setShowDetails(false);
                            setShowSaleDetails(false);
                            setShowPaymentModal(false);
                            setShowAddCustomerModal(false);
                            setShowPrintModal(false);
                            setShowAddPendingModal(false);
                            
                            // Reset all modal-related states
                            setSelectedCustomer(null);
                            setSelectedSale(null);
                            setPrintCustomer(null);
                            setPaymentCustomer(null);
                            setPendingCustomer(null);
                            
                            // Then open edit modal
                            setEditingCustomer(customer);
                            setEditCustomerData({
                              name: customer.names?.[0] || '',
                              phone: customer.phone || ''
                            });
                            setEditCustomerErrors({});
                            setShowEditCustomerModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-800 p-1 rounded"
                          title="Edit Customer Information"
                        >
                          <svg className="w-5 h-5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        
                        {/* Delete Customer Button */}
                        <button
                          onClick={() => {
                            // Close all modals first
                            setShowDetails(false);
                            setShowSaleDetails(false);
                            setShowPaymentModal(false);
                            setShowAddCustomerModal(false);
                            setShowPrintModal(false);
                            setShowAddPendingModal(false);
                            setShowEditCustomerModal(false);
                            
                            // Reset all modal-related states
                            setSelectedCustomer(null);
                            setSelectedSale(null);
                            setPrintCustomer(null);
                            setPaymentCustomer(null);
                            setPendingCustomer(null);
                            setEditingCustomer(null);
                            
                            // Then open delete confirmation modal
                            setDeletingCustomer(customer);
                            setShowDeleteConfirmModal(true);
                          }}
                          className="text-red-600 hover:text-red-800 p-1 rounded"
                          title="Delete Customer (This will delete all sales records)"
                        >
                          <svg className="w-5 h-5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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

      {/* Customer Details Modal */}
      {showDetails && selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-[90vh] flex flex-col">
            {/* Fixed Header */}
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
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

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6">
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

                {/* Payment History Section */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Payment History</h4>
                  {paymentHistory.length > 0 ? (
                    <table className="w-full divide-y divide-gray-200">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="w-1/5 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date & Time</th>
                          <th className="w-1/5 px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount Paid (PKR)</th>
                          <th className="w-1/5 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Payment Method</th>
                          <th className="w-1/5 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                          <th className="w-1/5 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {paymentHistory.map((payment, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-sm text-gray-500">
                              {new Date(payment.date).toLocaleString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                            <td className="px-3 py-2 text-sm text-green-600 font-medium text-right">
                              Rs {Math.round(payment.amount).toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900">
                              {payment.paymentMethod}
                              {payment.chequeNumber && ` (Cheque #${payment.chequeNumber})`}
                              {payment.onlinePaymentDetails && ` (Details: ${payment.onlinePaymentDetails})`}
                            </td>
                            <td className="px-3 py-2 text-sm">
                              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                payment.fromSale 
                                  ? 'bg-blue-100 text-blue-800' 
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {payment.type || 'Payment'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-500">
                              {payment.comment || (payment.fromSale ? 'Payment made with sale' : 'Separate payment')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <p>No payment history found for this customer.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sale Details Modal */}
      {showSaleDetails && selectedSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col">
            {/* Fixed Header */}
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
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

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6">
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
                        {selectedSale.onlinePaymentDetails && ` (Details: ${selectedSale.onlinePaymentDetails})`}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Date (Select any date from the month you want to print)</label>
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
                  <option value="Online Payment">Online Payment</option>
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
              {paymentMethod === 'Online Payment' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Online Payment Details</label>
                  <input
                    type="text"
                    value={onlinePaymentDetails}
                    onChange={e => setOnlinePaymentDetails(e.target.value)}
                    className={`w-full px-4 py-2 border rounded-md shadow-sm ${paymentErrors.onlinePaymentDetails ? 'border-red-500' : 'border-gray-300'}`}
                    required
                  />
                  {paymentErrors.onlinePaymentDetails && <p className="text-red-600 text-xs mt-1">{paymentErrors.onlinePaymentDetails}</p>}
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
                customerId: pendingCustomer.customerId || pendingCustomer.phone, // Use existing customer ID or phone
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
      
      {/* Add Customer Modal */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add New Customer</h3>
              <button
                onClick={() => {
                  setShowAddCustomerModal(false);
                  setNewCustomer({ name: '', phone: '', pendingAmount: '' });
                  setNewCustomerReason('');
                  setAddCustomerErrors({});
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddCustomer}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                <input
                  type="text"
                  value={newCustomer.name}
                  onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-md shadow-sm ${addCustomerErrors.name ? 'border-red-500' : 'border-gray-300'}`}
                  required
                />
                {addCustomerErrors.name && <p className="text-red-600 text-xs mt-1">{addCustomerErrors.name}</p>}
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={newCustomer.phone}
                  onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-md shadow-sm ${addCustomerErrors.phone ? 'border-red-500' : 'border-gray-300'}`}
                  required
                />
                {addCustomerErrors.phone && <p className="text-red-600 text-xs mt-1">{addCustomerErrors.phone}</p>}
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Pending Amount (PKR) - Optional</label>
                <input
                  type="number"
                  value={newCustomer.pendingAmount}
                  onChange={e => setNewCustomer({ ...newCustomer, pendingAmount: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-md shadow-sm ${addCustomerErrors.pendingAmount ? 'border-red-500' : 'border-gray-300'}`}
                  min="0"
                />
                {addCustomerErrors.pendingAmount && <p className="text-red-600 text-xs mt-1">{addCustomerErrors.pendingAmount}</p>}
              </div>
              {newCustomer.pendingAmount && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Pending Amount</label>
                  <input
                    type="text"
                    value={newCustomerReason}
                    onChange={e => setNewCustomerReason(e.target.value)}
                    className={`w-full px-4 py-2 border rounded-md shadow-sm ${addCustomerErrors.reason ? 'border-red-500' : 'border-gray-300'}`}
                    required
                  />
                  {addCustomerErrors.reason && <p className="text-red-600 text-xs mt-1">{addCustomerErrors.reason}</p>}
                </div>
              )}
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddCustomerModal(false);
                    setNewCustomer({ name: '', phone: '', pendingAmount: '' });
                    setNewCustomerReason('');
                    setAddCustomerErrors({});
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700"
                >
                  Add Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {showEditCustomerModal && editingCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Edit Customer Information</h3>
              <button
                onClick={() => {
                  setShowEditCustomerModal(false);
                  setEditingCustomer(null);
                  setEditCustomerData({ name: '', phone: '' });
                  setEditCustomerErrors({});
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleEditCustomer}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                <input
                  type="text"
                  value={editCustomerData.name}
                  onChange={e => setEditCustomerData({ ...editCustomerData, name: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-md shadow-sm ${editCustomerErrors.name ? 'border-red-500' : 'border-gray-300'}`}
                  required
                />
                {editCustomerErrors.name && <p className="text-red-600 text-xs mt-1">{editCustomerErrors.name}</p>}
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={editCustomerData.phone}
                  onChange={e => setEditCustomerData({ ...editCustomerData, phone: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-md shadow-sm ${editCustomerErrors.phone ? 'border-red-500' : 'border-gray-300'}`}
                  required
                />
                {editCustomerErrors.phone && <p className="text-red-600 text-xs mt-1">{editCustomerErrors.phone}</p>}
              </div>
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> This will update all sales records for this customer. The change will affect all historical data.
                </p>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditCustomerModal(false);
                    setEditingCustomer(null);
                    setEditCustomerData({ name: '', phone: '' });
                    setEditCustomerErrors({});
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700"
                >
                  Update Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmModal && deletingCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Delete Customer</h3>
              <button
                onClick={() => {
                  setShowDeleteConfirmModal(false);
                  setDeletingCustomer(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="mb-6">
              <div className="p-4 bg-red-50 border border-red-200 rounded-md mb-4">
                <p className="text-sm text-red-800">
                  <strong>Warning:</strong> This action cannot be undone. All sales records for this customer will be permanently deleted.
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-700">
                  <strong>Customer:</strong> {deletingCustomer.names?.join(', ') || 'N/A'}
                </p>
                <p className="text-sm text-gray-700">
                  <strong>Phone:</strong> {deletingCustomer.phone}
                </p>
                <p className="text-sm text-gray-700">
                  <strong>Total Sales:</strong> {deletingCustomer.sales?.length || 0} records
                </p>
                <p className="text-sm text-gray-700">
                  <strong>Total Amount:</strong> Rs {Math.round(deletingCustomer.totalAmount || 0).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteConfirmModal(false);
                  setDeletingCustomer(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCustomer}
                className="px-4 py-2 bg-red-600 text-white rounded-md shadow-sm hover:bg-red-700"
              >
                Delete Customer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search by Customer ID Modal */}
      {showSearchByCustomerIdModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Search by Customer ID</h3>
              <button
                onClick={() => {
                  setShowSearchByCustomerIdModal(false);
                  setCustomerIdSearch('');
                  setSearchedCustomer(null);
                  setSearchedCustomerBills([]);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6">
              <div className="mb-6">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter Customer ID"
                    value={customerIdSearch}
                    onChange={(e) => setCustomerIdSearch(e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    onKeyPress={(e) => e.key === 'Enter' && handleSearchByCustomerId()}
                  />
                  <button
                    onClick={handleSearchByCustomerId}
                    disabled={searchCustomerLoading}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 disabled:opacity-50"
                  >
                    {searchCustomerLoading ? 'Searching...' : 'Search'}
                  </button>
                </div>
              </div>

              {searchedCustomer && (
                <div className="space-y-6">
                  {/* Customer Information */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="text-lg font-semibold text-gray-900 mb-3">Customer Information</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Customer ID</p>
                        <p className="font-medium">{searchedCustomer.customerId || searchedCustomer.phone}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Name</p>
                        <p className="font-medium">{searchedCustomer.names?.join(', ') || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Total Amount</p>
                        <p className="font-medium">Rs {Math.round(searchedCustomer.totalAmount || 0).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Remaining Amount</p>
                        <p className={`font-medium ${searchedCustomer.remainingAmount > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                          Rs {Math.round(searchedCustomer.remainingAmount || 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Bills/Receipts */}
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-3">Bills/Receipts ({searchedCustomerBills.length})</h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bill No</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Amount</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Paid Amount</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Remaining</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {searchedCustomerBills.map((bill, index) => (
                            <tr key={bill.id || index} className="hover:bg-gray-50">
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                {bill.billNumber || '-'}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                {new Date(bill.date).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                Rs {Math.round(bill.totalAmount || 0).toLocaleString()}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                Rs {Math.round(bill.paidAmount || 0).toLocaleString()}
                              </td>
                              <td className={`px-4 py-4 whitespace-nowrap text-sm text-right ${bill.remainingAmount > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                                Rs {Math.round(bill.remainingAmount || 0).toLocaleString()}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-center">
                                <button
                                  onClick={() => {
                                    const html = generatePrintableHTML({
                                      customerName: bill.customerName,
                                      customerPhone: bill.customerPhone,
                                      customerId: bill.customerId,
                                      items: bill.items || [],
                                      totalAmount: bill.totalAmount,
                                      paidAmount: bill.paidAmount,
                                      remainingAmount: bill.remainingAmount,
                                      date: bill.date,
                                      paymentMethod: bill.paymentMethod,
                                      chequeNumber: bill.chequeNumber,
                                      comment: bill.comment,
                                      discount: bill.discount || 0,
                                      discountAmount: bill.discountAmount || 0,
                                      subtotal: bill.subtotal || bill.totalAmount,
                                      billNumber: bill.billNumber,
                                      builteNo: bill.builteNo,
                                      previousRemaining: 0,
                                      paymentHistory: [],
                                      showRemainingBalance
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
                                  }}
                                  className="text-blue-600 hover:text-blue-800 p-1 rounded"
                                  title="Print Bill"
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
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomerManagement;
