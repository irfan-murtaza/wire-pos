# Customer ID Migration and Bulk Delete Features

## Overview

This update includes two major improvements to the customer management system:

1. **Simple Sequential Customer IDs**: All customer IDs are now simple sequential numbers (1, 2, 3, 4, etc.)
2. **Bulk Delete Functionality**: Ability to select and delete multiple customers at once

## Customer ID System

### What Changed

- Customer IDs are now simple sequential numbers starting from 1
- Previous complex IDs (like `CUST-1234567890` or `cus-1753710032884`) are migrated to simple numbers
- Each customer gets a unique sequential ID based on when they were first added

### How to Update Customer IDs

1. **Using the UI Button**:
   - Go to either "Customer Management" or "Customer Monthly Report" page
   - Click the "Update Customer IDs" button (orange button)
   - Confirm the migration when prompted
   - Wait for the process to complete

2. **Using Browser Console**:
   ```javascript
   // Check current status
   checkCustomerIdStatus();
   
   // Fix customer IDs
   fixCustomerIds();
   ```

### Migration Process

The migration will:
- Scan all existing receipts
- Group customers by phone number
- Assign sequential IDs starting from 1
- Update all receipts for each customer with the new ID
- Process in batches to avoid overwhelming the database

## Bulk Delete Functionality

### Features

- **Select Individual Customers**: Checkbox for each customer row
- **Select All Customers**: Checkbox in table header to select/deselect all
- **Bulk Delete Button**: Appears when customers are selected
- **Confirmation Modal**: Shows warning and details before deletion
- **Progress Tracking**: Shows loading state during deletion

### How to Use Bulk Delete

1. **Select Customers**:
   - Use individual checkboxes to select specific customers
   - Use the header checkbox to select all visible customers
   - Selected count is shown in the delete button

2. **Delete Selected**:
   - Click "Delete Selected (X)" button
   - Review the confirmation modal
   - Confirm deletion
   - Wait for process to complete

### Safety Features

- **Confirmation Required**: Must confirm deletion in modal
- **Warning Message**: Clear warning about permanent deletion
- **Details Shown**: Displays number of customers and sales records to be deleted
- **Batch Processing**: Deletes in small batches to avoid timeouts

## Technical Details

### Files Modified

- `src/CustomerManagement.js` - Added bulk delete functionality
- `src/CustomerMonthlyReport.js` - Added bulk delete functionality
- `src/utils.js` - Updated customer ID generation
- `src/migrateCustomerIds.js` - Updated migration logic
- `src/fix_customer_id_display.js` - New utility file

### Database Changes

- All receipts are updated with simple sequential customer IDs
- No data loss - only ID format changes
- Maintains all existing customer relationships

### Performance Considerations

- Migration processes in batches of 10 receipts
- 1-second delay between batches
- Bulk delete processes one customer at a time
- Progress indicators for long operations

## Troubleshooting

### Migration Issues

If migration fails:
1. Check browser console for error messages
2. Try running `fixCustomerIds()` in browser console
3. Check network connectivity
4. Ensure you have proper database permissions

### Bulk Delete Issues

If bulk delete fails:
1. Check browser console for error messages
2. Try deleting fewer customers at once
3. Check network connectivity
4. Ensure you have proper database permissions

### Customer ID Display Issues

If customer IDs don't display correctly:
1. Run `checkCustomerIdStatus()` to see current state
2. Run `fixCustomerIds()` to fix any issues
3. Refresh the page after migration

## Browser Console Commands

```javascript
// Check current customer ID status
checkCustomerIdStatus();

// Fix customer IDs to sequential numbers
fixCustomerIds();

// Legacy migration function
migrateExistingCustomerIds();

// Reset all customer IDs
resetAllCustomerIds();
```

## Support

If you encounter any issues:
1. Check the browser console for error messages
2. Try the browser console commands above
3. Refresh the page and try again
4. Contact support with specific error messages 