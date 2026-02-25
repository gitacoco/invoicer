import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

export async function exportPdf(
  element: HTMLElement,
  filename: string
): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
  });

  const imgWidth = 210; // A4 width in mm
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  const pdf = new jsPDF({
    orientation: imgHeight > 297 ? "portrait" : "portrait",
    unit: "mm",
    format: "a4",
  });

  // If content is taller than one page, scale to fit
  const pageHeight = 297;
  if (imgHeight > pageHeight) {
    const scaledWidth = (imgWidth * pageHeight) / imgHeight;
    const xOffset = (imgWidth - scaledWidth) / 2;
    pdf.addImage(
      canvas.toDataURL("image/png"),
      "PNG",
      xOffset,
      0,
      scaledWidth,
      pageHeight
    );
  } else {
    pdf.addImage(
      canvas.toDataURL("image/png"),
      "PNG",
      0,
      0,
      imgWidth,
      imgHeight
    );
  }

  pdf.save(`${filename}.pdf`);
}
