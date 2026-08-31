-- Same em-dash sweep already done for notification copy (see
-- 20260831005823_drop_emdash_from_notification_copy.sql) — two rows in public.tip
-- (the Help screen's "Good to know" list) still had one.
update public.tip
set body = 'Turn points into money off. Toggle them on at checkout and watch your total drop. No codes to remember.'
where title = 'Spend points at checkout';

update public.tip
set body = 'We confirm the delivery fee and call you before the rider leaves. No surprises at the door.'
where title = 'We call before we deliver';
