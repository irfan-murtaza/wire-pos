import React, { useState, useEffect } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from './firebase';
import { generatePrintableHTML } from './PrintableReceipt';
import { useRef } from 'react';

function ReceiptForm({ isOpen, onClose, onSave }) {
  const hasPrintedRef = useRef(false);
  const [showPrint, setShowPrint] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [comment, setComment] = useState('');
  const [chequeNumber, setChequeNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [items, setItems] = useState([{ name: '', quantity: 1, price: 0 }]);
  const [errors, setErrors] = useState({});
  const [discount, setDiscount] = useState(0);
  const [showDiscount, setShowDiscount] = useState(false);
  const [paidAmount, setPaidAmount] = useState(0);
  const [isPartialPayment, setIsPartialPayment] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState([]);

  const calculateTotal = () => {
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const discountAmount = (subtotal * discount) / 100;
    const total = subtotal - discountAmount;
    const remainingAmount = total - paidAmount;
    return {
      subtotal,
      discountAmount,
      total,
      remainingAmount
    };
  };

  const { subtotal, discountAmount, total, remainingAmount } = calculateTotal();

  useEffect(() => {
    if (showPrint && !hasPrintedRef.current) {
      hasPrintedRef.current = true;
      setTimeout(() => {
        window.print();
        setShowPrint(false);
        hasPrintedRef.current = false;
      }, 100);
    }
  }, [showPrint]);

  const handlePrint = () => {
    const initialPayment = isPartialPayment ? paidAmount : total;
    
    // Create initial payment record for printing
    const initialPaymentRecord = {
      amount: initialPayment,
      method: paymentMethod,
      date: new Date().toISOString(),
      chequeNumber: paymentMethod === 'Cheque' ? chequeNumber : '',
      comment: paymentMethod === 'Other' ? comment : '',
      type: 'Initial Payment'
    };

    const html = generatePrintableHTML({
      customerName,
      customerPhone,
      items: items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price
      })),
      totalAmount: total,
      date: new Date().toISOString(),
      paymentMethod,
      chequeNumber,
      comment,
      discount: showDiscount ? discount : 0,
      discountAmount: showDiscount ? discountAmount : 0,
      subtotal,
      paidAmount: initialPayment,
      remainingAmount: isPartialPayment ? (total - paidAmount) : 0,
      isCustomerReport: false,
      paymentHistory: [initialPaymentRecord]
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

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    if (field === 'name') {
      newItems[index] = {
        ...newItems[index],
        name: value
      };
    } else if (field === 'quantity') {
      newItems[index] = {
        ...newItems[index],
        quantity: value,
        totalPrice: value * newItems[index].price
      };
    } else if (field === 'price') {
      // Only allow integer values for price
      const intValue = Math.round(parseFloat(value) || 0);
      newItems[index] = {
        ...newItems[index],
        price: intValue,
        totalPrice: intValue * newItems[index].quantity
      };
    }
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { name: '', quantity: 1, price: 0 }]);
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!customerName.trim()) {
      newErrors.customerName = 'Customer name is required';
    } else if (typeof customerName !== 'string') {
      newErrors.customerName = 'Customer name must be a string';
    } else if (customerName.length > 50) {
      newErrors.customerName = 'Customer name cannot exceed 50 characters';
    } else if (!/^[a-zA-Z\s\-']+$/.test(customerName)) {
      newErrors.customerName = 'Customer name can only contain letters, spaces, hyphens, and apostrophes';
    }

    if (!customerPhone) {
      newErrors.customerPhone = 'Phone number is required';
    } else if (!/^\d{11}$/.test(customerPhone)) {
      newErrors.customerPhone = 'Phone number must be exactly 11 digits';
    }
    
    items.forEach((item, index) => {
      if (!item.name) {
        newErrors[`itemName${index}`] = 'Product name is required';
      }
      if (!item.quantity || item.quantity <= 0) {
        newErrors[`itemQuantity${index}`] = 'Quantity must be greater than 0';
      }
      if (!item.price || item.price < 0) {
        newErrors[`itemPrice${index}`] = 'Price must be greater than or equal to 0';
      }
    });
    
    if (paymentMethod === 'Cheque' && !chequeNumber.trim()) {
      newErrors.chequeNumber = 'Cheque number is required for cheque payments';
    }

    if (paymentMethod === 'Other' && !comment.trim()) {
      newErrors.comment = 'Comment is required for "Other" payment method';
    }

    if (isPartialPayment) {
      if (isNaN(paidAmount) || paidAmount < 0) {
        newErrors.paidAmount = 'Paid amount must be a valid number';
      } else if (paidAmount > total) {
        newErrors.paidAmount = 'Paid amount cannot be greater than total amount';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      const initialPayment = isPartialPayment ? paidAmount : total;
      
      // Create the receipt data
      const receiptData = {
        customerName,
        customerPhone,
        items: items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          totalPrice: item.quantity * item.price
        })),
        totalAmount: total,
        paidAmount: initialPayment,
        remainingAmount: isPartialPayment ? (total - paidAmount) : 0,
        date: new Date().toISOString(),
        paymentMethod: paymentMethod,
        chequeNumber: paymentMethod === 'Cheque' ? chequeNumber : '',
        comment: paymentMethod === 'Other' ? comment : '',
        discount: showDiscount ? discount : 0,
        discountAmount: showDiscount ? discountAmount : 0,
        subtotal,
        isDebt: isPartialPayment && (total - paidAmount) > 0
      };

      // Add the receipt to Firestore
      const docRef = await addDoc(collection(db, 'receipts'), receiptData);

      // Create initial payment record only if there is a payment
      if (initialPayment > 0) {
        const paymentHistoryData = {
          saleId: docRef.id,
          amount: initialPayment,
          paymentMethod: paymentMethod,
          date: new Date().toISOString(),
          chequeNumber: paymentMethod === 'Cheque' ? chequeNumber : '',
          comment: paymentMethod === 'Other' ? comment : '',
          type: 'Initial Payment'
        };
        
        // Add the initial payment to payment history
        await addDoc(collection(db, 'paymentHistory'), paymentHistoryData);
      }

      resetForm();
      onSave();
    } catch (error) {
      console.error('Error saving receipt:', error);
      alert(`Error saving receipt: ${error.message}`);
    }
  };

  const resetForm = () => {
    setPaymentMethod('Cash');
    setComment('');
    setChequeNumber('');
    setCustomerName('');
    setCustomerPhone('');
    setItems([{ name: '', quantity: 1, price: 0 }]);
    setErrors({});
    setDiscount(0);
    setShowDiscount(false);
    setPaidAmount(0);
    setIsPartialPayment(false);
    setPaymentHistory([]);
  };

  const removeItem = (index) => {
    if (items.length > 1) {
      const newItems = items.filter((_, i) => i !== index);
      setItems(newItems);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full my-8 flex flex-col">
        <div className="sticky top-0 bg-white p-6 border-b z-10">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold text-gray-800">New Sale</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-6 mt-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
              <input
                type="text"
                placeholder="Enter customer name"
                value={customerName}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^a-zA-Z\s\-']/g, '');
                  setCustomerName(value);
                }}
                className={`w-full px-4 py-2 border rounded-md shadow-sm ${
                  errors.customerName ? 'border-red-500' : 'border-gray-300'
                }`}
                maxLength={50}
              />
              {errors.customerName && (
                <p className="mt-1 text-sm text-red-600">{errors.customerName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer Phone</label>
              <input
                type="tel"
                placeholder="Enter 11-digit phone number"
                value={customerPhone}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 11);
                  setCustomerPhone(value);
                }}
                className={`w-full px-4 py-2 border rounded-md shadow-sm ${
                  errors.customerPhone ? 'border-red-500' : 'border-gray-300'
                }`}
                maxLength={11}
              />
              {errors.customerPhone && (
                <p className="mt-1 text-sm text-red-600">{errors.customerPhone}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 px-6">
          <div className="space-y-4 py-6">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 font-medium text-gray-700">
              <div className="px-3 py-2">Product Name</div>
              <div className="px-3 py-2">Quantity</div>
              <div className="px-3 py-2">Price Per Unit (PKR)</div>
              <div className="px-3 py-2">Total (PKR)</div>
              <div className="px-3 py-2">Actions</div>
            </div>
            {items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                    placeholder="Enter product name"
                    className={`w-full px-3 py-2 border rounded-md shadow-sm ${
                      errors[`itemName${idx}`] ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors[`itemName${idx}`] && (
                    <p className="mt-1 text-sm text-red-600">{errors[`itemName${idx}`]}</p>
                  )}
                </div>
                <div>
                  <input
                    type="number"
                    value={item.quantity === 0 ? '' : item.quantity}
                    onChange={(e) => {
                      let val = e.target.value;
                      if (val.length > 1 && val.startsWith('0')) {
                        val = val.replace(/^0+/, '');
                      }
                      const number = parseInt(val, 10);
                      handleItemChange(idx, 'quantity', isNaN(number) ? 0 : number);
                    }}
                    placeholder="Quantity"
                    className={`w-full px-3 py-2 border rounded-md shadow-sm ${
                      errors[`itemQuantity${idx}`] ? 'border-red-500' : 'border-gray-300'
                    }`}
                    min="1"
                    step="1"
                  />
                  {errors[`itemQuantity${idx}`] && (
                    <p className="mt-1 text-sm text-red-600">{errors[`itemQuantity${idx}`]}</p>
                  )}
                </div>
                <div>
                  <input
                    type="number"
                    value={item.price === 0 ? '' : item.price}
                    onChange={(e) => {
                      let val = e.target.value;
                      if (val.length > 1 && val.startsWith('0')) {
                        val = val.replace(/^0+/, '');
                      }
                      const intValue = Math.round(parseFloat(val) || 0);
                      handleItemChange(idx, 'price', intValue);
                    }}
                    placeholder="Price"
                    className={`w-full px-3 py-2 border rounded-md shadow-sm ${
                      errors[`itemPrice${idx}`] ? 'border-red-500' : 'border-gray-300'
                    }`}
                    min="0"
                    step="1"
                  />
                  {errors[`itemPrice${idx}`] && (
                    <p className="mt-1 text-sm text-red-600">{errors[`itemPrice${idx}`]}</p>
                  )}
                </div>
                <div>
                  <div className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50">
                    <div className="text-gray-700">{Math.round(item.quantity * item.price)}</div>
                  </div>
                </div>
                <div className="flex items-center">
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="p-2 text-red-600 hover:text-red-800"
                      title="Remove item"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button 
              onClick={addItem} 
              className="mt-2 bg-gray-100 hover:bg-gray-200 text-sm px-4 py-2 rounded-md shadow-sm transition-all"
            >
              + Add Item
            </button>
          </div>
        </div>

        <div className="p-6 border-t">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="text-gray-700">Subtotal:</div>
              <div className="text-gray-700">{Math.round(subtotal)}</div>
            </div>

            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowDiscount(!showDiscount)}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  {showDiscount ? 'Remove Discount' : 'Add Discount'}
                </button>
                {showDiscount && (
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      value={discount}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        setDiscount(isNaN(value) ? 0 : Math.min(100, Math.max(0, value)));
                      }}
                      className="w-20 px-2 py-1 border rounded-md shadow-sm"
                      placeholder="%"
                      min="0"
                      max="100"
                    />
                    <span className="text-gray-500">%</span>
                  </div>
                )}
              </div>
              {showDiscount && (
                <div className="text-red-600">- {Math.round(discountAmount)}</div>
              )}
            </div>

            <div className="border-t pt-2">
              <div className="flex justify-between items-center font-semibold">
                <div className="text-gray-900">Total Amount:</div>
                <div className="text-gray-900">{Math.round(total)}</div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="partialPayment"
                checked={isPartialPayment}
                onChange={(e) => {
                  setIsPartialPayment(e.target.checked);
                  if (!e.target.checked) {
                    setPaidAmount(total);
                  }
                }}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="partialPayment" className="text-sm text-gray-700">
                Partial Payment
              </label>
            </div>

            {isPartialPayment && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Paid Amount</label>
                <input
                  type="number"
                  value={paidAmount}
                  onChange={(e) => {
                    let val = e.target.value;
                    if (val.length > 1 && val.startsWith('0')) {
                      val = val.replace(/^0+/, '');
                    }
                    const parsed = parseInt(val, 10);
                    setPaidAmount(isNaN(parsed) ? 0 : parsed);
                  }}
                  className={`w-full px-4 py-2 border rounded-md shadow-sm ${
                    errors.paidAmount ? 'border-red-500' : 'border-gray-300'
                  }`}
                  min="0"
                  max={total}
                  step="1"
                />
                {errors.paidAmount && (
                  <p className="mt-1 text-sm text-red-600">{errors.paidAmount}</p>
                )}
                <div className="mt-2 text-sm text-gray-600">
                  Remaining Amount: {Math.round(remainingAmount)}
                </div>
              </div>
            )}
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm"
            >
              <option>Cash</option>
              <option>Card</option>
              <option>Cheque</option>
              <option>Other</option>
            </select>
          </div>

          {paymentMethod === 'Cheque' && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Cheque Number</label>
              <input
                type="text"
                value={chequeNumber}
                onChange={(e) => setChequeNumber(e.target.value)}
                placeholder="Enter cheque number"
                className={`w-full px-4 py-2 border rounded-md shadow-sm ${
                  errors.chequeNumber ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.chequeNumber && (
                <p className="mt-1 text-sm text-red-600">{errors.chequeNumber}</p>
              )}
            </div>
          )}

          {paymentMethod === 'Other' && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Comment</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Enter comment for payment"
                className={`w-full px-4 py-2 border rounded-md shadow-sm ${
                  errors.comment ? 'border-red-500' : 'border-gray-300'
                }`}
                rows={3}
              />
              {errors.comment && (
                <p className="mt-1 text-sm text-red-600">{errors.comment}</p>
              )}
            </div>
          )}

          <div className="flex justify-end space-x-4 pt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700"
            >
              Save Sale
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReceiptForm;