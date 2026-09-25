/** Browser-side receipt card. Built entirely on the device so the TIP ID never makes an extra network trip. */
export async function downloadTipCard(orgName: string, tipId: string) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  const page = doc.addPage([226, 340]); // small receipt
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const mono = await doc.embedFont(StandardFonts.CourierBold);
  const safe = (s: string) => s.replace(/[^\x20-\x7E]/g, '?');
  const wrap = (text: string, size: number, max: number) => {
    const out: string[] = [];
    let line = '';
    for (const w of safe(text).split(' ')) {
      const next = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(next, size) > max && line) { out.push(line); line = w; } else line = next;
    }
    return [...out, line];
  };
  const center = (t: string, y: number, size: number, f = font) => page.drawText(t, { x: (226 - f.widthOfTextAtSize(t, size)) / 2, y, size, font: f });

  center(safe(orgName).slice(0, 34), 310, 11, bold);
  center('Anonymous tip receipt', 294, 9);
  page.drawLine({ start: { x: 16, y: 284 }, end: { x: 210, y: 284 }, thickness: 0.5, color: rgb(0.5, 0.5, 0.5) });
  center('YOUR TIP ID', 262, 9, bold);
  center(tipId, 236, 20, mono);
  page.drawLine({ start: { x: 16, y: 222 }, end: { x: 210, y: 222 }, thickness: 0.5, color: rgb(0.5, 0.5, 0.5) });
  let y = 204;
  const url = `${window.location.origin}/check`;
  for (const l of [
    ...wrap(`To check back or chat with a reviewer, go to ${url} and enter this TIP ID and the passcode you chose.`, 9, 194),
    '',
    ...wrap('This card does NOT contain your passcode. Neither can be recovered if lost.', 9, 194),
    '',
    ...wrap('Keep this card private. Do not share it.', 9, 194),
  ]) {
    page.drawText(l, { x: 16, y, size: 9, font });
    y -= 12;
  }
  const bytes = await doc.save();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
  a.download = 'tip-receipt.pdf';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
