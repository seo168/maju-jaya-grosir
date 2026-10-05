-- Schema v1: authenticated, approved accounts only. Run on a NEW project.
begin;
-- Jalankan pada proyek baru. Semua data dibatasi per akun pemilik.
create table public.customers (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references auth.users(id),
 credit_health text not null default '' check(credit_health in ('','Sangat baik','Baik','Tidak baik','Butuh perhatian')),
 registered_id text not null default '' check(length(registered_id) <= 100),
 name text not null check (length(trim(name)) > 0),
 city text not null check(length(trim(city)) > 0),
 payment_type text not null check(payment_type in ('cash','credit')),
 term_days integer not null, credit_limit bigint not null check(credit_limit between 0 and 1000000000000),
 check((payment_type = 'cash' and term_days = 0 and credit_limit = 0) or (payment_type = 'credit' and term_days between 1 and 3650)),
 phone text not null default '', address text not null default '',
 created_at timestamptz not null default now(), unique(id, owner_id)
);
create table public.debts (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references auth.users(id),
 customer_id uuid not null,
 amount bigint not null check(amount > 0 and amount <= 1000000000000),
 date date not null default current_date,
 due_date date not null, note text not null default '',
 created_at timestamptz not null default now(),
 foreign key(customer_id, owner_id) references public.customers(id, owner_id),
 unique(id, owner_id), check(due_date >= date)
);
create table public.payments (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references auth.users(id),
 debt_id uuid not null,
 amount bigint not null check(amount > 0), date date not null default current_date,
 method text not null check(method in ('Tunai','Transfer bank','QRIS')),
 note text not null default '', created_at timestamptz not null default now(),
 foreign key(debt_id, owner_id) references public.debts(id, owner_id)
);
alter table public.customers enable row level security;
alter table public.debts enable row level security;
alter table public.payments enable row level security;
create policy own_customers_read on public.customers for select to authenticated using(owner_id = auth.uid());
create policy own_customers_insert on public.customers for insert to authenticated with check(owner_id = auth.uid());
create policy own_customers_update on public.customers for update to authenticated using(owner_id = auth.uid()) with check(owner_id = auth.uid());
create policy own_debts_read on public.debts for select to authenticated using(owner_id = auth.uid());
create policy own_debts_insert on public.debts for insert to authenticated with check(owner_id = auth.uid());
create policy own_payments_read on public.payments for select to authenticated using(owner_id = auth.uid());
create policy own_payments_insert on public.payments for insert to authenticated with check(owner_id = auth.uid());
-- Kunci tagihan agar pembayaran bersamaan tidak melebihi saldo.
create function public.validate_payment() returns trigger language plpgsql security definer set search_path = public as $$
declare bill public.debts; received bigint;
begin
 if new.owner_id is distinct from auth.uid() then raise exception 'Akses ditolak'; end if;
 select * into bill from public.debts where id = new.debt_id and owner_id = auth.uid() for update;
 if not found then raise exception 'Tagihan tidak ditemukan'; end if;
 select coalesce(sum(amount),0) into received from public.payments where debt_id = new.debt_id;
 if new.amount > bill.amount - received then raise exception 'Pembayaran melebihi sisa utang'; end if;
 if new.date < bill.date or new.date > current_date then raise exception 'Tanggal pembayaran tidak valid'; end if;
 return new;
end $$;
create trigger validate_payment before insert on public.payments for each row execute function public.validate_payment();
create index on public.debts(owner_id, due_date);
create index on public.payments(debt_id);

-- Serialisasi utang per langganan agar transaksi bersamaan tidak melewati limit.
create function public.validate_debt_limit() returns trigger language plpgsql security definer set search_path = public as $$
declare buyer public.customers; owed bigint;
begin
 if new.owner_id is distinct from auth.uid() then raise exception 'Akses ditolak'; end if;
 if new.date > current_date then raise exception 'Tanggal transaksi tidak valid'; end if;
 select * into buyer from public.customers where id = new.customer_id and owner_id = auth.uid() for update;
 if not found then raise exception 'Langganan tidak ditemukan'; end if;
 if buyer.payment_type = 'cash' then raise exception 'Langganan bayar di tempat tidak dapat berutang'; end if;
 select coalesce(sum(d.amount - coalesce((select sum(p.amount) from public.payments p where p.debt_id = d.id),0)),0)
 into owed from public.debts d where d.customer_id = new.customer_id;
 if owed + new.amount > buyer.credit_limit then raise exception 'Limit utang terlampaui'; end if;
 return new;
end $$;
create trigger validate_debt_limit before insert on public.debts for each row execute function public.validate_debt_limit();
create function public.validate_customer_limit() returns trigger language plpgsql security definer set search_path = public as $$
declare owed bigint;
begin
 select coalesce(sum(d.amount - coalesce((select sum(p.amount) from public.payments p where p.debt_id = d.id),0)),0)
 into owed from public.debts d where d.customer_id = old.id;
 if new.credit_limit < owed then raise exception 'Limit lebih kecil dari utang aktif'; end if;
 return new;
end $$;
create trigger validate_customer_limit before update on public.customers for each row execute function public.validate_customer_limit();

-- Rancangan pengiriman untuk integrasi mendatang; belum terhubung ke UI.
create table public.orders (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references auth.users(id),
 destination_address text not null check(length(trim(destination_address)) between 1 and 500),
 recipient_name text not null check(length(trim(recipient_name)) between 1 and 100),
 recipient_phone text not null check(length(trim(recipient_phone)) between 1 and 100),
 delivery_code text not null check(length(trim(delivery_code)) between 1 and 100),
 shipping_date date not null,
 estimated_arrival date not null check(estimated_arrival >= shipping_date),
 driver_name text not null check(length(trim(driver_name)) between 1 and 100),
 driver_phone text not null check(length(trim(driver_phone)) between 1 and 100),
 vehicle_number text not null check(length(trim(vehicle_number)) between 1 and 100),
 comment text not null default '' check(length(comment) <= 1000),
 status text not null default 'scheduled' check(status in ('scheduled','transit','arrived','cancelled')),
 departure_date date, arrival_date date, cancelled_at timestamptz,
 created_at timestamptz not null default now(),
 check(status not in ('transit','arrived') or departure_date is not null),
 check(status <> 'arrived' or (arrival_date is not null and arrival_date >= departure_date)),
 check(status <> 'cancelled' or cancelled_at is not null)
);
alter table public.orders enable row level security;
create policy own_orders_read on public.orders for select to authenticated using(owner_id = auth.uid());
create policy own_orders_insert on public.orders for insert to authenticated with check(owner_id = auth.uid() and status = 'scheduled');
create policy own_orders_update on public.orders for update to authenticated using(owner_id = auth.uid()) with check(owner_id = auth.uid());
create index on public.orders(owner_id, status, estimated_arrival);

create unique index customers_registered_id_unique on public.customers(owner_id, lower(registered_id)) where registered_id <> '';

-- Additional membership gate: signing up alone never grants access.
create table public.approved_accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 enabled boolean not null default true
);
alter table public.approved_accounts enable row level security;
revoke all on public.approved_accounts from public, anon, authenticated;
create function public.is_approved_account() returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.approved_accounts where user_id = auth.uid() and enabled)
$$;
revoke all on function public.is_approved_account() from public, anon;
grant execute on function public.is_approved_account() to authenticated;

create function public.stamp_record() returns trigger language plpgsql set search_path = '' as $$
begin
 if tg_op = 'UPDATE' and (new.id is distinct from old.id or new.owner_id is distinct from old.owner_id) then
  raise exception 'Identitas catatan tidak dapat diubah';
 end if;
 new.updated_at = clock_timestamp();
 return new;
end $$;
do $$
declare t text;
begin
 foreach t in array array['customers','debts','payments','orders'] loop
  execute format('alter table public.%I add column updated_at timestamptz not null default now()',t);
  execute format('create trigger stamp_record before insert or update on public.%I for each row execute function public.stamp_record()',t);
  execute format('create policy approved_only on public.%I as restrictive for all to authenticated using ((select public.is_approved_account())) with check ((select public.is_approved_account()))',t);
  execute format('revoke all on public.%I from public, anon, authenticated',t);
  execute format('grant select, insert on public.%I to authenticated',t);
 end loop;
end $$;
grant update on public.customers, public.orders to authenticated;
-- No editing/deleting posted payments or debts through the client.
revoke all on function public.validate_payment() from public, anon, authenticated;
revoke all on function public.validate_debt_limit() from public, anon, authenticated;
revoke all on function public.validate_customer_limit() from public, anon, authenticated;
revoke all on function public.stamp_record() from public, anon, authenticated;

create function public.validate_order_transition() returns trigger language plpgsql set search_path = '' as $$
begin
 if tg_op = 'INSERT' then
  if new.status <> 'scheduled' or new.departure_date is not null or new.arrival_date is not null then raise exception 'Jadwal baru tidak valid'; end if;
 elsif old.status = 'scheduled' then
  if new.status not in ('scheduled','transit','cancelled') then raise exception 'Status tidak valid'; end if;
  if new.status = 'transit' then
   if new.shipping_date > current_date then raise exception 'Tanggal pengiriman masih di masa depan'; end if;
   new.departure_date = current_date;
  end if;
  if new.status = 'cancelled' then new.cancelled_at = now(); end if;
 elsif old.status = 'transit' and new.status = 'arrived' then
  if new.arrival_date < old.departure_date or new.arrival_date > current_date or new.arrival_date is null then raise exception 'Tanggal tiba tidak valid'; end if;
  if (to_jsonb(new) - array['status','arrival_date','updated_at']) is distinct from (to_jsonb(old) - array['status','arrival_date','updated_at']) then raise exception 'Detail pengiriman tidak dapat diubah setelah jalan'; end if;
 else raise exception 'Perubahan status tidak valid';
 end if;
 return new;
end $$;
create trigger validate_order_transition before insert or update on public.orders for each row execute function public.validate_order_transition();
revoke all on function public.validate_order_transition() from public, anon, authenticated;
commit;
