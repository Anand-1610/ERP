-- Supabase RLS Policy Examples for GLBXTNT ERP System
-- Assumes users are authenticated and their email is available as auth.uid() or session variable

-- Enable RLS on all tables
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Employees table: Only Admin/Manager/Finance can view all, users can view their own
CREATE POLICY "Allow admin/manager/finance to view all employees" ON employees
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM employees e WHERE e.email = auth.email() AND e.role IN ('Admin', 'Manager', 'Finance')
    )
  );
CREATE POLICY "Allow user to view own employee record" ON employees
  FOR SELECT USING (email = auth.email());

-- Attendance table: Users can view/insert/update their own, Admin/Manager can view all
CREATE POLICY "Allow user to manage own attendance" ON attendance
  FOR ALL USING (
    employee_id = (SELECT id FROM employees WHERE email = auth.email())
  );
CREATE POLICY "Allow admin/manager to view all attendance" ON attendance
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM employees e WHERE e.email = auth.email() AND e.role IN ('Admin', 'Manager')
    )
  );

-- Salaries table: Only Admin/Finance can insert/view
CREATE POLICY "Allow admin/finance to manage salaries" ON salaries
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM employees e WHERE e.email = auth.email() AND e.role IN ('Admin', 'Finance')
    )
  );

-- Finance transactions: Only Admin/Finance can insert/view
CREATE POLICY "Allow admin/finance to manage finance transactions" ON finance_transactions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM employees e WHERE e.email = auth.email() AND e.role IN ('Admin', 'Finance')
    )
  );

-- Audit logs: Only Admin/Finance can view
CREATE POLICY "Allow admin/finance to view audit logs" ON audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM employees e WHERE e.email = auth.email() AND e.role IN ('Admin', 'Finance')
    )
  );
