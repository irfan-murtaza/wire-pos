import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from './firebase';

function MiscellaneousPayments() {
  const [payments, setPayments] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPayment, setNewPayment] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    type: '',
    details: ''
  });
  const [errors, setErrors] = useState({});
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );

  useEffect(() => {
    fetchPayments();
  }, [selectedMonth]);

  const fetchPayments = async () => {
    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      const paymentsQuery = query(
        collection(db, 'miscellaneousPayments'),
        orderBy('date', 'desc')
      );
      const querySnapshot = await getDocs(paymentsQuery);
      const paymentsList = querySnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter(payment => {
          const paymentDate = new Date(payment.date);
          return paymentDate >= startDate && paymentDate <= endDate;
        });
      setPayments(paymentsList);
    } catch (error) {
      console.error('Error fetching payments:', error);
      alert('Error fetching payments. Please check console for details.');
    }
  };

  const validatePayment = () => {
    const newErrors = {};
    if (!newPayment.amount || parseFloat(newPayment.amount) <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }
    if (!newPayment.date) {
      newErrors.date = 'Date is required';
    }
    if (!newPayment.type.trim()) {
      newErrors.type = 'Payment type is required';
    }
    if (!newPayment.details.trim()) {
      newErrors.details = 'Payment details are required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddPayment = async () => {
    if (!validatePayment()) return;

    try {
      await addDoc(collection(db, 'miscellaneousPayments'), {
        ...newPayment,
        amount: parseFloat(newPayment.amount),
        createdAt: new Date().toISOString()
      });
      
      setShowAddModal(false);
      setNewPayment({
        amount: '',
        date: new Date().toISOString().split('T')[0],
        type: '',
        details: ''
      });
      fetchPayments();
    } catch (error) {
      console.error('Error adding payment:', error);
      alert('Error adding payment. Please check console for details.');
    }
  };

  const formatCurrency = amount =>
    new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Miscellaneous Payments</h2>
        <div className="flex gap-4">
          <input
            type="month"
            className="block w-48 rounded-md border-gray-300 shadow-sm"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
          />
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Add Payment
          </button>
        </div>
      </div>

      <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Date</th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Type</th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Details</th>
              <th className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {payments.map(payment => (
              <tr key={payment.id}>
                <td className="px-3 py-4 text-sm text-gray-900">
                  {formatDate(payment.date)}
                </td>
                <td className="px-3 py-4 text-sm text-gray-900">
                  {payment.type}
                </td>
                <td className="px-3 py-4 text-sm text-gray-900">
                  {payment.details}
                </td>
                <td className="px-3 py-4 text-sm text-right text-red-600">
                  ({formatCurrency(payment.amount)})
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr>
                <td colSpan="4" className="px-3 py-4 text-sm text-center text-gray-500">
                  No payments found for this month
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium mb-4">Add Miscellaneous Payment</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Amount</label>
                <input
                  type="number"
                  value={newPayment.amount}
                  onChange={e => setNewPayment({ ...newPayment, amount: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                />
                {errors.amount && (
                  <p className="mt-1 text-sm text-red-600">{errors.amount}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Date</label>
                <input
                  type="date"
                  value={newPayment.date}
                  onChange={e => setNewPayment({ ...newPayment, date: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                />
                {errors.date && (
                  <p className="mt-1 text-sm text-red-600">{errors.date}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Payment Type</label>
                <input
                  type="text"
                  value={newPayment.type}
                  onChange={e => setNewPayment({ ...newPayment, type: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                  placeholder="e.g., Rent, Utilities, Maintenance"
                />
                {errors.type && (
                  <p className="mt-1 text-sm text-red-600">{errors.type}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Details</label>
                <textarea
                  value={newPayment.details}
                  onChange={e => setNewPayment({ ...newPayment, details: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                  rows="3"
                />
                {errors.details && (
                  <p className="mt-1 text-sm text-red-600">{errors.details}</p>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleAddPayment}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                Add Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MiscellaneousPayments; 