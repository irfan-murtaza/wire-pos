export const generatePrintableHTML = (props) => {
    const receiptHtml = `
      <html>
        <head>
          <title>AAF Cables - Receipt</title>
          <style>
            body { font-family: monospace; padding: 40px; }
            table, th, td { border: 1px solid black; border-collapse: collapse; }
            th, td { padding: 6px; text-align: center; }
            h2 { text-align: center; }
            .text-right { text-align: center; }
            .text-red { color: red; }
            .text-bold { font-weight: bold; }
            .mt-4 { margin-top: 16px; }
            .payment-history { margin-top: 20px; }
            .payment-history th { background-color: #f0f0f0; }
            .amount-summary { text-align: right; }
          </style>
        </head>
        <body>
          <h2>SALES RECEIPT</h2>
          <p>Date: ${new Date(props.date).toLocaleDateString()}</p>
          <p>Customer: ${props.customerName}</p>
          <p>Phone: ${props.customerPhone || '-'}</p>
          <table width="100%">
            <thead>
              <tr>
                <th>Product</th><th>Qty</th><th>Price</th><th>Amount</th>
              </tr>
            </thead>
            <tbody>
              ${props.items.map(i => `
                <tr>
                  <td>${i.name}</td>
                  <td>${i.quantity}</td>
                  <td>${Math.round(i.price)}</td>
                  <td>${Math.round(i.price * i.quantity)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="amount-summary mt-4">
            <p>Subtotal: ${Math.round(props.subtotal)}</p>
            ${props.discount > 0 ? `
              <p class="text-red">Discount (${props.discount}%): - ${Math.round(props.discountAmount)}</p>
            ` : ''}
            <p class="text-bold">Total Amount: ${Math.round(props.totalAmount)}</p>
            <p>Paid Amount: ${Math.round(props.paidAmount)}</p>
            ${props.remainingAmount > 0 ? `
              <p class="text-red">Remaining Amount: ${Math.round(props.remainingAmount)}</p>
            ` : ''}
          </div>
          <p><strong>Sale Made With:</strong></p>
          <p>[${props.paymentMethod === 'Cash' ? '✔' : ' '}] Cash</p>
          <p>[${props.paymentMethod === 'Card' ? '✔' : ' '}] Credit Card</p>
          <p>[${props.paymentMethod === 'Cheque' ? '✔' : ' '}] Check, No: ${props.chequeNumber || ''}</p>
          <p>[${props.paymentMethod === 'Other' ? '✔' : ' '}] ${props.comment || ''}</p>

          ${props.paymentHistory && props.paymentHistory.length > 0 ? `
            <div class="payment-history">
              <h3>Payment History</h3>
              <table width="100%">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  ${props.paymentHistory.map(payment => `
                    <tr>
                      <td>${new Date(payment.date).toLocaleDateString()}</td>
                      <td class="text-right">${Math.round(payment.amount)}</td>
                      <td>${payment.paymentMethod}</td>
                      <td>${payment.chequeNumber ? `Cheque #${payment.chequeNumber}` : payment.comment || '-'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}
        </body>
      </html>
    `;
    return receiptHtml;
  };