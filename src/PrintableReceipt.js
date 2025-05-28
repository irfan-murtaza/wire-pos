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
  paymentHistory = [],
  billNumber,
  builteNo
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
            font-family: 'Inter', Arial, sans-serif;
            margin: 0;
            padding: 0;
            background: #f4f7fa;
            color: #222;
          }
          .receipt {
            max-width: 700px;
            margin: 32px auto;
            background: #fff;
            border-radius: 18px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.10), 0 1.5px 4px rgba(0,86,166,0.08);
            overflow: hidden;
            border: none;
          }
          .aaf-header {
            background: linear-gradient(90deg, #0056a6 0%, #0072ce 100%);
            color: #fff;
            padding: 32px 0 18px 0;
            text-align: center;
            border-bottom: 4px solid #ff9900;
            position: relative;
          }
          .aaf-header h1 {
            margin: 0 0 8px 0;
            font-size: 2.3em;
            letter-spacing: 2.5px;
            font-weight: 800;
            color: #ff9900;
            text-shadow: 0 2px 8px rgba(0,0,0,0.10);
          }
          .aaf-header .address {
            font-size: 1.13em;
            color: #fff;
            margin-bottom: 10px;
            font-weight: 500;
            letter-spacing: 0.5px;
          }
          .aaf-header .contacts-table {
            width: 90%;
            margin: 0 auto 0 auto;
            border-collapse: collapse;
          }
          .aaf-header .contacts-table td {
            color: #fff;
            font-size: 1.08em;
            font-weight: 600;
            padding: 0 18px 0 18px;
            text-align: center;
            border: none;
          }
          .receipt-date {
            text-align: center;
            font-size: 1.13em;
            color: #0056a6;
            margin: 24px 0 0 0;
            font-weight: 600;
            letter-spacing: 0.5px;
          }
          .customer-info {
            margin: 12px 0 18px 0;
            padding: 0 32px;
            font-size: 1.13em;
            background: #f7fafd;
            border-radius: 10px;
            box-shadow: 0 1px 4px rgba(0,86,166,0.04);
            display: flex;
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
          }
          .customer-info strong {
            color: #0056a6;
            font-weight: 700;
          }
          .receipt-table {
            width: 94%;
            margin: 0 auto 24px auto;
            border-collapse: separate;
            border-spacing: 0;
            font-size: 1.09em;
            background: #f9fbfd;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 1px 4px rgba(0,86,166,0.04);
          }
          .receipt-table th {
            background: linear-gradient(90deg, #0056a6 0%, #0072ce 100%);
            color: #ff9900;
            border: none;
            padding: 12px 4px;
            font-weight: 700;
            text-align: center;
            font-size: 1.08em;
            letter-spacing: 0.5px;
          }
          .receipt-table td {
            border: none;
            border-bottom: 1.5px solid #e3eaf3;
            padding: 10px 4px;
            text-align: center;
            background: #fff;
            font-size: 1.07em;
          }
          .receipt-table tr:last-child td {
            border-bottom: none;
          }
          .receipt-table tr:nth-child(even) td {
            background: #f4f7fa;
          }
          .total-section {
            margin: 0 32px 18px 32px;
            font-size: 1.13em;
            background: #f7fafd;
            border-radius: 10px;
            padding: 18px 24px 10px 24px;
            box-shadow: 0 1px 4px rgba(0,86,166,0.04);
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .total-row {
            display: flex;
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 2px;
          }
          .total-label {
            color: #0056a6;
            font-weight: 700;
            text-align: left;
          }
          .total-value {
            text-align: right;
            font-weight: 600;
            color: #222;
            min-width: 100px;
          }
          .payment-history {
            margin: 36px 32px 0 32px;
            background: #f7fafd;
            border-radius: 10px;
            box-shadow: 0 1px 4px rgba(0,86,166,0.04);
            padding: 18px 18px 10px 18px;
          }
          .payment-history h3 {
            margin-bottom: 10px;
            color: #0056a6;
            font-size: 1.13em;
            font-weight: 700;
          }
          .payment-history table {
            margin-top: 10px;
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            font-size: 1em;
            background: #fff;
            border-radius: 8px;
            overflow: hidden;
          }
          .payment-history th {
            background: linear-gradient(90deg, #0056a6 0%, #0072ce 100%);
            color: #ff9900;
            border: none;
            padding: 8px 2px;
            font-weight: 700;
            text-align: center;
            font-size: 1.05em;
          }
          .payment-history td {
            border: none;
            border-bottom: 1.5px solid #e3eaf3;
            padding: 8px 2px;
            text-align: center;
            background: #fff;
          }
          .payment-history tr:last-child td {
            border-bottom: none;
          }
          .footer {
            margin-top: 36px;
            text-align: center;
            font-size: 1.08em;
            color: #0056a6;
            font-weight: 700;
            letter-spacing: 0.5px;
            padding-bottom: 24px;
          }
          .bill-number {
            text-align: center;
            font-size: 1.08em;
            color: #222;
            margin: 2px 0 12px 0;
            font-weight: 600;
            letter-spacing: 0.5px;
          }
          .builte-no {
            text-align: center;
            font-size: 1.08em;
            color: #222;
            margin: 2px 0 12px 0;
            font-weight: 600;
            letter-spacing: 0.5px;
          }
          @media print {
            body {
              padding: 0;
              background: #fff;
            }
            .receipt {
              max-width: none;
              box-shadow: none;
              border-radius: 0;
            }
          }
        </style>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
      </head>
      <body>
        <div class="receipt">
          <div class="aaf-header">
            <h1>A.A.F Cables Industry</h1>
            <div class="address">Harbanspura Lahore</div>
            <table class="contacts-table">
              <tr>
                <td>Rashid Munir</td>
                <td>Rahat Munir</td>
                <td>Haris Munir</td>
              </tr>
              <tr>
                <td>0321-4189745</td>
                <td>0321-1687975</td>
                <td>0323-8419568</td>
              </tr>
            </table>
          </div>
          <div class="receipt-date">
            ${formatDate(date)}
          </div>
          ${billNumber ? `<div class="bill-number">Bill No: ${billNumber}</div>` : ''}
          <div class="builte-no">Builte No: ${builteNo || '-'}</div>
          <div class="customer-info">
            <div><strong>Name:</strong> ${customerName}</div>
            <div><strong>Phone:</strong> ${customerPhone || '-'}</div>
          </div>
          ${(paymentMethod === 'Manual Debt' && remainingAmount > 0) ? `
            <div style="margin-bottom: 16px; padding: 12px; background: #fff3cd; border: 1px solid #ffeeba; border-radius: 4px; color: #856404; font-size:1.08em;">
              <strong>Pending Payment:</strong> This is a pending payment${comment ? `.<br/><strong>Reason:</strong> ${comment}` : '.'}
            </div>
          ` : ''}
          <table class="receipt-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Quantity</th>
                <th>Description</th>
                <th>Rate (PKR)</th>
                <th>Amount (PKR)</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(item => {
                const price = item.salesPrice || item.price || 0;
                const quantity = item.quantity || 0;
                const total = price * quantity;
                return `
                  <tr>
                    <td>${item.name || '-'}</td>
                    <td>${quantity}</td>
                    <td>${item.description || '-'}</td>
                    <td>${Math.round(price)}</td>
                    <td>${Math.round(total)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          <div class="total-section">
            <div class="total-row"><span class="total-label">Subtotal:</span><span class="total-value">${Math.round(subtotal)} PKR</span></div>
            ${discount > 0 ? `<div class="total-row"><span class="total-label">Discount (${discount}%):</span><span class="total-value">-${Math.round(discountAmount)} PKR</span></div>` : ''}
            <div class="total-row"><span class="total-label">Total Amount:</span><span class="total-value">${Math.round(totalAmount)} PKR</span></div>
            <div class="total-row"><span class="total-label">Paid Amount:</span><span class="total-value">${Math.round(paidAmount)} PKR</span></div>
            ${remainingAmount > 0 ? `<div class="total-row"><span class="total-label">Remaining Amount:</span><span class="total-value">${Math.round(remainingAmount)} PKR</span></div>` : ''}
          </div>
          ${generatePaymentHistoryTable(allPayments)}
          <div class="footer">
            Thank you for your business!
          </div>
        </div>
      </body>
    </html>
  `;
}