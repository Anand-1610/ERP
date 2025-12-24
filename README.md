
# GLBXTNT ERP System

This is a very basic internal ERP system built with HTML, CSS, vanilla JS, and Supabase (auth + Postgres). You can run it locally or deploy it to GitHub Pages.

## Features
- Login with roles (Admin, Manager, Consultant, Finance)
- Employee list
- Attendance IN/OUT
- Manual salary entry
- Bonuses & refunds
- Finance transactions
- Audit logs

## Constraints
- No backend server
- No frameworks unless necessary
- Code is readable and minimal
- Uses Supabase Row Level Security

## Local Setup Instructions

1. **Clone the repository**
	```
	git clone <your-repo-url>
	cd glbxtnt erp system
	```

2. **Set up Supabase**
	- Create a Supabase project at [https://supabase.com/](https://supabase.com/)
	- Run the SQL in `supabase_schema.sql` and `supabase_rls_policies.sql` in the Supabase SQL editor to create tables and security policies.
	- Get your Supabase project URL and anon key from your Supabase dashboard.
	- Open `js/supabase.js` and update the `SUPABASE_URL` and `SUPABASE_ANON_KEY` with your values.

3. **Run locally**
	- Open the project folder in VS Code.
	- Install the [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension.
	- Right-click `index.html` and select **Open with Live Server**.
	- Or, open `index.html` directly in your browser (some features may not work due to browser security restrictions).

4. **Login and Use**
	- Use the login page to sign up or log in (Supabase Auth must be enabled).
	- Test all features: dashboard, employees, attendance, salary, finance, audit logs.

## Notes
- Make sure your Supabase Auth and Row Level Security (RLS) are configured as per the SQL files.
- If you use folders like `js/` or `css/`, add a `.nojekyll` file to the repo root if deploying to GitHub Pages.

## Deployment
- You can deploy this project to GitHub Pages or any static hosting provider.

---
For any issues, open an issue or contact the maintainer.
