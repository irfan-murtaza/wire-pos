import React, { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from './firebase';
import { generatePrintableHTML } from './PrintableReceipt';

import { useRef, useEffect } from 'react';


function ReceiptForm() {
  const hasPrintedRef = useRef(false);
  const [showPrint, setShowPrint] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [comment, setComment] = useState('');
  const [chequeNumber, setChequeNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [items, setItems] = useState([{ name: '', quantity: 1, price: 0 }]);

  useEffect(() => {
    if (showPrint && !hasPrintedRef.current) {
      hasPrintedRef.current = true;
      setTimeout(() => {
        window.print();
        setShowPrint(false);
        hasPrintedRef.current = false; // reset after print
      }, 100);
    }
  }, [showPrint]);

  const handlePrint = () => {
    const html = generatePrintableHTML({
      customerName,
      items,
      totalAmount,
      date: new Date().toISOString(),
      paymentMethod,
      chequeNumber,
      comment
    });
  
    const printWindow = window.open('', '_blank', 'width=800,height=600');
  
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  
    // Wait until the content is loaded before triggering print
    printWindow.onload = function () {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    };
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { name: '', quantity: 1, price: 0 }]);
  };

  const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);

  const saveReceipt = async () => {
    if (!customerName.trim()) {
      alert('Customer name is required.');
      return;
    }
  
    for (let i = 0; i < items.length; i++) {
      const { name, quantity, price } = items[i];
      if (!name.trim()) {
        alert(`Product name is required for item ${i + 1}.`);
        return;
      }
      if (!quantity || quantity <= 0) {
        alert(`Quantity must be greater than 0 for item ${i + 1}.`);
        return;
      }
      if (!price || price <= 0) {
        alert(`Price must be greater than 0 for item ${i + 1}.`);
        return;
      }
    }
  
    if (paymentMethod === 'Cheque' && !chequeNumber.trim()) {
      alert('Cheque number is required for cheque payments.');
      return;
    }

    if (paymentMethod === 'Other' && !comment.trim()) {
      alert('Comment is required for "Other" payment method.');
      return;
    }
  
    await addDoc(collection(db, 'receipts'), {
      customerName,
      date: new Date().toISOString(),
      items,
      totalAmount,
      paymentMethod,
      chequeNumber: paymentMethod === 'Cheque' ? chequeNumber : '',
      comment: paymentMethod === 'Other' ? comment : ''
    });
  
    alert('Receipt saved!');
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
            className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring focus:ring-blue-200"
          />
        </div>

        <div className="space-y-4">
          {items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="Product Name"
                value={item.name}
                onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                className="px-3 py-2 border rounded-md border-gray-300 shadow-sm"
              />
              <input
                type="number"
                placeholder="Quantity"
                value={item.quantity || ''}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || '';
                  if (value === '' || value > 0) handleItemChange(idx, 'quantity', value);
                }}
                className="px-3 py-2 border rounded-md border-gray-300 shadow-sm"
              />

              <input
                type="number"
                placeholder="Price"
                value={item.price || ''}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || '';
                  if (value === '' || value > 0) handleItemChange(idx, 'price', value);
                }}
                className="px-3 py-2 border rounded-md border-gray-300 shadow-sm"
              />
            </div>
          ))}
          <button onClick={addItem} className="mt-2 bg-gray-100 hover:bg-gray-200 text-sm px-4 py-2 rounded-md shadow-sm transition-all">+ Add Item</button>
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
              className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm"
            />
          </div>
        )}

        {paymentMethod === 'Other' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Comment</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Enter comment for payment"
              className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm"
              rows={3}
            />
          </div>
        )}

        <div className="text-lg font-semibold">Total: Rs {totalAmount}</div>

        <div className="flex flex-col sm:flex-row gap-4">
          <button onClick={saveReceipt} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md shadow-sm transition-all w-full sm:w-auto">Save Receipt</button>
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


      {/* {showPrint && (
        <div className="print-only">
          <PrintableReceipt
            customerName={customerName}
            items={items}
            totalAmount={totalAmount}
            date={new Date().toISOString()}
            paymentMethod={paymentMethod}
            chequeNumber={chequeNumber}
            comment={comment}
          />
        </div>
      )} */}
  </div>
  );
} 

export default ReceiptForm;