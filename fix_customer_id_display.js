const fs = require('fs');
const path = require('path');

// Read the CustomerManagement.js file
const filePath = path.join(__dirname, 'src', 'CustomerManagement.js');
let content = fs.readFileSync(filePath, 'utf8');

// Replace all occurrences of customer.phone || customer.customerId with customer.customerId || customer.phone
content = content.replace(/customer\.phone \|\| customer\.customerId/g, 'customer.customerId || customer.phone');

// Write the updated content back to the file
fs.writeFileSync(filePath, content, 'utf8');

console.log('Fixed customer ID display logic in CustomerManagement.js'); 