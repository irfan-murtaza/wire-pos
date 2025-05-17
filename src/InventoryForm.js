import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, where, addDoc, updateDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

function InventoryForm() {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [dateFilter, setDateFilter] = useState('all'); // 'all', 'today', 'yesterday', 'thisWeek', 'thisMonth'
  const [showUseModal, setShowUseModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [useQuantity, setUseQuantity] = useState('');
  const [dailySummary, setDailySummary] = useState({
    stockPurchased: 0,
    stockUsed: 0,
    remainingStock: 0
  });
  const [activeTab, setActiveTab] = useState('current'); // 'current' or 'use'
  const [usageHistory, setUsageHistory] = useState([]);
  const [showUseSuccess, setShowUseSuccess] = useState(false);

  // Month and year filter state
  const [stockMonthFilter, setStockMonthFilter] = useState(() => {
    const now = new Date();
    return now.getMonth(); // 0-based month index
  });
  const [stockYearFilter, setStockYearFilter] = useState(() => {
    return new Date().getFullYear();
  });

  useEffect(() => {
    fetchProducts();
    // Real-time usage history
    const usageQuery = query(collection(db, 'productUsage'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(usageQuery, (usageSnapshot) => {
      const usageList = usageSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsageHistory(usageList);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [searchQuery, products, dateFilter, selectedDate]);

  useEffect(() => {
    calculateDailySummary();
  }, [products]);

  const calculateDailySummary = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Fetch today's product usage
      const usageQuery = query(
        collection(db, 'productUsage'),
        where('date', '>=', today.toISOString())
      );
      const usageSnapshot = await getDocs(usageQuery);
      const todayUsage = usageSnapshot.docs.map(doc => doc.data());

      // Calculate total value of products used today
      const totalUsedValue = todayUsage.reduce((sum, usage) => sum + usage.totalValue, 0);

      // Calculate total value of products purchased today
      const totalPurchasedValue = products.reduce((sum, product) => {
        const purchasedToday = product.purchases?.filter(p => 
          new Date(p.date) >= today
        ).reduce((pSum, p) => pSum + p.totalValue, 0) || 0;
        return sum + purchasedToday;
      }, 0);

      // Calculate total value of remaining stock
      const totalRemainingValue = products.reduce((sum, product) => 
        sum + (product.quantity * product.unitPrice), 0
      );

      setDailySummary({
        stockPurchased: totalPurchasedValue,
        stockUsed: totalUsedValue,
        remainingStock: totalRemainingValue
      });
    } catch (error) {
      console.error('Error calculating daily summary:', error);
    }
  };

  const handleUseProduct = (product) => {
    setSelectedProduct(product);
    setUseQuantity('');
    setShowUseModal(true);
  };

  const handleUseSubmit = async (e) => {
    e.preventDefault();
    if (!useQuantity || useQuantity <= 0 || !selectedProduct || useQuantity > selectedProduct.quantity) {
      alert('Please enter a valid quantity');
      return;
    }

    try {
      const usageData = {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        quantity: Number(useQuantity),
        date: new Date().toISOString(),
        unitPrice: selectedProduct.unitPrice,
        totalValue: Number(useQuantity) * selectedProduct.unitPrice
      };

      // Add usage record
      await addDoc(collection(db, 'productUsage'), usageData);

      // Update product quantity
      const productRef = doc(db, 'supplierProducts', selectedProduct.id);
      await updateDoc(productRef, {
        quantity: selectedProduct.quantity - Number(useQuantity)
      });

      setShowUseModal(false);
      setShowUseSuccess(true);
      setTimeout(() => setShowUseSuccess(false), 3000);
      setUseQuantity('');
      setSelectedProduct(null);
      await fetchProducts(); // Refresh the products list
      await calculateDailySummary(); // Recalculate daily summary
    } catch (error) {
      console.error('Error recording product usage:', error);
      alert('Error recording product usage. Please try again.');
    }
  };

  const filterProducts = () => {
    let filtered = [...products];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(product => 
        product.name.toLowerCase().includes(query)
      );
    }

    // Apply date filter
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - today.getDay());
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    filtered = filtered.filter(product => {
      const productDate = new Date(product.createdAt);
      
      switch (dateFilter) {
        case 'today':
          return productDate >= today;
        case 'yesterday':
          return productDate >= yesterday && productDate < today;
        case 'thisWeek':
          return productDate >= thisWeekStart;
        case 'thisMonth':
          return productDate >= thisMonthStart;
        case 'custom':
          if (!selectedDate) return true;
          const filterDate = new Date(selectedDate);
          return productDate.toDateString() === filterDate.toDateString();
        default:
          return true;
      }
    });

    setFilteredProducts(filtered);
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleDateFilterChange = (e) => {
    setDateFilter(e.target.value);
    if (e.target.value !== 'custom') {
      setSelectedDate('');
    }
  };

  const handleCustomDateChange = (e) => {
    setSelectedDate(e.target.value);
    setDateFilter('custom');
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const productsQuery = query(collection(db, 'supplierProducts'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(productsQuery);
      
      // Get all suppliers for mapping supplier IDs to names
      const suppliersQuery = query(collection(db, 'suppliers'));
      const suppliersSnapshot = await getDocs(suppliersQuery);
      const suppliersMap = {};
      suppliersSnapshot.docs.forEach(doc => {
        suppliersMap[doc.id] = doc.data().name;
      });

      // Keep products separate by supplier
      const productsList = querySnapshot.docs.map(doc => {
        const product = doc.data();
        return {
          id: doc.id,
          name: product.name,
          quantity: product.quantity,
          unitPrice: product.unitPrice,
          totalValue: product.quantity * product.unitPrice,
          createdAt: product.createdAt,
          purchases: product.purchases || [],
          supplierId: product.supplierId,
          supplierName: suppliersMap[product.supplierId] || 'Unknown Supplier'
        };
      });

      setProducts(productsList);
      setFilteredProducts(productsList);
    } catch (error) {
      console.error('Error fetching products:', error);
      alert('Error fetching products. Please check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const totalInventoryValue = filteredProducts.reduce((sum, product) => sum + product.totalValue, 0);

  // Calculate total used per product
  const getTotalUsedForProduct = (productId) => {
    return usageHistory
      .filter(u => u.productId === productId)
      .reduce((sum, u) => sum + (u.quantity || 0), 0);
  };

  // Calculate total value used (all products)
  const totalValueUsed = usageHistory.reduce((sum, u) => sum + (u.totalValue || 0), 0);

  // Helper: get all years from products
  const getAvailableYears = () => {
    const years = new Set();
    products.forEach(p => {
      if (p.createdAt) {
        const d = new Date(p.createdAt);
        years.add(d.getFullYear());
      }
    });
    return Array.from(years).sort((a, b) => b - a); // Descending order
  };

  // Filter products for stock table by selected month and year
  const getMonthFilteredProducts = () => {
    return products.filter(p => {
      if (!p.createdAt) return false;
      const d = new Date(p.createdAt);
      return d.getFullYear() === stockYearFilter && d.getMonth() === stockMonthFilter;
    });
  };

  // Group products for display in stock table (use month-filtered products)
  const getGroupedProducts = () => {
    const groupMap = new Map();
    getMonthFilteredProducts().forEach(product => {
      const key = `${product.name}__${product.supplierName}__${product.unitPrice}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          ...product,
          quantity: 0,
          totalValue: 0
        });
      }
      const group = groupMap.get(key);
      group.quantity += product.quantity;
      group.totalValue += product.quantity * product.unitPrice;
    });
    return Array.from(groupMap.values());
  };

  // Group for Per Product Usage Summary (by product name only)
  const getProductUsageSummary = () => {
    // Map: productName -> { totalUsed, totalRemaining }
    const summaryMap = new Map();
    // Sum remaining for all products with same name
    products.forEach(product => {
      if (!summaryMap.has(product.name)) {
        summaryMap.set(product.name, { totalUsed: 0, totalRemaining: 0 });
      }
      summaryMap.get(product.name).totalRemaining += product.quantity;
    });
    // Sum used for all usage records with same product name
    usageHistory.forEach(u => {
      if (!summaryMap.has(u.productName)) {
        summaryMap.set(u.productName, { totalUsed: 0, totalRemaining: 0 });
      }
      summaryMap.get(u.productName).totalUsed += u.quantity;
    });
    // Return as array
    return Array.from(summaryMap.entries()).map(([name, { totalUsed, totalRemaining }]) => ({
      name,
      totalUsed,
      totalRemaining
    }));
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Success message for using stock */}
      {showUseSuccess && (
        <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
          Stock usage recorded successfully!
        </div>
      )}
      {/* Summary Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Inventory Summary</h3>
        <div className="flex flex-wrap gap-8 items-center">
          <div className="text-xl font-semibold text-purple-800">
            Total Value Remaining: {formatCurrency(dailySummary.remainingStock)}
          </div>
          <div className="text-xl font-semibold text-green-800">
            Total Value Used: {formatCurrency(totalValueUsed)}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('current')}
            className={`$ {
              activeTab === 'current'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium`}
          >
            Current Stock
          </button>
          <button
            onClick={() => setActiveTab('use')}
            className={`$ {
              activeTab === 'use'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium`}
          >
            Use Stock
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'current' && (
        <>
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold text-gray-800">Stock Management</h2>
            <div className="flex space-x-4">
              {/* Month and year filter dropdowns */}
              <select
                value={stockMonthFilter}
                onChange={e => setStockMonthFilter(Number(e.target.value))}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                {monthNames.map((m, idx) => (
                  <option key={m} value={idx}>{m}</option>
                ))}
              </select>
              <select
                value={stockYearFilter}
                onChange={e => setStockYearFilter(Number(e.target.value))}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                {getAvailableYears().map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <select
                value={dateFilter}
                onChange={handleDateFilterChange}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="thisWeek">This Week</option>
                <option value="thisMonth">This Month</option>
                <option value="custom">Custom Date</option>
              </select>
              {dateFilter === 'custom' && (
                <input
                  type="date"
                  value={selectedDate}
                  onChange={handleCustomDateChange}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              )}
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-64 px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Price (PKR)</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Value (PKR)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Added Date</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {getGroupedProducts().map((product, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {product.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.supplierName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                      {Math.round(product.quantity)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {formatCurrency(product.unitPrice)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {formatCurrency(product.totalValue)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.createdAt ? new Date(product.createdAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                      <button
                        onClick={() => handleUseProduct(product)}
                        className="text-blue-600 hover:text-blue-800"
                        disabled={product.quantity <= 0}
                      >
                        Use Product
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan="6" className="px-6 py-4 text-sm font-medium text-gray-900 text-right">
                    Total Inventory Value:
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 text-right">
                    {formatCurrency(getGroupedProducts().reduce((sum, product) => sum + product.totalValue, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
      {activeTab === 'use' && (
        <div className="space-y-6">
          {/* Use Stock Form (reuse modal or inline form) */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Use Stock</h3>
            <form onSubmit={handleUseSubmit} className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
                <select
                  value={selectedProduct ? selectedProduct.id : ''}
                  onChange={e => {
                    const prod = products.find(p => p.id === e.target.value);
                    setSelectedProduct(prod || null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select product</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Available</label>
                <div className="px-4 py-2 border border-gray-200 rounded-md bg-gray-50 min-w-[60px]">
                  {selectedProduct ? selectedProduct.quantity : '-'}
                </div>
              </div>
              {selectedProduct && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                    <div className="px-4 py-2 border border-gray-200 rounded-md bg-gray-50 min-w-[100px]">
                      {selectedProduct.supplierName}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price</label>
                    <div className="px-4 py-2 border border-gray-200 rounded-md bg-gray-50 min-w-[80px]">
                      {formatCurrency(selectedProduct.unitPrice)}
                    </div>
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity to Use</label>
                <input
                  type="number"
                  value={useQuantity}
                  onChange={e => setUseQuantity(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  min="1"
                  max={selectedProduct ? selectedProduct.quantity : undefined}
                  required
                  disabled={!selectedProduct}
                />
              </div>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md shadow-sm transition-all"
                disabled={!selectedProduct || !useQuantity}
              >
                Use Stock
              </button>
            </form>
          </div>

          {/* Per-product summary */}
          <div className="bg-white rounded-lg shadow p-6 mt-6">
            <h4 className="text-md font-semibold mb-2">Per Product Usage Summary</h4>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Used</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Remaining</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {getProductUsageSummary().map((row, idx) => (
                  <tr key={row.name + idx}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{row.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{row.totalUsed}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{row.totalRemaining}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Usage History Table (now below per-product summary) */}
          <div className="bg-white rounded-lg shadow overflow-hidden mt-6">
            <div className="p-4 font-semibold text-lg">Usage History</div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity Used</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Value</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {usageHistory.map((u, idx) => (
                  <tr key={u.id || idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{u.productName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{u.quantity}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(u.unitPrice)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(u.totalValue)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(u.date).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Use Product Modal */}
      {showUseModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Use Product</h3>
              <button
                onClick={() => setShowUseModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleUseSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product: {selectedProduct.name}
                </label>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Available Quantity: {selectedProduct.quantity}
                </label>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity to Use
                </label>
                <input
                  type="number"
                  value={useQuantity}
                  onChange={(e) => setUseQuantity(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  min="1"
                  max={selectedProduct.quantity}
                  required
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowUseModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md shadow-sm transition-all"
                >
                  Confirm Use
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default InventoryForm; 