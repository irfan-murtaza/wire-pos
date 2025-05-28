import React, { useState } from 'react';

function EditSaleModal({ sale, onSave, onClose }) {
  const [form, setForm] = useState({ ...sale });
  const [errors, setErrors] = useState({});

  const handleItemChange = (idx, field, value) => {
    const items = [...form.items];
    items[idx] = { ...items[idx], [field]: value };
    setForm({ ...form, items });
  };

  const handleAddItem = () => {
    setForm({ ...form, items: [...form.items, { name: '', quantity: 1, price: 0 }] });
  };

  const handleRemoveItem = (idx) => {
    if (form.items.length > 1) {
      setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });
    }
  };

  const handleChange = (field, value) => {
    setForm({ ...form, [field]: value });
  };

  const validate = () => {
    const errs = {};
    if (!form.customerName.trim()) errs.customerName = 'Name required';
    if (!/^\d{11}$/.test(form.customerPhone)) errs.customerPhone = 'Phone must be 11 digits';
    form.items.forEach((item, idx) => {
      if (!item.name) errs[`itemName${idx}`] = 'Product name required';
      if (!item.quantity || item.quantity <= 0) errs[`itemQuantity${idx}`] = 'Quantity > 0';
      if (!item.price || item.price < 0) errs[`itemPrice${idx}`] = 'Price >= 0';
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    // Calculate totals
    const subtotal = form.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const discountAmount = (subtotal * (form.discount || 0)) / 100;
    const totalAmount = subtotal - discountAmount;
    const remainingAmount = totalAmount - (form.paidAmount || 0);
    onSave({
      ...form,
      subtotal,
      discountAmount,
      totalAmount,
      remainingAmount,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Edit Sale (Bill No: {form.billNumber})</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input type="text" value={form.customerName} onChange={e => handleChange('customerName', e.target.value)} className={`w-full px-3 py-2 border rounded-md shadow-sm ${errors.customerName ? 'border-red-500' : 'border-gray-300'}`} />
              {errors.customerName && <p className="text-sm text-red-600">{errors.customerName}</p>}
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input type="text" value={form.customerPhone} onChange={e => handleChange('customerPhone', e.target.value.replace(/\D/g, '').slice(0, 11))} className={`w-full px-3 py-2 border rounded-md shadow-sm ${errors.customerPhone ? 'border-red-500' : 'border-gray-300'}`} maxLength={11} />
              {errors.customerPhone && <p className="text-sm text-red-600">{errors.customerPhone}</p>}
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Builte No</label>
              <input type="text" value={form.builteNo || ''} onChange={e => handleChange('builteNo', e.target.value)} className="w-full px-3 py-2 border rounded-md shadow-sm border-gray-300" maxLength={50} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Items</label>
            <div className="flex gap-2 mb-1 font-semibold text-gray-700 text-sm">
              <span className="w-32">Product Name</span>
              <span className="w-20">Quantity</span>
              <span className="w-24">Per Unit Price</span>
              <span className="w-24">Total</span>
            </div>
            {form.items.map((item, idx) => (
              <div key={idx} className="flex gap-2 mb-2 items-center">
                <input type="text" value={item.name} onChange={e => handleItemChange(idx, 'name', e.target.value)} placeholder="Product name" className={`w-32 px-2 py-1 border rounded-md ${errors[`itemName${idx}`] ? 'border-red-500' : 'border-gray-300'}`} />
                <input type="number" value={item.quantity} onChange={e => handleItemChange(idx, 'quantity', parseInt(e.target.value) || 0)} placeholder="Qty" className={`w-20 px-2 py-1 border rounded-md ${errors[`itemQuantity${idx}`] ? 'border-red-500' : 'border-gray-300'}`} min="1" />
                <input type="number" value={item.price} onChange={e => handleItemChange(idx, 'price', parseInt(e.target.value) || 0)} placeholder="Price" className={`w-24 px-2 py-1 border rounded-md ${errors[`itemPrice${idx}`] ? 'border-red-500' : 'border-gray-300'}`} min="0" />
                <span className="w-24 text-gray-500">= {Math.round(item.quantity * item.price)}</span>
                {form.items.length > 1 && (
                  <button type="button" onClick={() => handleRemoveItem(idx)} className="text-red-600 hover:text-red-800 ml-2">✕</button>
                )}
                {errors[`itemName${idx}`] && <span className="text-xs text-red-600 ml-1">{errors[`itemName${idx}`]}</span>}
                {errors[`itemQuantity${idx}`] && <span className="text-xs text-red-600 ml-1">{errors[`itemQuantity${idx}`]}</span>}
                {errors[`itemPrice${idx}`] && <span className="text-xs text-red-600 ml-1">{errors[`itemPrice${idx}`]}</span>}
              </div>
            ))}
            <button type="button" onClick={handleAddItem} className="mt-1 text-blue-600 hover:text-blue-800 text-sm">+ Add Item</button>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
              <select value={form.paymentMethod} onChange={e => handleChange('paymentMethod', e.target.value)} className="w-full px-3 py-2 border rounded-md shadow-sm">
                <option>Cash</option>
                <option>Card</option>
                <option>Cheque</option>
                <option>Other</option>
              </select>
            </div>
            {form.paymentMethod === 'Cheque' && (
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Cheque Number</label>
                <input type="text" value={form.chequeNumber} onChange={e => handleChange('chequeNumber', e.target.value)} className="w-full px-3 py-2 border rounded-md shadow-sm" />
              </div>
            )}
            {form.paymentMethod === 'Other' && (
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Comment</label>
                <input type="text" value={form.comment} onChange={e => handleChange('comment', e.target.value)} className="w-full px-3 py-2 border rounded-md shadow-sm" />
              </div>
            )}
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Discount (%)</label>
              <input type="number" value={form.discount || 0} onChange={e => handleChange('discount', parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border rounded-md shadow-sm" min="0" max="100" />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Paid Amount</label>
              <input type="number" value={form.paidAmount || 0} onChange={e => handleChange('paidAmount', parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border rounded-md shadow-sm" min="0" />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input type="datetime-local" value={form.date ? form.date.slice(0, 16) : ''} onChange={e => handleChange('date', e.target.value)} className="w-full px-3 py-2 border rounded-md shadow-sm" />
            </div>
          </div>
          <div className="flex justify-end space-x-3 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditSaleModal; 