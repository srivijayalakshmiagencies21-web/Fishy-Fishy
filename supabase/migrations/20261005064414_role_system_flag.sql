-- Admin is the only locked role. Manager and Employee can be edited.

update public.roles
set is_system = false
where name in ('Manager', 'Employee');
