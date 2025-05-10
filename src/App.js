import React, { useEffect, useState } from 'react';
import SalesTable from './SalesTable';
import ReceiptForm from './ReceiptForm';
import InventoryForm from './InventoryForm';
import SupplierManagement from './SupplierManagement';
import CustomerManagement from './CustomerManagement';
import AuthForm from './AuthForm';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';

function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('receipt');
  const [showReceiptForm, setShowReceiptForm] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  const handleAddNewSale = () => {
    setShowReceiptForm(true);
  };

  const handleCloseReceiptForm = () => {
    setShowReceiptForm(false);
  };

  const handleSaveReceipt = () => {
    setShowReceiptForm(false);
    setRefreshTrigger(prev => prev + 1);
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 3000);
  };

  if (!user) return <AuthForm />;

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">AAF Cables</h1>
          <button onClick={() => signOut(auth)} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md shadow-sm transition-all">Logout</button>
        </div>
        
        <div className="mb-6">
          <div className="flex space-x-4">
            <button
              onClick={() => setActiveTab('receipt')}
              className={`px-4 py-2 rounded-md transition-all ${
                activeTab === 'receipt'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Sales
            </button>
            <button
              onClick={() => setActiveTab('inventory')}
              className={`px-4 py-2 rounded-md transition-all ${
                activeTab === 'inventory'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Inventory
            </button>
            <button
              onClick={() => setActiveTab('suppliers')}
              className={`px-4 py-2 rounded-md transition-all ${
                activeTab === 'suppliers'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Suppliers
            </button>
            <button
              onClick={() => setActiveTab('customers')}
              className={`px-4 py-2 rounded-md transition-all ${
                activeTab === 'customers'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Customers
            </button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-md">
          {showSuccessMessage && (
            <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
              Sale added successfully!
            </div>
          )}
          {activeTab === 'receipt' ? (
            <>
              <SalesTable 
                onAddNewSale={handleAddNewSale} 
                refreshTrigger={refreshTrigger}
              />
              <ReceiptForm
                isOpen={showReceiptForm}
                onClose={handleCloseReceiptForm}
                onSave={handleSaveReceipt}
              />
            </>
          ) : activeTab === 'inventory' ? (
            <InventoryForm />
          ) : activeTab === 'suppliers' ? (
            <SupplierManagement />
          ) : (
            <CustomerManagement />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;