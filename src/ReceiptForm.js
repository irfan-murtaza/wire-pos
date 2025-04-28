import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { generatePrintableHTML } from './PrintableReceipt';

import { useRef } from 'react';

function ReceiptForm() {
  const hasPrintedRef = useRef(false);
  const [showPrint, setShowPrint] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [comment, setComment] = useState('');
  const [chequeNumber, setChequeNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [items, setItems] = useState([{ name: '', quantity: 1, price: 0 }]);
  const [inventoryProducts, setInventoryProducts] = useState([]);
  const [errors, setErrors] = useState({});
  const [discount, setDiscount] = useState(0);
  const [showDiscount, setShowDiscount] = useState(false);

  useEffect(() => {
    fetchInventoryProducts();
  }, []);

  const fetchInventoryProducts = async () => {
    try {
      const productsCollection = collection(db, 'products');
      const querySnapshot = await getDocs(productsCollection);
      const productsList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setInventoryProducts(productsList);
    } catch (error) {
      console.error('Error fetching products:', error);
      alert('Error fetching products. Please check console for details.');
    }
  };

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
    const html = generatePrintableHTML({
      customerName,
      items,
      totalAmount: total,
      date: new Date().toISOString(),
      paymentMethod,
      chequeNumber,
      comment,
      discount: showDiscount ? discount : 0,
      discountAmount: showDiscount ? discountAmount : 0,
      subtotal
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
      const selectedProduct = inventoryProducts.find(p => p.name === value);
      newItems[index] = {
        ...newItems[index],
        name: value,
        price: selectedProduct ? selectedProduct.unitPrice : 0,
        availableQuantity: selectedProduct ? selectedProduct.quantity : 0
      };
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[`itemQuantity${index}`];
        return newErrors;
      });
    } else if (field === 'quantity') {
      const selectedProduct = inventoryProducts.find(p => p.name === newItems[index].name);
      const availableQuantity = selectedProduct ? selectedProduct.quantity : 0;
      
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[`itemQuantity${index}`];
        return newErrors;
      });

      if (value > availableQuantity) {
        setErrors(prev => ({
          ...prev,
          [`itemQuantity${index}`]: `Only ${availableQuantity} units available in stock`
        }));
        return;
      }
      newItems[index] = {
        ...newItems[index],
        quantity: value,
        totalPrice: value * newItems[index].price
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
    }
    
    items.forEach((item, index) => {
      if (!item.name) {
        newErrors[`itemName${index}`] = 'Product name is required';
      }
      if (!item.quantity || item.quantity <= 0) {
        newErrors[`itemQuantity${index}`] = 'Quantity must be greater than 0';
      }
      const selectedProduct = inventoryProducts.find(p => p.name === item.name);
      if (selectedProduct && item.quantity > selectedProduct.quantity) {
        newErrors[`itemQuantity${index}`] = `Only ${selectedProduct.quantity} units available in stock`;
      }
    });
    
    if (paymentMethod === 'Cheque' && !chequeNumber.trim()) {
      newErrors.chequeNumber = 'Cheque number is required for cheque payments';
    }

    if (paymentMethod === 'Other' && !comment.trim()) {
      newErrors.comment = 'Comment is required for "Other" payment method';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const calculateTotal = () => {
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const discountAmount = (subtotal * discount) / 100;
    return {
      subtotal,
      discountAmount,
      total: subtotal - discountAmount
    };
  };

  const { subtotal, discountAmount, total } = calculateTotal();

  const saveReceipt = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      await addDoc(collection(db, 'receipts'), {
        customerName,
        date: new Date().toISOString(),
        items,
        totalAmount: total,
        paymentMethod,
        chequeNumber: paymentMethod === 'Cheque' ? chequeNumber : '',
        comment: paymentMethod === 'Other' ? comment : '',
        discount: showDiscount ? discount : 0,
        discountAmount: showDiscount ? discountAmount : 0
      });
  
      alert('Receipt saved!');
    } catch (error) {
      console.error('Error saving receipt:', error);
      alert('Error saving receipt. Please try again.');
    }
  };

  return (
    <div>
      {!showPrint && (
        <div className="screen-only">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
              <input
                type="text"
                placeholder="Enter customer name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className={`w-full px-4 py-2 border rounded-md shadow-sm ${
                  errors.customerName ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.customerName && (
                <p className="mt-1 text-sm text-red-600">{errors.customerName}</p>
              )}
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 font-medium text-gray-700">
                <div className="px-3 py-2">Product Name</div>
                <div className="px-3 py-2">Quantity</div>
                <div className="px-3 py-2">Unit Price</div>
                <div className="px-3 py-2">Total</div>
              </div>
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <select
                      value={item.name}
                      onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-md shadow-sm ${
                        errors[`itemName${idx}`] ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select Product</option>
                      {inventoryProducts.map((product) => (
                        <option key={product.id} value={product.name}>
                          {product.name} (Available: {product.quantity})
                        </option>
                      ))}
                    </select>
                    {errors[`itemName${idx}`] && (
                      <p className="mt-1 text-sm text-red-600">{errors[`itemName${idx}`]}</p>
                    )}
                  </div>
                  <div>
                    <input
                      type="number"
                      placeholder="Quantity"
                      value={item.quantity || ''}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || '';
                        if (value === '' || value > 0) handleItemChange(idx, 'quantity', value);
                      }}
                      className={`w-full px-3 py-2 border rounded-md shadow-sm ${
                        errors[`itemQuantity${idx}`] ? 'border-red-500' : 'border-gray-300'
                      }`}
                      min="1"
                    />
                    {errors[`itemQuantity${idx}`] && (
                      <p className="mt-1 text-sm text-red-600">{errors[`itemQuantity${idx}`]}</p>
                    )}
                  </div>
                  <div>
                    <div className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50">
                      <div className="text-gray-700">Rs {item.price}</div>
                    </div>
                  </div>
                  <div>
                    <div className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50">
                      <div className="text-gray-700">Rs {item.quantity * item.price}</div>
                    </div>
                  </div>
                </div>
              ))}
              <button 
                onClick={addItem} 
                className="mt-2 bg-gray-100 hover:bg-gray-200 text-sm px-4 py-2 rounded-md shadow-sm transition-all"
              >
                + Add Item
              </button>

              <div className="mt-6 space-y-4">
                <div className="flex justify-between items-center">
                  <div className="text-gray-700">Subtotal:</div>
                  <div className="text-gray-700">Rs {subtotal}</div>
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
                    <div className="text-red-600">- Rs {discountAmount.toFixed(2)}</div>
                  )}
                </div>

                <div className="border-t pt-2">
                  <div className="flex justify-between items-center font-semibold">
                    <div className="text-gray-900">Total Amount:</div>
                    <div className="text-gray-900">Rs {total.toFixed(2)}</div>
                  </div>
                </div>
              </div>
            </div>

            <div>
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
              <div>
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
              <div>
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

            <div className="flex flex-col sm:flex-row gap-4">
              <button 
                onClick={saveReceipt} 
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md shadow-sm transition-all w-full sm:w-auto"
              >
                Save Receipt
              </button>
              <button
                onClick={handlePrint}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-md shadow-sm transition-all w-full sm:w-auto"
              >
                Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReceiptForm;