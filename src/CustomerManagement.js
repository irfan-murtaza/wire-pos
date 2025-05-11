import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
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
        const normalizedName = sale.customerName.toLowerCase();
        const customerKey = `${normalizedName}-${sale.customerPhone}`;
        
        if (!customerData[customerKey]) {
          // Find if there's an existing customer with the same normalized name
          const existingKey = Object.keys(customerData).find(key => 
            key.toLowerCase() === customerKey.toLowerCase()
          );
          
          if (existingKey) {
            // Merge with existing customer data
            customerData[existingKey].totalAmount += sale.totalAmount || 0;
            customerData[existingKey].paidAmount += sale.paidAmount || 0;
            customerData[existingKey].remainingAmount += sale.remainingAmount || 0;
            customerData[existingKey].sales.push(sale);
            
            // Merge items
            sale.items.forEach(item => {
              const itemKey = item.name;
              if (!customerData[existingKey].items[itemKey]) {
                customerData[existingKey].items[itemKey] = {
                  name: item.name,
                  totalQuantity: 0,
                  totalValue: 0
                };
              }
              customerData[existingKey].items[itemKey].totalQuantity += item.quantity || 0;
              customerData[existingKey].items[itemKey].totalValue += (item.quantity || 0) * (item.price || 0);
            });
          } else {
            // Create new customer entry
            customerData[customerKey] = {
              name: sale.customerName,
              phone: sale.customerPhone,
              totalAmount: sale.totalAmount || 0,
              paidAmount: sale.paidAmount || 0,
              remainingAmount: sale.remainingAmount || 0,
              sales: [sale],
              items: {}
            };
            
            // Initialize items
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
          // Update existing customer data
          customerData[customerKey].totalAmount += sale.totalAmount || 0;
          customerData[customerKey].paidAmount += sale.paidAmount || 0;
          customerData[customerKey].remainingAmount += sale.remainingAmount || 0;
          customerData[customerKey].sales.push(sale);
          
          // Update items
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

  const handlePrint = (customer) => {
    const html = generatePrintableHTML({
      customerName: customer.name,
      customerPhone: customer.phone,
      items: Object.values(customer.items).map(item => ({
        name: item.name,
        quantity: item.totalQuantity,
        price: item.totalValue / item.totalQuantity
      })),
      totalAmount: customer.totalAmount,
      paidAmount: customer.paidAmount,
      remainingAmount: customer.remainingAmount,
      date: new Date().toISOString(),
      isCustomerReport: true,
      subtotal: customer.totalAmount,
      paymentMethod: 'Customer Report',
      paymentHistory: customer.sales.map(sale => ({
        date: sale.date,
        amount: sale.paidAmount,
        paymentMethod: sale.paymentMethod,
        chequeNumber: sale.chequeNumber,
        comment: sale.comment
      }))
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

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total (PKR)</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Paid (PKR)</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Remaining (PKR)</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredCustomers.map((customer, index) => (
              <tr key={index} className={`hover:bg-gray-50 ${customer.remainingAmount > 0 ? 'bg-red-50' : ''}`}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                  <div className="text-sm text-gray-500">{customer.phone}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                  {Math.round(customer.totalAmount)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                  {Math.round(customer.paidAmount)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 text-right">
                  {customer.remainingAmount > 0 ? Math.round(customer.remainingAmount) : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-center space-x-2">
                  <button
                    onClick={() => handlePrint(customer)}
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
                    <div className="text-xl font-semibold text-gray-900">Rs {Math.round(selectedCustomer.totalAmount)}</div>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow">
                    <div className="text-sm text-gray-500">Total Paid</div>
                    <div className="text-xl font-semibold text-gray-900">Rs {Math.round(selectedCustomer.paidAmount)}</div>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow">
                    <div className="text-sm text-gray-500">Remaining Amount</div>
                    <div className="text-xl font-semibold text-red-600">Rs {Math.round(selectedCustomer.remainingAmount)}</div>
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
                            className="text-blue-600 hover:text-blue-800"
                            title="View Sale Details"
                          >
                            <svg className="w-5 h-5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
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
                    <div className="text-lg font-semibold text-gray-900">Rs {Math.round(selectedSale.totalAmount)}</div>
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

export default CustomerManagement; 