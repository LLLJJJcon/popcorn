insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-00000000a001',
   'authenticated', 'authenticated', 'owner-a@popcorn.test',
   '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.', '2026-08-16 09:00:00+00',
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   '2026-08-16 09:00:00+00', '2026-08-16 09:00:00+00'),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-00000000b002',
   'authenticated', 'authenticated', 'owner-b@popcorn.test',
   '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.', '2026-08-16 09:01:00+00',
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   '2026-08-16 09:01:00+00', '2026-08-16 09:01:00+00')
on conflict (id) do nothing;

insert into public.profiles (user_id, created_at, updated_at)
values
  ('00000000-0000-4000-8000-00000000a001', '2026-08-16 09:00:00+00', '2026-08-16 09:00:00+00'),
  ('00000000-0000-4000-8000-00000000b002', '2026-08-16 09:01:00+00', '2026-08-16 09:01:00+00')
on conflict (user_id) do nothing;

insert into public.video_sources (id, user_id, youtube_video_id, canonical_url, created_at, updated_at)
values (
  '10000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-00000000a001',
  'dQw4w9WgXcQ',
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  '2026-08-16 10:00:00+00',
  '2026-08-16 10:00:00+00'
)
on conflict (id) do nothing;

insert into public.video_snapshots (
  id, user_id, video_source_id, title, channel, thumbnail_url, duration_seconds,
  description, transcript_language, transcript_hash, captured_at, created_at
)
values (
  '20000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-00000000a001',
  '10000000-0000-4000-8000-000000000001',
  '中文学习示例',
  '爆米中文',
  'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
  180,
  '用于本地数据库验证的原生简体中文字幕。',
  'zh-CN',
  repeat('a', 64),
  '2026-08-16 10:00:00+00',
  '2026-08-16 10:00:00+00'
)
on conflict (id) do nothing;

insert into public.transcript_segments (
  id, user_id, snapshot_id, stable_id, position, original_chinese,
  start_seconds, end_seconds, language, created_at
)
values
  ('30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000a001',
   '20000000-0000-4000-8000-000000000001', 'seg-a-1', 0,
   '今天我们来学中文。', 0, 4, 'zh-CN', '2026-08-16 10:00:01+00'),
  ('30000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-00000000a001',
   '20000000-0000-4000-8000-000000000001', 'seg-a-2', 1,
   '这个表达在口语里很常见。', 4, 9, 'zh-CN', '2026-08-16 10:00:02+00'),
  ('30000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-00000000a001',
   '20000000-0000-4000-8000-000000000001', 'seg-a-3', 2,
   '请你试着用它造一个新句子。', 9, 14, 'zh-CN', '2026-08-16 10:00:03+00')
on conflict (id) do nothing;
