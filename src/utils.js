// Utility functions for customer management

// Generate a readable customer ID (cus-1, cus-2, etc.)
export const generateCustomerId = async (db) => {
  const { collection, query, orderBy, getDocs } = await import('firebase/firestore');
  
  try {
    // Get all receipts to find the highest existing customer ID
    const receiptsQuery = query(collection(db, 'receipts'), orderBy('date', 'desc'));
    const receiptsSnapshot = await getDocs(receiptsQuery);
    
    let highestId = 0;
    
    // Find the highest customer ID number from existing receipts
    receiptsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.customerId) {
        // Check for cus- format IDs (both short and long)
        if (data.customerId.startsWith('cus-')) {
          const idNumber = parseInt(data.customerId.replace('cus-', ''));
          if (!isNaN(idNumber) && idNumber > highestId) {
            highestId = idNumber;
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
            }
          }
        }
      }
    });
    
    // Generate next ID - start from 1 if no existing IDs found
    const nextId = highestId + 1;
    console.log(`Generated customer ID: cus-${nextId} (highest found: ${highestId})`);
    return `cus-${nextId}`;
  } catch (error) {
    console.error('Error generating customer ID:', error);
    // Fallback - start from 1 instead of timestamp
    console.log('Using fallback ID generation');
    return `cus-1`;
  }
};

// Check if a customer ID already exists
export const checkCustomerIdExists = async (db, customerId) => {
  const { collection, query, where, getDocs } = await import('firebase/firestore');
  const receiptsQuery = query(collection(db, 'receipts'), where('customerId', '==', customerId));
  const querySnapshot = await getDocs(receiptsQuery);
  return !querySnapshot.empty;
};

// Generate a unique customer ID that doesn't exist in the database
export const generateUniqueCustomerId = async (db) => {
  let customerId;
  let attempts = 0;
  const maxAttempts = 10;
  
  do {
    customerId = await generateCustomerId(db);
    attempts++;
    
    if (attempts > maxAttempts) {
      throw new Error('Unable to generate unique customer ID after maximum attempts');
    }
  } while (await checkCustomerIdExists(db, customerId));
  
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