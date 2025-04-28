export const generatePrintableHTML = (props) => {
    const receiptHtml = `
      <html>
        <head>
          <title>AAF Cables - Receipt</title>
          <style>
            body { font-family: monospace; padding: 40px; }
            table, th, td { border: 1px solid black; border-collapse: collapse; }
            th, td { padding: 6px; }
            h2 { text-align: center; }
          </style>
        </head>
        <body>
          <h2>SALES RECEIPT</h2>
          <p>Date: ${new Date(props.date).toLocaleDateString()}</p>
          <p>Customer: ${props.customerName}</p>
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
                  <td>Rs ${i.price}</td>
                  <td>Rs ${i.price * i.quantity}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <p style="text-align:right;"><strong>Total: Rs ${props.totalAmount}</strong></p>
          <p><strong>Sale Made With:</strong></p>
          <p>[${props.paymentMethod === 'Cash' ? '✔' : ' '}] Cash</p>
          <p>[${props.paymentMethod === 'Card' ? '✔' : ' '}] Credit Card</p>
          <p>[${props.paymentMethod === 'Cheque' ? '✔' : ' '}] Check, No: ${props.chequeNumber || ''}</p>
          <p>[${props.paymentMethod === 'Other' ? '✔' : ' '}] Other: ${props.comment || ''}</p>
        </body>
      </html>
    `;
    return receiptHtml;
  };