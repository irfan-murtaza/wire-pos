import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, where, addDoc, updateDoc, doc } from 'firebase/firestore';
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

  useEffect(() => {
    fetchProducts();
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
    if (!useQuantity || useQuantity <= 0 || useQuantity > selectedProduct.quantity) {
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Daily Summary Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Today's Summary</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-sm text-blue-600">Stock Purchased Today</div>
            <div className="text-xl font-semibold text-blue-800">{formatCurrency(dailySummary.stockPurchased)}</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-sm text-green-600">Stock Used Today</div>
            <div className="text-xl font-semibold text-green-800">{formatCurrency(dailySummary.stockUsed)}</div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="text-sm text-purple-600">Remaining Stock Value</div>
            <div className="text-xl font-semibold text-purple-800">{formatCurrency(dailySummary.remainingStock)}</div>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-gray-800">Stock Management</h2>
        <div className="flex space-x-4">
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
            {filteredProducts.map((product, index) => (
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
                  {formatCurrency(product.quantity * product.unitPrice)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(product.createdAt).toLocaleDateString()}
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
                {formatCurrency(filteredProducts.reduce((sum, product) => sum + (product.quantity * product.unitPrice), 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

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