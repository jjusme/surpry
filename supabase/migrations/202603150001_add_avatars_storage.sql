-- Create a bucket for user avatars
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Set up RLS for the avatars bucket
-- 1. Allow public to read avatars
create policy "Public Access"
on storage.objects for select
using ( bucket_id = 'avatars' );

-- 2. Allow authenticated users to upload their own avatars
create policy "Users can upload their own avatars"
on storage.objects for insert
with check (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Allow users to update their own avatars
create policy "Users can update their own avatars"
on storage.objects for update
using (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 4. Allow users to delete their own avatars
create policy "Users can delete their own avatars"
on storage.objects for delete
using (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
