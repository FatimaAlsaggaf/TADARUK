/**
 * Repair photos are compressed before storing on the ticket so the reporter can
 * see the exact photo on another device. No external image service is involved.
 */
const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const MAX_ENCODED_CHARS = 700_000;

async function loadPhoto(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Cannot decode selected image'));
    img.src = src;
  });
}

function compressImage(img: HTMLImageElement): string {
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  if (!width || !height) throw new Error('Image has no dimensions');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Image processing is unavailable');

  for (const maxEdge of [1200, 960, 780, 640, 500]) {
    const scale = Math.min(1, maxEdge / Math.max(width, height));
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.78, 0.65, 0.52, 0.42]) {
      const result = canvas.toDataURL('image/jpeg', quality);
      if (result.startsWith('data:image/jpeg;base64,') && result.length <= MAX_ENCODED_CHARS) {
        return result;
      }
    }
  }
  throw new Error('Photo could not be compressed to the supported size');
}

export async function prepareRepairPhoto(file: File): Promise<string> {
  if (file.size > MAX_SOURCE_BYTES || !['image/jpeg', 'image/png'].includes(file.type)) {
    throw new Error('Upload a JPG or PNG photo up to 12 MB');
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await loadPhoto(url);
    return compressImage(img);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function prepareSavedRepairPhoto(value: string): Promise<string> {
  if (/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(value) && value.length <= MAX_ENCODED_CHARS) return value;
  if (!/^data:image\/(?:jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(value) || value.length > 18_000_000)
    throw new Error('Invalid saved repair photo');
  return compressImage(await loadPhoto(value));
}
