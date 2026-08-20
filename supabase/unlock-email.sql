-- If an email is stuck (account exists, password unknown), run this in the
-- SQL editor, then Create account again with that email.
-- https://supabase.com/dashboard/project/igpojrcpqywfszyvxsla/sql/new

delete from auth.users
where lower(email) = lower('tharssith@gmail.com');
