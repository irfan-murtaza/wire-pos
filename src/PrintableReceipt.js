export function generatePrintableHTML({
  customerName,
  customerPhone,
  items,
  totalAmount,
  date,
  paymentMethod,
  chequeNumber,
  comment,
  discount = 0,
  discountAmount = 0,
  subtotal,
  paidAmount,
  remainingAmount,
  isCustomerReport = false,
  paymentHistory = []
}) {
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Ensure payment history includes initial payment if it exists
  let allPayments = [...paymentHistory];
  if (paidAmount > 0 && !allPayments.some(p => p.type === 'Initial Payment')) {
    // Get the initial payment amount from the sale record
    const initialPaymentAmount = paidAmount - allPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    if (initialPaymentAmount > 0) {
      allPayments.unshift({
        amount: initialPaymentAmount,
        method: paymentMethod,
        date: date,
        chequeNumber: chequeNumber || '',
        comment: comment || '',
        type: 'Initial Payment'
      });
    }
  }

  // Sort payments by date
  allPayments = allPayments.sort((a, b) => new Date(b.date) - new Date(a.date));

  const generatePaymentHistoryTable = (paymentHistory) => {
    if (!paymentHistory || paymentHistory.length === 0) return '';

    return `
      <div class="payment-history">
        <h3>Payment History</h3>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Amount (PKR)</th>
              <th>Method</th>
              <th>Details</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            ${paymentHistory.map(payment => `
              <tr>
                <td>${formatDate(payment.date)}</td>
                <td>${Math.round(payment.amount)}</td>
                <td>${payment.paymentMethod || payment.method || 'Cash'}</td>
                <td>${payment.chequeNumber ? `Cheque #${payment.chequeNumber}` : payment.comment || '-'}</td>
                <td>${payment.type}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  };

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Receipt</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
          }
          .receipt {
            max-width: 800px;
            margin: 0 auto;
          }
          .header {
            text-align: center;
            margin-bottom: 20px;
          }
          .customer-info {
            margin-bottom: 20px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
          }
          th {
            background-color: #f5f5f5;
          }
          .total-section {
            margin-top: 20px;
            text-align: right;
          }
          .payment-history {
            margin-top: 30px;
          }
          .payment-history h3 {
            margin-bottom: 10px;
          }
          .payment-history table {
            margin-top: 10px;
          }
          .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 0.9em;
            color: #666;
          }
          @media print {
            body {
              padding: 0;
            }
            .receipt {
              max-width: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            <h2>Sales Receipt</h2>
            <p>Date: ${formatDate(date)}</p>
          </div>

          <div class="customer-info">
            <p><strong>Customer Name:</strong> ${customerName}</p>
            <p><strong>Phone:</strong> ${customerPhone || '-'}</p>
          </div>

          ${(paymentMethod === 'Manual Debt' && remainingAmount > 0) ? `
            <div style="margin-bottom: 16px; padding: 12px; background: #fff3cd; border: 1px solid #ffeeba; border-radius: 4px; color: #856404;">
              <strong>Pending Payment:</strong> This is a pending payment${comment ? `.<br/><strong>Reason:</strong> ${comment}` : '.'}
            </div>
          ` : ''}

          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Quantity</th>
                <th>Price (PKR)</th>
                <th>Total (PKR)</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(item => {
                const price = item.salesPrice || item.price || 0;
                const quantity = item.quantity || 0;
                const total = price * quantity;
                return `
                  <tr>
                    <td>${item.name}</td>
                    <td>${quantity}</td>
                    <td>${Math.round(price)}</td>
                    <td>${Math.round(total)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3" style="text-align: right;"><strong>Subtotal:</strong></td>
                <td>${Math.round(subtotal)}</td>
              </tr>
              ${discount > 0 ? `
                <tr>
                  <td colspan="3" style="text-align: right;"><strong>Discount (${discount}%):</strong></td>
                  <td>-${Math.round(discountAmount)}</td>
                </tr>
              ` : ''}
              <tr>
                <td colspan="3" style="text-align: right;"><strong>Total Amount:</strong></td>
                <td>${Math.round(totalAmount)}</td>
              </tr>
              <tr>
                <td colspan="3" style="text-align: right;"><strong>Paid Amount:</strong></td>
                <td>${Math.round(paidAmount)}</td>
              </tr>
              ${remainingAmount > 0 ? `
                <tr>
                  <td colspan="3" style="text-align: right;"><strong>Remaining Amount:</strong></td>
                  <td>${Math.round(remainingAmount)}</td>
                </tr>
              ` : ''}
            </tfoot>
          </table>

          ${generatePaymentHistoryTable(allPayments)}

          <div class="footer">
            <p>Thank you for your business!</p>
          </div>
        </div>
      </body>
    </html>
  `;
}