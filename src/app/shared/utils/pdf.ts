import PDFDocument from "pdfkit";

export interface IInvoicePDFData {
  title: string;
  invoiceId: string;
  workshopName: string;
  workshopEmail: string;
  workshopAddress?: string;
  billingMonth: string;
  totalJobs: number;
  totalJobAmount: number;
  platformFee: number;
  workshopRevenue: number;
  totalAmount: number;
  dueDate: string;
}

/**
 * Generates a PDF buffer for one or more invoices.
 */
export const generateInvoicePDFBuffer = async (
  data: IInvoicePDFData | IInvoicePDFData[],
): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    // @ts-ignore - PDFDocument constructor sometimes has types discrepancy
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (err: Error) => reject(err));

    const invoiceEntries = Array.isArray(data) ? data : [data];

    invoiceEntries.forEach((entry, index) => {
      if (index > 0) doc.addPage();

      // Header
      doc
        .fillColor("#444444")
        .fontSize(20)
        .text("INVOICE", 50, 50)
        .fontSize(10)
        .text(entry.title, 50, 80)
        .text(`Invoice ID: ${entry.invoiceId}`, 50, 95)
        .moveDown();

      // Workshop Info
      doc
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("Workshop Info", 50, 130)
        .font("Helvetica")
        .fontSize(10)
        .text(`Name: ${entry.workshopName}`, 50, 150)
        .text(`Email: ${entry.workshopEmail}`, 50, 165);
      
      if (entry.workshopAddress) {
        doc.text(`Address: ${entry.workshopAddress}`, 50, 180);
      }

      // Invoice Details Table Header
      const tableTop = 230;
      doc.font("Helvetica-Bold");
      generateTableRow(
        doc,
        tableTop,
        "Description",
        "Details",
        "Amount (DKK)"
      );
      generateHr(doc, tableTop + 20);
      doc.font("Helvetica");

      // Table Rows
      let position = tableTop + 30;
      generateTableRow(doc, position, "Billing Month", entry.billingMonth, "");
      position += 20;
      generateTableRow(doc, position, "Total Jobs", entry.totalJobs.toString(), "");
      position += 20;
      generateTableRow(doc, position, "Total Job Group Amount", "", entry.totalJobAmount.toFixed(2));
      position += 20;
      generateTableRow(doc, position, "Platform Fee (Invoice)", "", entry.platformFee.toFixed(2));
      position += 20;
      generateTableRow(doc, position, "Workshop Revenue", "", entry.workshopRevenue.toFixed(2));
      
      generateHr(doc, position + 20);
      
      // Total
      const totalPosition = position + 30;
      doc.font("Helvetica-Bold");
      generateTableRow(
        doc,
        totalPosition,
        "TOTAL PAYABLE",
        "",
        entry.totalAmount.toFixed(2)
      );
      doc.font("Helvetica");

      // Footer
      doc
        .fontSize(10)
        .text(`Due Date: ${entry.dueDate}`, 50, totalPosition + 50)
        .moveDown()
        .text(
          "Thank you for using our platform!",
          50,
          totalPosition + 80,
          { align: "center", width: 500 }
        );
    });

    doc.end();
  });
};

function generateTableRow(
  doc: any,
  y: number,
  item: string,
  description: string,
  amount: string
) {
  doc
    .fontSize(10)
    .text(item, 50, y)
    .text(description, 150, y)
    .text(amount, 0, y, { align: "right" });
}

function generateHr(doc: any, y: number) {
  doc
    .strokeColor("#aaaaaa")
    .lineWidth(1)
    .moveTo(50, y)
    .lineTo(550, y)
    .stroke();
}
