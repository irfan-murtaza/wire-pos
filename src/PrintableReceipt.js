export function generatePrintableHTML({
  customerName,
  customerPhone,
  customerId,
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
  builteNo,
  previousRemaining = 0,
  showRemainingBalance = true,
}) {
  // Debug logging for date and builteNo
  console.log("PrintableReceipt Input Debug:", {
    date,
    builteNo,
    billNumber,
    customerName,
    customerPhone,
    customerId,
    showRemainingBalance,
    remainingAmount,
    paidAmount,
    subtotal,
  });
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return "Invalid Date";
      }
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (error) {
      console.error("Error formatting date:", dateString, error);
      return "Invalid Date";
    }
  };

  // Ensure payment history includes initial payment if it exists
  let allPayments = [...paymentHistory];
  if (
    paidAmount > 0 &&
    !allPayments.some((p) => p.type === "Initial Payment")
  ) {
    // Get the initial payment amount from the sale record
    const initialPaymentAmount =
      paidAmount - allPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    if (initialPaymentAmount > 0) {
      allPayments.unshift({
        amount: initialPaymentAmount,
        method: paymentMethod,
        date: date,
        chequeNumber: chequeNumber || "",
        comment: comment || "",
        type: "Initial Payment",
      });
    }
  }

  // Sort payments by date
  allPayments = allPayments.sort((a, b) => new Date(b.date) - new Date(a.date));

  const generatePaymentHistoryTable = (paymentHistory) => {
    if (!paymentHistory || paymentHistory.length === 0) return "";

    return `
      <div class="payment-history">
        <h3>Complete Customer Payment History</h3>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Amount (PKR)</th>
              <th>Method</th>
              <th>Bill No.</th>
              <th>Details</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            ${paymentHistory
              .map(
                (payment) => `
              <tr>
                <td>${formatDate(payment.date)}</td>
                <td>${Math.round(payment.amount)}</td>
                <td>${payment.paymentMethod || payment.method || "Cash"}</td>
                <td>${payment.billNumber || "-"}</td>
                <td>${
                  payment.chequeNumber
                    ? `Cheque #${payment.chequeNumber}`
                    : payment.comment || "-"
                }</td>
                <td>${payment.type}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  };

  const totalWithPrevious = subtotal + previousRemaining;
  // Fix: If remainingAmount is provided, use it directly. Otherwise calculate from scratch
  const totalRemainingFinal = remainingAmount !== undefined ? remainingAmount : (totalWithPrevious - paidAmount);

  // Calculate total based on showRemainingBalance checkbox
  const finalTotal = showRemainingBalance ? totalWithPrevious : subtotal;
  const finalRemaining = showRemainingBalance ? totalRemainingFinal : 0;

  // Validation: Check if the math makes sense
  const expectedRemaining = finalTotal - paidAmount;
  if (Math.abs(finalRemaining - expectedRemaining) > 1) { // Allow for small rounding differences
    console.warn('PrintableReceipt Math Validation Failed:', {
      finalTotal,
      paidAmount,
      expectedRemaining: finalTotal - paidAmount,
      actualRemaining: finalRemaining,
      difference: finalRemaining - expectedRemaining,
      inputs: { subtotal, previousRemaining, remainingAmount, showRemainingBalance }
    });
  }

  // Debug logging
  console.log("PrintableReceipt Debug:", {
    subtotal,
    previousRemaining,
    totalWithPrevious,
    paidAmount,
    remainingAmount,
    totalRemainingFinal,
    showRemainingBalance,
    finalTotal,
    finalRemaining,
    willShowRemaining: showRemainingBalance ? 'YES' : 'NO',
    calculation: {
      step1: `subtotal (${subtotal}) + previousRemaining (${previousRemaining}) = totalWithPrevious (${totalWithPrevious})`,
      step2: `remainingAmount provided: ${remainingAmount !== undefined ? remainingAmount : 'undefined'}`,
      step3: `totalRemainingFinal: ${remainingAmount !== undefined ? remainingAmount : (totalWithPrevious - paidAmount)}`,
      step4: `finalTotal: ${showRemainingBalance ? totalWithPrevious : subtotal}`,
      step5: `finalRemaining: ${showRemainingBalance ? totalRemainingFinal : 0}`
    },
    rawInputs: {
      subtotal: subtotal,
      previousRemaining: previousRemaining,
      paidAmount: paidAmount,
      remainingAmount: remainingAmount,
      showRemainingBalance: showRemainingBalance
    }
  });
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
          ${
            billNumber
              ? `<div class="bill-number">Bill No: ${billNumber}</div>`
              : ""
          }
          <div class="builte-no">Builte No: ${builteNo || "-"}</div>
          ${
            showRemainingBalance && finalRemaining > 0
              ? `<div style="text-align: center; font-size: 1.13em; color: #dc3545; margin: 12px 0 18px 0; font-weight: 700; padding: 8px; background: #fff5f5; border: 1px solid #fecaca; border-radius: 8px;">
                  Total Remaining Amount: ${Math.round(finalRemaining)} PKR
                </div>`
              : ""
          }
          <div class="customer-info">
              <div><strong>Name:</strong> ${customerName}</div>
              <div><strong>Phone:</strong> ${customerPhone || "-"}</div>
              <div><strong>Customer ID:</strong> ${customerId || "-"}</div>
            </div>
          ${
            paymentMethod === "Manual Debt" && remainingAmount > 0
              ? `
            <div style="margin-bottom: 16px; padding: 12px; background: #fff3cd; border: 1px solid #ffeeba; border-radius: 4px; color: #856404; font-size:1.08em;">
              <strong>Pending Payment:</strong> This is a pending payment${
                comment ? `.<br/><strong>Reason:</strong> ${comment}` : "."
              }
            </div>
          `
              : ""
          }
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
              ${items
                .map((item) => {
                  const price = item.salesPrice || item.price || 0;
                  const quantity = item.quantity || 0;
                  const total = price * quantity;
                  const isPlaceholder =
                    item.name === "No transactions for this month";
                  return `
                  <tr>
                    <td>${item.name || "-"}</td>
                    <td>${quantity}</td>
                    <td>${item.description || "-"}</td>
                    <td>${isPlaceholder ? "-" : Math.round(price)}</td>
                    <td>${isPlaceholder ? "-" : Math.round(total)}</td>
                  </tr>
                `;
                })
                .join("")}
            </tbody>
          </table>
          <div class="total-section">
            <div class="total-row"><span class="total-label">Subtotal:</span><span class="total-value">${Math.round(
              subtotal
            )} PKR</span></div>
            ${
              discount > 0
                ? `<div class="total-row"><span class="total-label">Discount (${discount}%):</span><span class="total-value">-${Math.round(
                    discountAmount
                  )} PKR</span></div>`
                : ""
            }
            ${
              previousRemaining > 0 && showRemainingBalance
                ? `<div class="total-row"><span class="total-label">Previous Remaining Amount:</span><span class="total-value">${Math.round(
                    previousRemaining
                  )} PKR</span></div>`
                : ""
            }
            <div class="total-row"><span class="total-label">Total Amount:</span><span class="total-value">${Math.round(
              finalTotal
            )} PKR</span></div>
            <div class="total-row"><span class="total-label">Paid Amount:</span><span class="total-value">${Math.round(
              paidAmount
            )} PKR</span></div>
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

export function generateAllCustomersReportHTML({
  customers,
  monthName,
  showRemainingBalance,
  selectedYear,
  selectedMonth
}) {
  const totalRemaining = customers.reduce((sum, customer) => sum + customer.remainingAmount, 0);
  const totalAmount = customers.reduce((sum, customer) => sum + customer.totalAmount, 0);
  const totalPaid = customers.reduce((sum, customer) => sum + customer.paidAmount, 0);

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>All Customers Remaining Amounts Report</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 20px;
            background-color: #f5f5f5;
          }
          .report-container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .header h1 {
            color: #333;
            margin: 0;
            font-size: 24px;
          }
          .header p {
            color: #666;
            margin: 5px 0 0 0;
            font-size: 14px;
          }
          .summary-section {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 6px;
            margin-bottom: 30px;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
          }
          .summary-item {
            text-align: center;
            padding: 15px;
            background: white;
            border-radius: 6px;
            border: 1px solid #e9ecef;
          }
          .summary-label {
            font-size: 12px;
            color: #666;
            margin-bottom: 5px;
          }
          .summary-value {
            font-size: 18px;
            font-weight: bold;
            color: #333;
          }
          .customers-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          .customers-table th,
          .customers-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
          }
          .customers-table th {
            background-color: #f8f9fa;
            font-weight: bold;
            color: #333;
          }
          .customers-table tr:hover {
            background-color: #f5f5f5;
          }
          .remaining-amount {
            font-weight: bold;
            color: #dc3545;
          }
          .zero-amount {
            color: #6c757d;
            font-style: italic;
          }
          .footer {
            margin-top: 30px;
            text-align: center;
            color: #666;
            font-size: 12px;
            border-top: 1px solid #ddd;
            padding-top: 20px;
          }
          @media print {
            body { margin: 0; }
            .report-container { box-shadow: none; }
          }
        </style>
      </head>
      <body>
        <div class="report-container">
          <div class="header">
            <h1>All Customers Remaining Amounts Report</h1>
            <p>${monthName}</p>
            <p>Generated on: ${new Date().toLocaleDateString()}</p>
          </div>
          
          <div class="summary-section">
            <h3>Summary</h3>
            <div class="summary-grid">
              <div class="summary-item">
                <div class="summary-label">Total Customers</div>
                <div class="summary-value">${customers.length}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Total Amount</div>
                <div class="summary-value">${Math.round(totalAmount).toLocaleString()} PKR</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Total Paid</div>
                <div class="summary-value">${Math.round(totalPaid).toLocaleString()} PKR</div>
              </div>
              ${showRemainingBalance ? `
                <div class="summary-item">
                  <div class="summary-label">Total Remaining</div>
                  <div class="summary-value">${Math.round(totalRemaining).toLocaleString()} PKR</div>
                </div>
              ` : ''}
            </div>
          </div>
          
          <table class="customers-table">
            <thead>
              <tr>
                <th>Customer ID</th>
                <th>Customer Name</th>
                <th>Total Amount (PKR)</th>
                <th>Paid Amount (PKR)</th>
                ${showRemainingBalance ? '<th>Remaining Amount (PKR)</th>' : ''}
                <th>Sales Count</th>
              </tr>
            </thead>
            <tbody>
              ${customers.map(customer => `
                <tr>
                  <td>${customer.customerId || '-'}</td>
                  <td>${customer.name}</td>
                  <td>${Math.round(customer.totalAmount).toLocaleString()}</td>
                  <td>${Math.round(customer.paidAmount).toLocaleString()}</td>
                  ${showRemainingBalance ? `
                    <td class="${customer.remainingAmount > 0 ? 'remaining-amount' : 'zero-amount'}">
                      ${customer.remainingAmount > 0 ? Math.round(customer.remainingAmount).toLocaleString() : '0 (No transactions)'}
                    </td>
                  ` : ''}
                  <td>${customer.salesCount}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="footer">
            <p>Report generated on ${new Date().toLocaleString()}</p>
            <p>${showRemainingBalance ? 'Showing all customers with remaining amounts displayed' : 'Showing only customers with remaining amounts'}</p>
          </div>
        </div>
      </body>
    </html>
  `;
}
