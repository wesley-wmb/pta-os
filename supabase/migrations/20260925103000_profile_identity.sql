begin;

alter table public.profiles
  add column if not exists pronouns text,
  add column if not exists job_title text,
  add column if not exists department text,
  add column if not exists bio text;

alter table public.profiles
  drop constraint if exists profiles_pronouns_length,
  add constraint profiles_pronouns_length
    check (pronouns is null or char_length(pronouns) between 1 and 50),
  drop constraint if exists profiles_job_title_length,
  add constraint profiles_job_title_length
    check (job_title is null or char_length(job_title) between 1 and 100),
  drop constraint if exists profiles_department_length,
  add constraint profiles_department_length
    check (department is null or char_length(department) between 1 and 100),
  drop constraint if exists profiles_bio_length,
  add constraint profiles_bio_length
    check (bio is null or char_length(bio) between 1 and 500);

create or replace function public.update_own_profile(
  p_full_name text,
  p_pronouns text,
  p_job_title text,
  p_department text,
  p_bio text,
  p_avatar_path text,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_name text := btrim(coalesce(p_full_name, ''));
  v_pronouns text := nullif(btrim(coalesce(p_pronouns, '')), '');
  v_job_title text := nullif(btrim(coalesce(p_job_title, '')), '');
  v_department text := nullif(btrim(coalesce(p_department, '')), '');
  v_bio text := nullif(btrim(coalesce(p_bio, '')), '');
  v_avatar_path text := nullif(btrim(coalesce(p_avatar_path, '')), '');
  v_name_parts text[];
  v_initials text;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'PTA_AUTH_REQUIRED';
  end if;

  select profile.*
  into v_profile
  from public.profiles profile
  where profile.id = v_actor
  for update;

  if not found or not v_profile.is_active then
    raise exception using errcode = '42501', message = 'PTA_PROFILE_INACTIVE';
  end if;

  if v_profile.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;

  if char_length(v_name) not between 2 and 120 then
    raise exception using errcode = '22023', message = 'PTA_PROFILE_NAME_INVALID';
  end if;
  if v_pronouns is not null and char_length(v_pronouns) > 50 then
    raise exception using errcode = '22023', message = 'PTA_PROFILE_PRONOUNS_INVALID';
  end if;
  if v_job_title is not null and char_length(v_job_title) > 100 then
    raise exception using errcode = '22023', message = 'PTA_PROFILE_JOB_TITLE_INVALID';
  end if;
  if v_department is not null and char_length(v_department) > 100 then
    raise exception using errcode = '22023', message = 'PTA_PROFILE_DEPARTMENT_INVALID';
  end if;
  if v_bio is not null and char_length(v_bio) > 500 then
    raise exception using errcode = '22023', message = 'PTA_PROFILE_BIO_INVALID';
  end if;
  if v_avatar_path is not null and (
    char_length(v_avatar_path) > 2048
    or v_avatar_path !~ '^https://[^[:space:]]+$'
  ) then
    raise exception using errcode = '22023', message = 'PTA_PROFILE_AVATAR_INVALID';
  end if;

  v_name_parts := regexp_split_to_array(v_name, '\s+');
  v_initials := upper(
    left(v_name_parts[1], 1)
    || case
      when cardinality(v_name_parts) > 1
        then left(v_name_parts[cardinality(v_name_parts)], 1)
      else ''
    end
  );

  update public.profiles
  set
    full_name = v_name,
    initials = v_initials,
    pronouns = v_pronouns,
    job_title = v_job_title,
    department = v_department,
    bio = v_bio,
    avatar_path = v_avatar_path
  where id = v_actor
  returning * into v_profile;

  return jsonb_build_object(
    'id', v_profile.id,
    'full_name', v_profile.full_name,
    'email', v_profile.email,
    'initials', v_profile.initials,
    'avatar_path', v_profile.avatar_path,
    'pronouns', v_profile.pronouns,
    'job_title', v_profile.job_title,
    'department', v_profile.department,
    'bio', v_profile.bio,
    'locale', v_profile.locale,
    'updated_at', v_profile.updated_at
  );
end;
$$;

alter function public.update_own_profile(text, text, text, text, text, text, timestamptz)
  owner to postgres;
revoke all on function public.update_own_profile(text, text, text, text, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.update_own_profile(text, text, text, text, text, text, timestamptz)
  to authenticated;

revoke insert, update, delete, truncate on table public.profiles
  from public, anon, authenticated;

commit;
