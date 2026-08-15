-- BCB Site Editor — image/video media support
alter table public.site_content drop constraint if exists site_content_content_type_check;
alter table public.site_content add constraint site_content_content_type_check
check (content_type in ('text','image','video'));

update storage.buckets
set file_size_limit = 157286400,
    allowed_mime_types = array[
      'image/jpeg','image/png','image/webp','image/avif',
      'video/mp4','video/webm'
    ]
where id = 'site-content';
