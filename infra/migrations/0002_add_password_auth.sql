-- Migration: 0002_add_password_auth.sql
-- Add password hash column for email/password authentication

ALTER TABLE users ADD COLUMN password_hash TEXT;
