-- ============================================================
-- Storage bucket setup for prescription uploads
-- Run this AFTER creating the bucket in Supabase Dashboard
-- (Storage → New Bucket → name: "prescriptions" → Public: OFF)
-- ============================================================

-- Customers can upload to their own folder: prescriptions/{user_id}/...
CREATE POLICY "Customers upload own prescriptions"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'prescriptions'
  AND (storage.foldername(name))[1] = 'prescriptions'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Customers can view their own uploaded prescriptions
CREATE POLICY "Customers view own prescriptions"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'prescriptions'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Pharmacists and admins can view all prescriptions
CREATE POLICY "Staff view all prescriptions"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'prescriptions'
  AND get_user_role() IN ('pharmacist', 'admin')
);

-- Note: In production, set the bucket to PRIVATE and use
-- supabase.storage.from('prescriptions').createSignedUrl(path, 3600)
-- instead of getPublicUrl() to generate temporary, secure access links.
-- The frontend code in PrescriptionReviewPage.jsx already includes
-- a createSignedUrl helper for this purpose.
