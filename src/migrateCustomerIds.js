// Migration script to add customer IDs to existing receipts
import { collection, getDocs, query, orderBy, where, updateDoc, doc } from 'firebase/firestore';
import { db } from './firebase';
import { generateUniqueCustomerId } from './utils';

export const migrateExistingCustomerIds = async () => {
  try {
    console.log('Starting customer ID migration...');
    
    // Get all receipts that don't have a customerId
    const receiptsQuery = query(
      collection(db, 'receipts'),
      where('customerId', '==', null)
    );
    
    // If the above query doesn't work (because customerId field doesn't exist),
    // we'll get all receipts and filter them
    const allReceiptsQuery = query(collection(db, 'receipts'), orderBy('date', 'desc'));
    const querySnapshot = await getDocs(allReceiptsQuery);
    
    const receiptsToUpdate = [];
    const customerIdMap = new Map(); // Map phone numbers to customer IDs
    
    querySnapshot.docs.forEach(doc => {
      const data = doc.data();
      // Check if customerId is missing, null, or has a long ID that needs migration
      if (data.customerPhone && (
        !data.customerId || 
        data.customerId.startsWith('CUST-') || 
        (data.customerId && data.customerId.startsWith('cus-') && data.customerId.length > 10) ||
        data.customerId === data.customerPhone
      )) {
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
          customerId = await generateUniqueCustomerId(db);
          customerIdMap.set(customerPhone, customerId);
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
    
    console.log('Customer ID migration completed successfully');
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
          customerId = `cus-${nextId}`;
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