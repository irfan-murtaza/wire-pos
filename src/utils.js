// Utility functions for customer management

// Generate a simple customer ID (1, 2, 3, etc.)
export const generateCustomerId = async (db) => {
  const { collection, query, orderBy, getDocs } = await import('firebase/firestore');
  
  console.log('generateCustomerId called');
  
  try {
    // Get all receipts to find the highest existing customer ID
    const receiptsQuery = query(collection(db, 'receipts'), orderBy('date', 'desc'));
    const receiptsSnapshot = await getDocs(receiptsQuery);
    
    console.log(`Found ${receiptsSnapshot.docs.length} total receipts`);
    
    let highestId = 0;
    
    // Find the highest customer ID number from existing receipts
    receiptsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.customerId) {
        console.log(`Processing receipt with customerId: ${data.customerId}`);
        // Check for simple numeric IDs
        if (!isNaN(data.customerId)) {
          const idNumber = parseInt(data.customerId);
          if (idNumber > highestId) {
            highestId = idNumber;
            console.log(`New highest ID found: ${highestId}`);
          }
        }
        // Also check for old cus- format IDs and extract number
        else if (data.customerId.startsWith('cus-')) {
          const idNumber = parseInt(data.customerId.replace('cus-', ''));
          if (!isNaN(idNumber) && idNumber > highestId) {
            highestId = idNumber;
            console.log(`New highest ID found from cus- format: ${highestId}`);
          }
        }
        // Also check for CUST- format IDs (long ones) and extract number if possible
        else if (data.customerId.startsWith('CUST-')) {
          // Try to extract a number from the long ID for better sequencing
          const match = data.customerId.match(/(\d+)/);
          if (match) {
            const idNumber = parseInt(match[1]);
            if (!isNaN(idNumber) && idNumber > highestId) {
              highestId = idNumber;
              console.log(`New highest ID found from CUST- format: ${highestId}`);
            }
          }
        }
      }
    });
    
    // Generate next ID - start from 1 if no existing IDs found
    const nextId = highestId + 1;
    console.log(`Generated customer ID: ${nextId} (highest found: ${highestId})`);
    return nextId.toString();
  } catch (error) {
    console.error('Error generating customer ID:', error);
    // Fallback - start from 1 instead of timestamp
    console.log('Using fallback ID generation');
    return '1';
  }
};

// Check if a customer ID already exists
export const checkCustomerIdExists = async (db, customerId) => {
  const { collection, query, where, getDocs } = await import('firebase/firestore');
  const receiptsQuery = query(collection(db, 'receipts'), where('customerId', '==', customerId));
  const querySnapshot = await getDocs(receiptsQuery);
  const exists = !querySnapshot.empty;
  console.log(`checkCustomerIdExists: Checking if "${customerId}" exists - Result: ${exists}`);
  if (exists) {
    console.log(`Found ${querySnapshot.docs.length} receipts with customerId: ${customerId}`);
  }
  return exists;
};

// Generate a unique customer ID that doesn't exist in the database
export const generateUniqueCustomerId = async (db) => {
  let customerId;
  let attempts = 0;
  const maxAttempts = 10;
  
  console.log('generateUniqueCustomerId called');
  
  do {
    customerId = await generateCustomerId(db);
    console.log(`Attempt ${attempts + 1}: Generated ID: ${customerId}`);
    attempts++;
    
    if (attempts > maxAttempts) {
      throw new Error('Unable to generate unique customer ID after maximum attempts');
    }
    
    const exists = await checkCustomerIdExists(db, customerId);
    console.log(`ID ${customerId} exists in database: ${exists}`);
    
  } while (await checkCustomerIdExists(db, customerId));
  
  console.log(`Final unique customer ID: ${customerId}`);
  return customerId;
};

// Get or create customer ID for a phone number
export const getOrCreateCustomerId = async (db, customerPhone) => {
  if (!customerPhone) return null;
  
  const { collection, query, where, getDocs, orderBy } = await import('firebase/firestore');
  
  // First, check if this phone number already has a customer ID
  const existingReceiptsQuery = query(
    collection(db, 'receipts'), 
    where('customerPhone', '==', customerPhone),
    orderBy('date', 'desc')
  );
  const existingSnapshot = await getDocs(existingReceiptsQuery);
  
  if (!existingSnapshot.empty) {
    // Check if any existing receipt has a customerId
    const receiptWithId = existingSnapshot.docs.find(doc => doc.data().customerId);
    if (receiptWithId) {
      return receiptWithId.data().customerId;
    }
  }
  
  // If no customer ID exists, generate a new one
  return await generateUniqueCustomerId(db);
};

// Function to migrate all customer IDs to simple sequential numbers
export const migrateToSimpleCustomerIds = async (db) => {
  const { collection, query, orderBy, getDocs, updateDoc, doc } = await import('firebase/firestore');
  
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