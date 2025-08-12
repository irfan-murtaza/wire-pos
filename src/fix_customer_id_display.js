// Script to fix customer ID display and migration
import { collection, getDocs, query, orderBy, updateDoc, doc } from 'firebase/firestore';
import { db } from './firebase';

// Function to migrate all customer IDs to simple sequential numbers (1, 2, 3, etc.)
export const fixCustomerIds = async () => {
  try {
    console.log('Starting customer ID fix...');
    
    const allReceiptsQuery = query(collection(db, 'receipts'), orderBy('date', 'desc'));
    const querySnapshot = await getDocs(allReceiptsQuery);
    
    const receiptsToUpdate = [];
    const customerIdMap = new Map(); // Map phone numbers to customer IDs
    let nextId = 1;
    
    querySnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.customerPhone) {
        receiptsToUpdate.push({ id: doc.id, data });
      }
    });
    
    console.log(`Found ${receiptsToUpdate.length} receipts to update`);
    
    // Process receipts in batches
    const batchSize = 10;
    for (let i = 0; i < receiptsToUpdate.length; i += batchSize) {
      const batch = receiptsToUpdate.slice(i, i + batchSize);
      
      for (const receipt of batch) {
        const { id, data } = receipt;
        const customerPhone = data.customerPhone;
        
        if (!customerPhone) {
          console.log(`Skipping receipt ${id} - no customer phone`);
          continue;
        }
        
        // Get or create customer ID for this phone number
        let customerId = customerIdMap.get(customerPhone);
        if (!customerId) {
          customerId = nextId.toString();
          customerIdMap.set(customerPhone, customerId);
          nextId++;
          console.log(`Generated simple customer ID ${customerId} for phone ${customerPhone}`);
        }
        
        // Update the receipt with the simple customer ID
        const receiptRef = doc(db, 'receipts', id);
        await updateDoc(receiptRef, {
          customerId: customerId
        });
        
        console.log(`Updated receipt ${id} with simple customer ID ${customerId}`);
      }
      
      // Small delay between batches to avoid overwhelming Firestore
      if (i + batchSize < receiptsToUpdate.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log('Customer ID fix completed successfully');
    console.log('Customer ID mapping:', Object.fromEntries(customerIdMap));
    return customerIdMap;
    
  } catch (error) {
    console.error('Error during customer ID fix:', error);
    throw error;
  }
};

// Function to run from browser console
window.fixCustomerIds = fixCustomerIds;

// Function to check current customer ID status
export const checkCustomerIdStatus = async () => {
  try {
    console.log('Checking customer ID status...');
    
    const allReceiptsQuery = query(collection(db, 'receipts'), orderBy('date', 'desc'));
    const querySnapshot = await getDocs(allReceiptsQuery);
    
    const customerIds = new Set();
    const phoneToIdMap = new Map();
    let totalReceipts = 0;
    let receiptsWithIds = 0;
    let receiptsWithoutIds = 0;
    
    querySnapshot.docs.forEach(doc => {
      const data = doc.data();
      totalReceipts++;
      
      if (data.customerPhone) {
        if (data.customerId) {
          receiptsWithIds++;
          customerIds.add(data.customerId);
          phoneToIdMap.set(data.customerPhone, data.customerId);
        } else {
          receiptsWithoutIds++;
        }
      }
    });
    
    console.log('Customer ID Status Report:');
    console.log(`Total receipts: ${totalReceipts}`);
    console.log(`Receipts with customer IDs: ${receiptsWithIds}`);
    console.log(`Receipts without customer IDs: ${receiptsWithoutIds}`);
    console.log(`Unique customer IDs: ${customerIds.size}`);
    console.log(`Unique phone numbers: ${phoneToIdMap.size}`);
    
    // Check for non-sequential IDs
    const numericIds = Array.from(customerIds)
      .filter(id => !isNaN(id))
      .map(id => parseInt(id))
      .sort((a, b) => a - b);
    
    if (numericIds.length > 0) {
      console.log(`Numeric IDs range: ${numericIds[0]} to ${numericIds[numericIds.length - 1]}`);
      console.log(`Missing IDs: ${findMissingIds(numericIds)}`);
    }
    
    return {
      totalReceipts,
      receiptsWithIds,
      receiptsWithoutIds,
      uniqueCustomerIds: customerIds.size,
      uniquePhoneNumbers: phoneToIdMap.size,
      numericIds
    };
    
  } catch (error) {
    console.error('Error checking customer ID status:', error);
    throw error;
  }
};

// Helper function to find missing sequential IDs
const findMissingIds = (sortedIds) => {
  if (sortedIds.length === 0) return [];
  
  const missing = [];
  const min = sortedIds[0];
  const max = sortedIds[sortedIds.length - 1];
  
  for (let i = min; i <= max; i++) {
    if (!sortedIds.includes(i)) {
      missing.push(i);
    }
  }
  
  return missing;
};

// Function to run status check from browser console
window.checkCustomerIdStatus = checkCustomerIdStatus; 