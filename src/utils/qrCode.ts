import qrcode from 'qrcode-generator';

/**
 * QR code en SVG (data URL), calculé dans le navigateur.
 * Remplace l'appel à api.qrserver.com, qui recevait le numéro de facture, le nom
 * du client et le montant : plus aucune donnée ne quitte le poste.
 */
export function qrCodeDataUrl(text: string, color = '#00182f', margin = 1): string {
  const qr = qrcode(0, 'M');
  // Le mode « Byte » lit un octet par caractère : on lui passe les octets UTF-8,
  // sinon les accents des noms de clients seraient tronqués.
  const utf8 = String.fromCharCode(...new TextEncoder().encode(text));
  qr.addData(utf8, 'Byte');
  qr.make();

  const count = qr.getModuleCount();
  const size = count + margin * 2;
  let d = '';
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) d += `M${col + margin} ${row + margin}h1v1h-1z`;
    }
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">` +
    `<rect width="${size}" height="${size}" fill="#ffffff"/><path d="${d}" fill="${color}"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
