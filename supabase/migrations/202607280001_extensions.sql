-- Snapshot estrutural do projeto edienai.
-- Fonte: Supabase Management API em 2026-07-28.
-- As versões não são fixadas para acompanhar a política atual da plataforma.

create schema if not exists extensions;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pg_trgm with schema public;
