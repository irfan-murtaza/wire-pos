// Migration script to add customer IDs to existing receipts
import { collection, getDocs, query, orderBy, where, updateDoc, doc } from 'firebase/firestore';
import { db } from './firebase';
import { generateUniqueCustomerId } from './utils';

export const migrateExistingCustomerIds = async () => {
  try {
    console.log('Starting customer ID migration to simple sequential numbers...');
    
    // Get all receipts
    const allReceiptsQuery = query(collection(db, 'receipts'), orderBy('date', 'desc'));
    const querySnapshot = await getDocs(allReceiptsQuery);
    
    const receiptsToUpdate = [];
    const customerIdMap = new Map(); // Map phone numbers to customer IDs
    let nextId = 1;
    
    querySnapshot.docs.forEach(doc => {
      const data = doc.data();
      // Update all receipts to ensure they have simple sequential customer IDs
      if (data.customerPhone) {
        receiptsToUpdate.push({ id: doc.id, data });
      }
    });
    
    console.log(`Found ${receiptsToUpdate.length} receipts to update`);
    
    if (receiptsToUpdate.length === 0) {
      console.log('No receipts need customer ID migration');
      return;
    }
    
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
    
    console.log('Customer ID migration to simple sequential numbers completed successfully');
    console.log('Customer ID mapping:', Object.fromEntries(customerIdMap));
    return customerIdMap;
    
  } catch (error) {
    console.error('Error during customer ID migration:', error);
    throw error;
  }
};

// Function to run migration from browser console
window.migrateCustomerIds = migrateExistingCustomerIds;

// Function to force reset all customer IDs to simple format
export const resetAllCustomerIds = async () => {
  try {
    console.log('Starting customer ID reset...');
    
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
          console.log(`Generated customer ID ${customerId} for phone ${customerPhone}`);
        }
        
        // Update the receipt with the customer ID
        const receiptRef = doc(db, 'receipts', id);
        await updateDoc(receiptRef, {
          customerId: customerId
        });
        
        console.log(`Updated receipt ${id} with customer ID ${customerId}`);
      }
      
      // Small delay between batches to avoid overwhelming Firestore
      if (i + batchSize < receiptsToUpdate.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log('Customer ID reset completed successfully');
    return customerIdMap;
    
  } catch (error) {
    console.error('Error during customer ID reset:', error);
    throw error;
  }
};

// Function to run reset from browser console
window.resetAllCustomerIds = resetAllCustomerIds; 

// Function to migrate all customer IDs to simple sequential numbers
export const migrateToSimpleCustomerIds = async () => {
  try {
    console.log('Starting migration to simple customer IDs...');
    
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
    
    console.log('Migration to simple customer IDs completed successfully');
    console.log('Customer ID mapping:', Object.fromEntries(customerIdMap));
    return customerIdMap;
    
  } catch (error) {
    console.error('Error during migration to simple customer IDs:', error);
    throw error;
  }
};

// Function to run simple migration from browser console
window.migrateToSimpleCustomerIds = migrateToSimpleCustomerIds; 