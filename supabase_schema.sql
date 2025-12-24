-- Supabase schema for GLBXTNT ERP System

-- Roles table (for reference, not needed if using Supabase Auth roles)
-- CREATE TYPE user_role AS ENUM ('Admin', 'Manager', 'Consultant', 'Finance');

-- Employees
CREATE TABLE employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  role text NOT NULL CHECK (role IN ('Admin', 'Manager', 'Consultant', 'Finance')),
  created_at timestamptz DEFAULT now()
);

-- Attendance
CREATE TABLE attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id),
  in_time timestamptz,
  out_time timestamptz,
  date date NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Salaries
CREATE TABLE salaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id),
  amount numeric NOT NULL,
  entry_type text NOT NULL CHECK (entry_type IN ('manual', 'bonus', 'refund')),
  note text,
  created_at timestamptz DEFAULT now()
);

-- Finance transactions
CREATE TABLE finance_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('credit', 'debit')),
  amount numeric NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Audit logs
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text NOT NULL,
  action text NOT NULL,
  details jsonb,
  created_at timestamptz DEFAULT now()
);
