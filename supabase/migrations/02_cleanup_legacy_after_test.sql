-- OPTIONAL. Run ONLY after at least one device has re-subscribed successfully
-- and you verified its row has vapid_public_key populated.
-- Old VAPID subscriptions can never receive with the new key pair.

SELECT id, user_phone, user_email, created_at
FROM public.push_subscriptions
WHERE vapid_public_key IS NULL
ORDER BY created_at DESC;

-- After verification, uncomment:
-- DELETE FROM public.push_subscriptions WHERE vapid_public_key IS NULL;
