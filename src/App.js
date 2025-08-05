import React, { useEffect, useState } from 'react';
import SalesTable from './SalesTable';
import ReceiptForm from './ReceiptForm';
import InventoryForm from './InventoryForm';
import SupplierManagement from './SupplierManagement';
import CustomerManagement from './CustomerManagement';
import CustomerMonthlyReport from './CustomerMonthlyReport';
import ProfitLossSummary from './ProfitLossSummary';
import AuthForm from './AuthForm';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import MiscellaneousPayments from './MiscellaneousPayments';

function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('profit-loss');
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
    <div className="min-h-screen bg-gray-100">
      <div className="py-10">
        <header>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center">
              <h1 className="text-3xl font-bold leading-tight tracking-tight text-gray-900">
                Wire Management System
              </h1>
              <button
                onClick={() => signOut(auth)}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md shadow-sm transition-all"
              >
                Logout
              </button>
            </div>
          </div>
        </header>
        <main>
          <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
            <div className="px-4 py-8 sm:px-0">
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                <button
                    onClick={() => setActiveTab('profit-loss')}
                    className={`${
                      activeTab === 'profit-loss'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium`}
                  >
                    Profit & Loss
                  </button>
                  <button
                    onClick={() => setActiveTab('sales')}
                    className={`${
                      activeTab === 'sales'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium`}
                  >
                    Sales
                  </button>
                  <button
                    onClick={() => setActiveTab('inventory')}
                    className={`${
                      activeTab === 'inventory'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium`}
                  >
                    Stock
                  </button>
                  <button
                    onClick={() => setActiveTab('customers')}
                    className={`${
                      activeTab === 'customers'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium`}
                  >
                    Customers
                  </button>
                  <button
                    onClick={() => setActiveTab('customer-monthly')}
                    className={`${
                      activeTab === 'customer-monthly'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium`}
                  >
                    Customer Monthly Report
                  </button>
                  <button
                    onClick={() => setActiveTab('suppliers')}
                    className={`${
                      activeTab === 'suppliers'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium`}
                  >
                    Suppliers
                  </button>
                
                  <button
                    onClick={() => setActiveTab('miscellaneous')}
                    className={`${
                      activeTab === 'miscellaneous'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium`}
                  >
                    Miscellaneous
                  </button>
                </nav>
              </div>

              <div className="mt-6">
                {showSuccessMessage && (
                  <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
                    Sale added successfully!
                  </div>
                )}
                {activeTab === 'sales' && (
                  <>
                    <div className="mb-4">
                      <button
                        onClick={handleAddNewSale}
                        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                      >
                        Add New Sale
                      </button>
                    </div>
                    <SalesTable refreshTrigger={refreshTrigger} />
                    <ReceiptForm
                      isOpen={showReceiptForm}
                      onClose={handleCloseReceiptForm}
                      onSave={handleSaveReceipt}
                    />
                  </>
                )}
                {activeTab === 'inventory' && <InventoryForm />}
                {activeTab === 'customers' && <CustomerManagement />}
                {activeTab === 'customer-monthly' && <CustomerMonthlyReport />}
                {activeTab === 'suppliers' && <SupplierManagement />}
                {activeTab === 'profit-loss' && <ProfitLossSummary />}
                {activeTab === 'miscellaneous' && <MiscellaneousPayments />}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;