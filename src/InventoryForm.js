import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Timestamp } from 'firebase/firestore';

function InventoryForm() {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showIncreaseModal, setShowIncreaseModal] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errors, setErrors] = useState({});
  const [editingProduct, setEditingProduct] = useState(null);
  const [increasingProduct, setIncreasingProduct] = useState(null);
  const [newQuantity, setNewQuantity] = useState(0);
  const [newProduct, setNewProduct] = useState({
    name: '',
    unit: 'Roll',
    quantity: 0,
    unitPrice: 0,
    totalValue: 0
  });

  const units = [
    'Roll',
    'Meters',
    'Foot',
    'Kilometer',
    'Yard',
    'Bundle',
    'Coil',
    'Drum',
    'Box',
    'Piece',
    'Set',
    'Pair',
    'Spool',
    'Reel',
    'Carton'
  ];

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [searchQuery, products]);

  const filterProducts = () => {
    if (!searchQuery.trim()) {
      setFilteredProducts(products);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = products.filter(product => 
      product.name.toLowerCase().includes(query)
    );
    setFilteredProducts(filtered);
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const validateForm = (product) => {
    const newErrors = {};
    
    if (!product.name.trim()) {
      newErrors.name = 'Product name is required';
    }
    
    if (products.some(p => 
      p.name.toLowerCase() === product.name.toLowerCase() && 
      (!editingProduct || p.id !== editingProduct.id)
    )) {
      newErrors.name = 'Product with this name already exists';
    }
    
    if (product.quantity <= 0) {
      newErrors.quantity = 'Quantity must be greater than 0';
    }
    
    if (product.unitPrice <= 0) {
      newErrors.unitPrice = 'Unit price must be greater than 0';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const fetchProducts = async () => {
    try {
      const productsCollection = collection(db, 'products');
      const querySnapshot = await getDocs(productsCollection);
      const productsList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProducts(productsList);
      setFilteredProducts(productsList);
    } catch (error) {
      console.error('Error fetching products:', error);
      alert('Error fetching products. Please check console for details.');
    }
  };

  const handleInputChange = (e, isEdit = false) => {
    const { name, value } = e.target;
    if (isEdit) {
      setEditingProduct(prev => {
        const updated = { ...prev, [name]: value };
        if (name === 'quantity' || name === 'unitPrice') {
          updated.totalValue = updated.quantity * updated.unitPrice;
        }
        return updated;
      });
    } else {
      setNewProduct(prev => {
        const updated = { ...prev, [name]: value };
        if (name === 'quantity' || name === 'unitPrice') {
          updated.totalValue = updated.quantity * updated.unitPrice;
        }
        return updated;
      });
    }
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleEdit = (product) => {
    setEditingProduct({ ...product });
    setShowEditModal(true);
  };

  const updateProduct = async (e) => {
    e.preventDefault();
    
    if (!validateForm(editingProduct)) {
      return;
    }

    try {
      const productDoc = doc(db, 'products', editingProduct.id);
      await updateDoc(productDoc, {
        name: editingProduct.name,
        unit: editingProduct.unit,
        quantity: editingProduct.quantity,
        unitPrice: editingProduct.unitPrice,
        totalValue: editingProduct.quantity * editingProduct.unitPrice
      });
      
      setShowEditModal(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      fetchProducts();
    } catch (error) {
      console.error('Error updating product:', error);
      alert('Error updating product. Please try again.');
    }
  };

  const addProduct = async (e) => {
    e.preventDefault();
    
    if (!validateForm(newProduct)) {
      return;
    }

    try {
      const productsCollection = collection(db, 'products');
      await addDoc(productsCollection, {
        ...newProduct,
        totalValue: newProduct.quantity * newProduct.unitPrice
      });
      
      setNewProduct({
        name: '',
        unit: 'Roll',
        quantity: 0,
        unitPrice: 0,
        totalValue: 0
      });
      setShowModal(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      fetchProducts();
    } catch (error) {
      console.error('Error adding product:', error);
      alert('Error adding product. Please check console for details.');
    }
  };

  const deleteProduct = async (id) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        const productDoc = doc(db, 'products', id);
        await deleteDoc(productDoc);
        fetchProducts();
      } catch (error) {
        console.error('Error deleting product:', error);
        alert('Error deleting product. Please try again.');
      }
    }
  };

  const handleIncreaseQuantity = (product) => {
    setIncreasingProduct(product);
    setNewQuantity(0);
    setShowIncreaseModal(true);
  };

  const updateQuantity = async (e) => {
    e.preventDefault();
    
    if (newQuantity <= 0) {
      setErrors({ quantity: 'Quantity must be greater than 0' });
      return;
    }

    try {
      const productDoc = doc(db, 'products', increasingProduct.id);
      const updatedQuantity = increasingProduct.quantity + Number(newQuantity);
      await updateDoc(productDoc, {
        quantity: updatedQuantity,
        totalValue: updatedQuantity * increasingProduct.unitPrice
      });
      
      setShowIncreaseModal(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      fetchProducts();
    } catch (error) {
      console.error('Error updating quantity:', error);
      alert('Error updating quantity. Please try again.');
    }
  };

  const totalInventoryValue = filteredProducts.reduce((sum, product) => sum + product.totalValue, 0);

  return (
    <div className="space-y-6">
      {showSuccess && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50">
          {editingProduct ? 'Product updated successfully!' : 
           increasingProduct ? 'Quantity increased successfully!' : 
           'Product added successfully!'}
        </div>
      )}

      <div className="bg-white p-6 rounded-xl shadow-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Inventory Summary</h2>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md shadow-sm transition-all"
          >
            Add Product
          </button>
        </div>

        <div className="mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="w-full sm:w-64">
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring focus:ring-blue-200"
              />
            </div>
            <p className="text-lg font-semibold">Total Inventory Value: Rs {totalInventoryValue.toFixed(2)}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Value</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProducts.map((product) => (
                <tr key={product.id}>
                  <td className="px-6 py-4 whitespace-nowrap">{product.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{product.unit}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{product.quantity}</td>
                  <td className="px-6 py-4 whitespace-nowrap">Rs {product.unitPrice}</td>
                  <td className="px-6 py-4 whitespace-nowrap">Rs {product.totalValue}</td>
                  <td className="px-6 py-4 whitespace-nowrap space-x-2">
                    <button
                      onClick={() => handleIncreaseQuantity(product)}
                      className="text-green-600 hover:text-green-900"
                    >
                      Increase Quantity
                    </button>
                    <button
                      onClick={() => handleEdit(product)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteProduct(product.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                    {searchQuery ? 'No products found matching your search' : 'No products available'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-md w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Add New Product</h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setErrors({});
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <form onSubmit={addProduct} className="space-y-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                  <input
                    type="text"
                    name="name"
                    value={newProduct.name}
                    onChange={(e) => handleInputChange(e)}
                    className={`w-full px-4 py-2 border rounded-md shadow-sm ${
                      errors.name ? 'border-red-500' : 'border-gray-300'
                    }`}
                    required
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <select
                    name="unit"
                    value={newProduct.unit}
                    onChange={(e) => handleInputChange(e)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm"
                    required
                  >
                    {units.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    name="quantity"
                    value={newProduct.quantity}
                    onChange={(e) => handleInputChange(e)}
                    className={`w-full px-4 py-2 border rounded-md shadow-sm ${
                      errors.quantity ? 'border-red-500' : 'border-gray-300'
                    }`}
                    min="0"
                    required
                  />
                  {errors.quantity && (
                    <p className="mt-1 text-sm text-red-600">{errors.quantity}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price (Rs)</label>
                  <input
                    type="number"
                    name="unitPrice"
                    value={newProduct.unitPrice}
                    onChange={(e) => handleInputChange(e)}
                    className={`w-full px-4 py-2 border rounded-md shadow-sm ${
                      errors.unitPrice ? 'border-red-500' : 'border-gray-300'
                    }`}
                    min="0"
                    required
                  />
                  {errors.unitPrice && (
                    <p className="mt-1 text-sm text-red-600">{errors.unitPrice}</p>
                  )}
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setErrors({});
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md shadow-sm transition-all"
                >
                  Add Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && editingProduct && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-md w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Edit Product</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setErrors({});
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <form onSubmit={updateProduct} className="space-y-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                  <input
                    type="text"
                    name="name"
                    value={editingProduct.name}
                    onChange={(e) => handleInputChange(e, true)}
                    className={`w-full px-4 py-2 border rounded-md shadow-sm ${
                      errors.name ? 'border-red-500' : 'border-gray-300'
                    }`}
                    required
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <select
                    name="unit"
                    value={editingProduct.unit}
                    onChange={(e) => handleInputChange(e, true)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm"
                    required
                  >
                    {units.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    name="quantity"
                    value={editingProduct.quantity}
                    onChange={(e) => handleInputChange(e, true)}
                    className={`w-full px-4 py-2 border rounded-md shadow-sm ${
                      errors.quantity ? 'border-red-500' : 'border-gray-300'
                    }`}
                    min="0"
                    required
                  />
                  {errors.quantity && (
                    <p className="mt-1 text-sm text-red-600">{errors.quantity}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price (Rs)</label>
                  <input
                    type="number"
                    name="unitPrice"
                    value={editingProduct.unitPrice}
                    onChange={(e) => handleInputChange(e, true)}
                    className={`w-full px-4 py-2 border rounded-md shadow-sm ${
                      errors.unitPrice ? 'border-red-500' : 'border-gray-300'
                    }`}
                    min="0"
                    required
                  />
                  {errors.unitPrice && (
                    <p className="mt-1 text-sm text-red-600">{errors.unitPrice}</p>
                  )}
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setErrors({});
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md shadow-sm transition-all"
                >
                  Update Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showIncreaseModal && increasingProduct && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-md w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Increase Quantity</h2>
              <button
                onClick={() => {
                  setShowIncreaseModal(false);
                  setErrors({});
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <form onSubmit={updateQuantity} className="space-y-4">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-2">Current Quantity: {increasingProduct.quantity}</p>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity to Add</label>
                  <input
                    type="number"
                    value={newQuantity}
                    onChange={(e) => {
                      setNewQuantity(e.target.value);
                      if (errors.quantity) {
                        setErrors(prev => ({ ...prev, quantity: '' }));
                      }
                    }}
                    className={`w-full px-4 py-2 border rounded-md shadow-sm ${
                      errors.quantity ? 'border-red-500' : 'border-gray-300'
                    }`}
                    min="1"
                    required
                  />
                  {errors.quantity && (
                    <p className="mt-1 text-sm text-red-600">{errors.quantity}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-600">
                    New Total Quantity: {increasingProduct.quantity + Number(newQuantity || 0)}
                  </p>
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowIncreaseModal(false);
                    setErrors({});
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md shadow-sm transition-all"
                >
                  Update Quantity
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