import { supabase } from './supabase';

const BUCKET = 'bill-images';

export async function uploadBillImage(file: File, month: string, utility: string): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${month}/${utility}_${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file);
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteBillImage(imageUrl: string): Promise<void> {
  try {
    const url = new URL(imageUrl);
    // Public URL format: .../storage/v1/object/public/bill-images/path
    const parts = url.pathname.split(`/object/public/${BUCKET}/`);
    if (parts.length < 2) return;
    const path = decodeURIComponent(parts[1]);
    await supabase.storage.from(BUCKET).remove([path]);
  } catch {
    // Image may already be deleted
  }
}
