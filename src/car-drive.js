async function driveRequest(url, accessToken, options = {}) {
  const response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${accessToken}`, ...options.headers } });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    let message = `Google Drive ตอบกลับ (${response.status})`;
    try { message = JSON.parse(detail).error?.message || message; } catch {}
    throw new Error(message);
  }
  return response;
}

export async function uploadCarImage(accessToken, file) {
  if (!(file instanceof Blob)) throw new Error('ไม่พบไฟล์รูปภาพ');
  const boundary = `xswift_${crypto.randomUUID().replaceAll('-', '')}`;
  const metadata = { name: `xswift-${Date.now()}-${file.name || 'photo'}`, mimeType: file.type || 'image/jpeg' };
  const prefix = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${metadata.mimeType}\r\n\r\n`;
  const suffix = `\r\n--${boundary}--`;
  const response = await driveRequest('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: new Blob([prefix, file, suffix])
  });
  const fileInfo = await response.json();
  if (!fileInfo.id) throw new Error('อัปโหลดรูปไม่สำเร็จ');
  return { fileId: fileInfo.id };
}

export async function loadCarImage(accessToken, fileId) {
  if (!fileId) return '';
  const response = await driveRequest(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, accessToken);
  return URL.createObjectURL(await response.blob());
}
