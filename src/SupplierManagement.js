import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, orderBy, doc, updateDoc, where } from 'firebase/firestore';
import { db } from './firebase';

function SupplierManagement() {
  const [suppliers, setSuppliers] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [supplierProducts, setSupplierProducts] = useState([]);
  const [newSupplier, setNewSupplier] = useState({
    name: '',
    phone: '',
    address: '',
    balance: 0
  });
  const [newProduct, setNewProduct] = useState({
    name: '',
    unitPrice: 0,
    quantity: 0,
    totalPrice: 0,
    paidAmount: 0,
    remainingAmount: 0
  });
  const [payment, setPayment] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    paymentMethod: 'Cash',
    chequeNumber: ''
  });
  const [errors, setErrors] = useState({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [showNewProductForm, setShowNewProductForm] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [supplierDetails, setSupplierDetails] = useState({
    payments: [],
    products: []
  });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const suppliersQuery = query(collection(db, 'suppliers'), orderBy('name'));
      const querySnapshot = await getDocs(suppliersQuery);
      const suppliersList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSuppliers(suppliersList);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      alert('Error fetching suppliers. Please check console for details.');
    }
  };

  const fetchSupplierProducts = async (supplierId) => {
    try {
      const productsQuery = query(collection(db, 'supplierProducts'), where('supplierId', '==', supplierId));
      const querySnapshot = await getDocs(productsQuery);
      const productsList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        unitPrice: Math.round(doc.data().unitPrice || 0),
        quantity: Math.round(doc.data().quantity || 0),
        totalPrice: Math.round(doc.data().totalPrice || 0),
        paidAmount: Math.round(doc.data().paidAmount || 0),
        remainingAmount: Math.round(doc.data().remainingAmount || 0)
      }));
      setSupplierProducts(productsList);
    } catch (error) {
      console.error('Error fetching supplier products:', error);
      alert('Error fetching supplier products. Please check console for details.');
    }
  };

  const fetchSupplierDetails = async (supplierId) => {
    try {
      // Fetch payments
      const paymentsQuery = query(collection(db, 'supplierPayments'), 
        where('supplierId', '==', supplierId),
        orderBy('date', 'desc')
      );
      const paymentsSnapshot = await getDocs(paymentsQuery);
      const paymentsList = paymentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Fetch products
      const productsQuery = query(collection(db, 'supplierProducts'), 
        where('supplierId', '==', supplierId),
        orderBy('createdAt', 'desc')
      );
      const productsSnapshot = await getDocs(productsQuery);
      const productsList = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setSupplierDetails({
        payments: paymentsList,
        products: productsList
      });
    } catch (error) {
      console.error('Error fetching supplier details:', error);
      alert('Error fetching supplier details. Please check console for details.');
    }
  };

  const validateSupplier = async () => {
    const newErrors = {};
    
    // Name validation
    if (!newSupplier.name.trim()) {
      newErrors.name = 'Supplier name is required';
    } else if (newSupplier.name.length > 50) {
      newErrors.name = 'Name cannot exceed 50 characters';
    } else if (/\d/.test(newSupplier.name)) {
      newErrors.name = 'Name cannot contain numbers';
    }
    
    // Phone validation
    if (!newSupplier.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^\d{11}$/.test(newSupplier.phone)) {
      newErrors.phone = 'Phone number must be exactly 11 digits';
    } else {
      // Check for duplicate phone number
      const phoneQuery = query(collection(db, 'suppliers'), where('phone', '==', newSupplier.phone));
      const querySnapshot = await getDocs(phoneQuery);
      if (!querySnapshot.empty) {
        newErrors.phone = 'Phone number already exists';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateProduct = () => {
    const newErrors = {};
    
    if (!newProduct.name.trim()) {
      newErrors.name = 'Product name is required';
    }
    
    if (newProduct.unitPrice <= 0) {
      newErrors.unitPrice = 'Unit price must be greater than 0';
    }
    
    if (newProduct.quantity <= 0) {
      newErrors.quantity = 'Quantity must be greater than 0';
    }
    
    if (newProduct.paidAmount < 0) {
      newErrors.paidAmount = 'Paid amount cannot be negative';
    }
    
    if (newProduct.paidAmount > newProduct.totalPrice) {
      newErrors.paidAmount = 'Paid amount cannot exceed total price';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePayment = () => {
    const newErrors = {};
    const paymentAmount = Math.round(parseFloat(payment.amount));
    const remainingAmount = Math.round(selectedSupplier.product.remainingAmount);

    if (!payment.amount || paymentAmount <= 0) {
      newErrors.amount = 'Payment amount must be greater than 0';
    } else if (paymentAmount > remainingAmount) {
      newErrors.amount = `Payment amount cannot exceed remaining amount (Rs ${Math.round(remainingAmount)})`;
    }
    if (!payment.date) {
      newErrors.date = 'Payment date is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddSupplier = async () => {
    if (!await validateSupplier()) return;

    try {
      await addDoc(collection(db, 'suppliers'), {
        ...newSupplier,
        balance: 0,
        createdAt: new Date().toISOString()
      });
      
      setShowAddModal(false);
      setNewSupplier({
        name: '',
        phone: '',
        address: '',
        balance: 0
      });
      setErrors({});
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      fetchSuppliers();
    } catch (error) {
      console.error('Error adding supplier:', error);
      alert('Error adding supplier. Please check console for details.');
    }
  };

  const handleAddProduct = async () => {
    if (!validateProduct()) return;

    try {
      const totalPrice = Math.round(newProduct.unitPrice * newProduct.quantity);
      const paidAmount = Math.round(newProduct.paidAmount || 0);
      const remainingAmount = Math.round(totalPrice - paidAmount);

      // Add the product
      const productDoc = await addDoc(collection(db, 'supplierProducts'), {
        ...newProduct,
        supplierId: selectedSupplier.id,
        totalPrice: Math.round(totalPrice),
        paidAmount: Math.round(paidAmount),
        remainingAmount: Math.round(remainingAmount),
        createdAt: new Date().toISOString()
      });

      // If there's an initial payment, add it to payment history
      if (paidAmount > 0) {
        await addDoc(collection(db, 'supplierPayments'), {
          supplierId: selectedSupplier.id,
          amount: Math.round(paidAmount),
          date: new Date().toISOString().split('T')[0],
          description: `Initial payment for ${newProduct.name}`,
          paymentMethod: 'Cash',
          chequeNumber: '',
          createdAt: new Date().toISOString()
        });
      }

      // Update supplier balance
      const supplierDoc = doc(db, 'suppliers', selectedSupplier.id);
      await updateDoc(supplierDoc, {
        balance: Math.round(selectedSupplier.balance + remainingAmount)
      });

      setShowProductModal(false);
      setNewProduct({
        name: '',
        unitPrice: 0,
        quantity: 0,
        totalPrice: 0,
        paidAmount: 0,
        remainingAmount: 0
      });
      setErrors({});
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      fetchSuppliers();
      fetchSupplierProducts(selectedSupplier.id);
    } catch (error) {
      console.error('Error adding product:', error);
      alert('Error adding product. Please check console for details.');
    }
  };

  const handleAddPayment = async () => {
    if (!validatePayment()) return;

    try {
      const paymentAmount = Math.round(parseFloat(payment.amount));
      const supplierDoc = doc(db, 'suppliers', selectedSupplier.id);
      
      // Add payment record
      await addDoc(collection(db, 'supplierPayments'), {
        supplierId: selectedSupplier.id,
        amount: Math.round(paymentAmount),
        date: payment.date,
        description: payment.description,
        paymentMethod: payment.paymentMethod,
        chequeNumber: payment.chequeNumber,
        createdAt: new Date().toISOString()
      });

      // Update product's paid amount and remaining amount
      const productDoc = doc(db, 'supplierProducts', selectedSupplier.product.id);
      const newPaidAmount = Math.round((selectedSupplier.product.paidAmount || 0) + paymentAmount);
      const newRemainingAmount = Math.round(selectedSupplier.product.totalPrice - newPaidAmount);
      
      await updateDoc(productDoc, {
        paidAmount: Math.round(newPaidAmount),
        remainingAmount: Math.round(newRemainingAmount)
      });

      // Update supplier balance
      await updateDoc(supplierDoc, {
        balance: Math.round(selectedSupplier.balance - paymentAmount)
      });

      setShowPaymentModal(false);
      setPayment({
        amount: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        paymentMethod: 'Cash',
        chequeNumber: ''
      });
      setErrors({});
      fetchSuppliers();
      fetchSupplierProducts(selectedSupplier.id);
    } catch (error) {
      console.error('Error adding payment:', error);
      alert('Error adding payment. Please check console for details.');
    }
  };

  const handleViewProducts = (supplier) => {
    setSelectedSupplier(supplier);
    fetchSupplierProducts(supplier.id);
    setShowProductModal(true);
  };

  const handleViewDetails = (supplier) => {
    setSelectedSupplier(supplier);
    fetchSupplierDetails(supplier.id);
    setShowDetailsModal(true);
  };

  return (
    <div className="space-y-6">
      {showSuccess && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50">
          {showProductModal ? 'Product added successfully!' : 'Supplier added successfully!'}
        </div>
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-gray-800">Supplier Management</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md shadow-sm transition-all"
        >
          Add Supplier
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Supplier</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Phone</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Address</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Amount to be Paid (PKR)</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {suppliers.map((supplier) => (
              <tr key={supplier.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                  {supplier.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                  {supplier.phone}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                  {supplier.address}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                  {Math.round(supplier.balance)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-center space-x-2">
                  <button
                    onClick={() => handleViewDetails(supplier)}
                    className="text-blue-600 hover:text-blue-800 mr-2"
                    title="View Details"
                  >
                    <svg className="w-5 h-5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleViewProducts(supplier)}
                    className="text-blue-600 hover:text-blue-800 mr-2"
                    title="View Products"
                  >
                    <svg className="w-5 h-5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Supplier Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Add New Supplier</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  value={newSupplier.name}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[0-9]/g, '');
                    setNewSupplier({ ...newSupplier, name: value });
                    if (errors.name) {
                      setErrors(prev => ({ ...prev, name: '' }));
                    }
                  }}
                  maxLength={50}
                  className={`mt-1 block w-full border rounded-md shadow-sm p-2 ${
                    errors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Phone</label>
                <input
                  type="text"
                  value={newSupplier.phone}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 11);
                    setNewSupplier({ ...newSupplier, phone: value });
                    if (errors.phone) {
                      setErrors(prev => ({ ...prev, phone: '' }));
                    }
                  }}
                  className={`mt-1 block w-full border rounded-md shadow-sm p-2 ${
                    errors.phone ? 'border-red-500' : 'border-gray-300'
                  }`}
                  maxLength={11}
                />
                {errors.phone && (
                  <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Address</label>
                <textarea
                  value={newSupplier.address}
                  onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  rows={3}
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setErrors({});
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddSupplier}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700"
                >
                  Add Supplier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {showProductModal && selectedSupplier && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Products for {selectedSupplier.name}</h3>
              <button
                onClick={() => {
                  setShowProductModal(false);
                  setSelectedSupplier(null);
                  setSupplierProducts([]);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="mb-6">
              <button
                onClick={() => {
                  setNewProduct({
                    name: '',
                    unitPrice: 0,
                    quantity: 0,
                    totalPrice: 0,
                    paidAmount: 0,
                    remainingAmount: 0
                  });
                  setShowNewProductForm(true);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md shadow-sm transition-all"
              >
                Add New Product
              </button>
            </div>

            {/* Add New Product Form */}
            {showNewProductForm && (
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Product Name</label>
                    <input
                      type="text"
                      value={newProduct.name}
                      onChange={(e) => {
                        setNewProduct({ ...newProduct, name: e.target.value });
                        if (errors.name) {
                          setErrors(prev => ({ ...prev, name: '' }));
                        }
                      }}
                      className={`mt-1 block w-full border rounded-md shadow-sm p-2 ${
                        errors.name ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.name && (
                      <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Unit Price (PKR)</label>
                    <input
                      type="number"
                      value={newProduct.unitPrice}
                      onChange={(e) => {
                        const value = Math.round(parseFloat(e.target.value) || 0);
                        const totalPrice = Math.round(value * newProduct.quantity);
                        setNewProduct({
                          ...newProduct,
                          unitPrice: value,
                          totalPrice: totalPrice,
                          remainingAmount: Math.round(totalPrice - newProduct.paidAmount)
                        });
                        if (errors.unitPrice) {
                          setErrors(prev => ({ ...prev, unitPrice: '' }));
                        }
                      }}
                      className={`mt-1 block w-full border rounded-md shadow-sm p-2 ${
                        errors.unitPrice ? 'border-red-500' : 'border-gray-300'
                      }`}
                      min="1"
                      step="1"
                    />
                    {errors.unitPrice && (
                      <p className="mt-1 text-sm text-red-600">{errors.unitPrice}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Quantity</label>
                    <input
                      type="number"
                      value={newProduct.quantity}
                      onChange={(e) => {
                        const value = Math.round(parseFloat(e.target.value) || 0);
                        const totalPrice = Math.round(newProduct.unitPrice * value);
                        setNewProduct({
                          ...newProduct,
                          quantity: value,
                          totalPrice: totalPrice,
                          remainingAmount: Math.round(totalPrice - newProduct.paidAmount)
                        });
                        if (errors.quantity) {
                          setErrors(prev => ({ ...prev, quantity: '' }));
                        }
                      }}
                      className={`mt-1 block w-full border rounded-md shadow-sm p-2 ${
                        errors.quantity ? 'border-red-500' : 'border-gray-300'
                      }`}
                      min="1"
                      step="1"
                    />
                    {errors.quantity && (
                      <p className="mt-1 text-sm text-red-600">{errors.quantity}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Paid Amount (PKR)</label>
                    <input
                      type="number"
                      value={newProduct.paidAmount}
                      onChange={(e) => {
                        const value = Math.round(parseFloat(e.target.value) || 0);
                        const totalPrice = Math.round(newProduct.unitPrice * newProduct.quantity);
                        setNewProduct({
                          ...newProduct,
                          paidAmount: value,
                          remainingAmount: Math.round(totalPrice - value)
                        });
                        if (errors.paidAmount) {
                          setErrors(prev => ({ ...prev, paidAmount: '' }));
                        }
                      }}
                      className={`mt-1 block w-full border rounded-md shadow-sm p-2 ${
                        errors.paidAmount ? 'border-red-500' : 'border-gray-300'
                      }`}
                      min="0"
                      step="1"
                    />
                    {errors.paidAmount && (
                      <p className="mt-1 text-sm text-red-600">{errors.paidAmount}</p>
                    )}
                  </div>
                </div>
                <div className="mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Total Price (PKR)</label>
                      <div className="mt-1 p-2 bg-gray-50 rounded-md">
                        {Math.round(newProduct.unitPrice * newProduct.quantity)}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Remaining Amount (PKR)</label>
                      <div className="mt-1 p-2 bg-gray-50 rounded-md">
                        {Math.round((newProduct.unitPrice * newProduct.quantity) - newProduct.paidAmount)}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => {
                      setNewProduct({
                        name: '',
                        unitPrice: 0,
                        quantity: 0,
                        totalPrice: 0,
                        paidAmount: 0,
                        remainingAmount: 0
                      });
                      setShowNewProductForm(false);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddProduct}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700"
                  >
                    Add Product
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Unit Price (PKR)</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Quantity</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Total Price (PKR)</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Paid Amount (PKR)</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Remaining Amount (PKR)</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {supplierProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                        {product.name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                        {Math.round(product.unitPrice || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                        {product.quantity || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                        {Math.round(product.totalPrice || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                        {Math.round(product.paidAmount || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                        {Math.round(product.remainingAmount || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center space-x-2">
                        <button
                          onClick={() => {
                            setSelectedSupplier({ ...selectedSupplier, product });
                            setPayment({
                              amount: Math.round(product.remainingAmount || 0),
                              date: new Date().toISOString().split('T')[0],
                              description: `Payment for ${product.name || 'product'}`,
                              paymentMethod: 'Cash',
                              chequeNumber: ''
                            });
                            setShowPaymentModal(true);
                          }}
                          className="text-green-600 hover:text-green-800"
                          title="Pay Remaining Amount"
                        >
                          <svg className="w-5 h-5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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

      {/* Add Payment Modal */}
      {showPaymentModal && selectedSupplier && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">
              {selectedSupplier.product 
                ? `Pay Remaining Amount for ${selectedSupplier.product.name}`
                : `Add Payment for ${selectedSupplier.name}`}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Amount (PKR)</label>
                <input
                  type="number"
                  value={payment.amount}
                  onChange={(e) => setPayment({ ...payment, amount: e.target.value })}
                  className={`mt-1 block w-full border rounded-md shadow-sm p-2 ${
                    errors.amount ? 'border-red-500' : 'border-gray-300'
                  }`}
                  min="1"
                  step="1"
                />
                {errors.amount && (
                  <p className="mt-1 text-sm text-red-600">{errors.amount}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Date</label>
                <input
                  type="date"
                  value={payment.date}
                  onChange={(e) => setPayment({ ...payment, date: e.target.value })}
                  className={`mt-1 block w-full border rounded-md shadow-sm p-2 ${
                    errors.date ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.date && (
                  <p className="mt-1 text-sm text-red-600">{errors.date}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Payment Method</label>
                <select
                  value={payment.paymentMethod}
                  onChange={(e) => setPayment({ ...payment, paymentMethod: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                >
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              {payment.paymentMethod === 'Cheque' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Cheque Number</label>
                  <input
                    type="text"
                    value={payment.chequeNumber}
                    onChange={(e) => setPayment({ ...payment, chequeNumber: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    placeholder="Enter cheque number"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={payment.description}
                  onChange={(e) => setPayment({ ...payment, description: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  rows={3}
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowPaymentModal(false);
                    setErrors({});
                    if (selectedSupplier.product) {
                      setSelectedSupplier({ ...selectedSupplier, product: null });
                    }
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddPayment}
                  className="px-4 py-2 bg-green-600 text-white rounded-md shadow-sm hover:bg-green-700"
                >
                  Add Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedSupplier && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Details for {selectedSupplier.name}</h3>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedSupplier(null);
                  setSupplierDetails({ payments: [], products: [] });
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              {/* Payment History */}
              <div>
                <h4 className="text-md font-semibold mb-2">Payment History</h4>
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Amount (PKR)</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Method</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Description</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {supplierDetails.payments.map((payment) => (
                        <tr key={payment.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                            {new Date(payment.date).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                            {Math.round(payment.amount)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                            {payment.paymentMethod}
                            {payment.chequeNumber && ` (${payment.chequeNumber})`}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                            {payment.description}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Product History */}
              <div>
                <h4 className="text-md font-semibold mb-2">Product History</h4>
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Product</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Unit Price (PKR)</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Quantity</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Total Price (PKR)</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Paid Amount (PKR)</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Remaining Amount (PKR)</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Date</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {supplierDetails.products.map((product) => (
                        <tr key={product.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                            {product.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                            {Math.round(product.unitPrice)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                            {product.quantity}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                            {Math.round(product.totalPrice)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                            {Math.round(product.paidAmount)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                            {Math.round(product.remainingAmount)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                            {new Date(product.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SupplierManagement; 


