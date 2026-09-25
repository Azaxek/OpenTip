import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import QRCode from 'qrcode';
import type { Org } from './org';
import { appUrl } from './url';

export const submitUrl = () => `${appUrl()}/submit`;

export const qrPng = (url: string) => QRCode.toBuffer(url, { width: 900, margin: 2, errorCorrectionLevel: 'M' });

// Standard PDF fonts only cover Latin-1 plus a few typographic marks; anything else would make pdf-lib throw.
const safe = (s: string) => s.replace(/[^\t\n\x20-\x7E\xA0-\xFF‘’“”–—…•]/g, '?');

function wrap(text: string, font: PDFFont, size: number, max: number): string[] {
  const lines: string[] = [];
  for (const para of safe(text).split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > max && line) { lines.push(line); line = word; } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

const hex = (c: string) => rgb(parseInt(c.slice(1, 3), 16) / 255, parseInt(c.slice(3, 5), 16) / 255, parseInt(c.slice(5, 7), 16) / 255);

export async function posterPdf(org: Org): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([612, 792]);
  const brand = hex(org.primary_color);
  const center = (t: string, y: number, size: number, f: PDFFont, color = rgb(0.1, 0.1, 0.1)) => {
    const s = safe(t);
    page.drawText(s, { x: (612 - f.widthOfTextAtSize(s, size)) / 2, y, size, font: f, color });
  };
  page.drawRectangle({ x: 0, y: 662, width: 612, height: 130, color: brand });
  center('SEE SOMETHING?', 730, 44, bold, rgb(1, 1, 1));
  center('SAY SOMETHING.', 682, 44, bold, rgb(1, 1, 1));
  center(org.name, 620, 26, bold, brand);
  center('Submit an anonymous tip - no name, no phone number, no tracking.', 585, 15, font);
  const qr = await doc.embedPng(await qrPng(submitUrl()));
  page.drawImage(qr, { x: 156, y: 200, width: 300, height: 300 });
  center('Scan with your phone camera', 170, 16, bold);
  center(submitUrl(), 148, 12, font, rgb(0.3, 0.3, 0.3));
  if (org.hotline) center(`Or call: ${org.hotline}`, 110, 18, bold, brand);
  center('In an emergency or if someone is in immediate danger, call 911. This tip line is not monitored in real time.', 60, 10, font, rgb(0.35, 0.35, 0.35));
  return doc.save();
}

export function defaultLetter(org: Org): string {
  const campus = org.org_type === 'campus';
  return `Dear ${campus ? 'Parents and Guardians' : 'Neighbors'},

${campus ? 'Keeping our students safe is a responsibility we share.' : 'Safer communities start with neighbors who speak up.'} ${org.name} offers a free, anonymous way to report ${campus ? 'bullying, threats, safety concerns, or a friend who may need help' : 'crime or safety concerns'}.

How it works:
- Visit ${submitUrl()} or scan the QR code on our posters.
- Describe what you know. You never have to give your name, and we do not record who you are or what device you use.
- You receive a TIP ID and a passcode you choose. Use them to check back and to chat with a reviewer - still anonymously.

${campus ? 'Please talk with your child about this resource and when to use it.' : 'Please share this resource with people you know.'}
${org.hotline ? `\nYou can also reach us at ${org.hotline}.\n` : ''}
This form is not monitored in real time. If someone is in immediate danger, call 911.

Thank you for helping keep us safe.

${org.name}`;
}

export async function letterPdf(org: Org, body: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const lines = wrap(body.slice(0, 8000), font, 11, 468);
  let page = doc.addPage([612, 792]);
  page.drawText(safe(org.name), { x: 72, y: 720, size: 18, font: bold, color: hex(org.primary_color) });
  let y = 690;
  for (const l of lines) {
    if (y < 72) { page = doc.addPage([612, 792]); y = 720; }
    page.drawText(l, { x: 72, y, size: 11, font, color: rgb(0.1, 0.1, 0.1) });
    y -= 15;
  }
  return doc.save();
}
