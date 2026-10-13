-- FY rows are created in the app (+ Add FY), not seeded at migration time.

delete from public.financial_years
where label in ('2024-25', '2025-26', '2026-27', '2027-28');
