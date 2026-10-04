/** تصغير صورة من الجهاز قبل إرسالها لـ Gemini (أسرع وأقل استهلاكًا). */
export interface PreparedImage {
  mime: 'image/jpeg'
  data: string
  /** للمعاينة فقط. */
  url: string
}

export async function prepareImage(file: File, maxSide = 1280, quality = 0.82): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const url = canvas.toDataURL('image/jpeg', quality)
  return { mime: 'image/jpeg', data: url.slice(url.indexOf(',') + 1), url }
}
