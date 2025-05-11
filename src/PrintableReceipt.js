export const generatePrintableHTML = (props) => {
  const receiptHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>AAF Cables – ${props.isCustomerReport ? 'Customer Report' : 'Receipt'}</title>
        <meta charset="utf-8">
        <style>
          body {
            font-family: monospace;
            padding: 40px;
            margin: 0;
            background: white;
          }
          table, th, td {
            border: 1px solid black;
            border-collapse: collapse;
          }
          th, td {
            padding: 6px;
            text-align: center;
          }
          h2 {
            text-align: center;
            margin-bottom: 20px;
          }
          .text-right {
            text-align: right;
          }
          .text-red {
            color: red;
          }
          .text-bold {
            font-weight: bold;
          }
          .mt-4 {
            margin-top: 16px;
          }
          .amount-summary {
            text-align: right;
            margin-top: 20px;
          }
          .header {
            text-align: center;
            margin-bottom: 20px;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
          }
          .header p {
            margin: 5px 0;
          }
          .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>AAF Cables</h1>
          <p>${props.isCustomerReport ? 'CUSTOMER REPORT' : 'SALES RECEIPT'}</p>
        </div>

        <p>Date: ${new Date(props.date).toLocaleDateString()}</p>
        <p>Customer: ${props.customerName}</p>
        <p>Phone: ${props.customerPhone || '-'}</p>

        <table width="100%">
          <thead>
            <tr>
              <th>Product</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Amount</th>
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

        <div class="amount-summary">
          <p>Subtotal: Rs ${Math.round(props.subtotal || 0)}</p>
          ${props.discount > 0 ? `
            <p class="text-red">
              Discount (${props.discount}%): – Rs ${Math.round(props.discountAmount || 0)}
            </p>
          ` : ''}
          <p class="text-bold">
            Total Amount: Rs ${Math.round(props.totalAmount || 0)}
          </p>
          <p>Paid Amount: Rs ${Math.round(props.paidAmount || 0)}</p>
          ${props.remainingAmount > 0 ? `
            <p class="text-red">
              Remaining Amount: Rs ${Math.round(props.remainingAmount || 0)}
            </p>
          ` : ''}
        </div>

        ${!props.isCustomerReport ? `
          <p><strong>Sale Made With:</strong></p>
          <p>[${props.paymentMethod === 'Cash' ? '✔' : ' '}] Cash</p>
          <p>[${props.paymentMethod === 'Card' ? '✔' : ' '}] Credit Card</p>
          <p>
            [${props.paymentMethod === 'Cheque' ? '✔' : ' '}] Cheque, No: ${props.chequeNumber || ''}
          </p>
          <p>[${props.paymentMethod === 'Other' ? '✔' : ' '}] ${props.comment || ''}</p>
        ` : ''}

        <div class="footer">
          <p>Thank you for your business!</p>
        </div>
      </body>
    </html>
  `;

  return receiptHtml;
};
