export interface WatermarkMeta {
  puCode: string;
  /** Human-readable PU name -- shown instead of the bare code when known,
   * since the point of the watermark is someone glancing at the photo
   * recognizing where it's from, not decoding a code. */
  puName?: string;
  lat?: number;
  lng?: number;
}

export interface WatermarkedResult {
  file: File;
  sha256: string;
  capturedAt: string;
}

/** Burns a timestamp/PU/GPS stamp into the bottom of the photo and
 * computes a SHA-256 of the final bytes -- a lightweight, no-external-
 * service "proof of submission": an admin can see at a glance when/where
 * it claims to have been taken, and the hash lets anyone verify the
 * exact bytes weren't altered after upload. Not OCR -- doesn't read the
 * vote counts, just makes the image itself independently verifiable. */
export async function watermarkAndHash(file: File, meta: WatermarkMeta): Promise<WatermarkedResult> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas isn't supported on this device/browser.");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const capturedAt = new Date().toISOString();
  const lines = [
    meta.puName ? `${meta.puName} (${meta.puCode})` : `PU ${meta.puCode}`,
    new Date(capturedAt).toLocaleString(),
    meta.lat != null && meta.lng != null ? `${meta.lat.toFixed(5)}, ${meta.lng.toFixed(5)}` : "Location unavailable",
  ];

  const fontSize = Math.max(16, Math.round(canvas.width * 0.022));
  const padding = fontSize * 0.7;
  const lineHeight = fontSize * 1.35;
  const boxHeight = lineHeight * lines.length + padding * 2;

  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(0, canvas.height - boxHeight, canvas.width, boxHeight);
  ctx.fillStyle = "#ffffff";
  ctx.font = `${fontSize}px sans-serif`;
  ctx.textBaseline = "top";
  lines.forEach((line, i) => {
    ctx.fillText(line, padding, canvas.height - boxHeight + padding + i * lineHeight);
  });

  const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't process the photo."))), outputType, 0.92);
  });

  const hashBuffer = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  const sha256 = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return { file: new File([blob], file.name, { type: blob.type }), sha256, capturedAt };
}
