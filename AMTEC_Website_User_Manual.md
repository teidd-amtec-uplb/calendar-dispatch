# AMTEC Calendar Dispatch System User Manual

Prepared for: Agricultural Machinery Testing and Evaluation Center (AMTEC)  
System: Calendar Dispatch and AMaTS Testing Scheduler  
Last updated: April 30, 2026

---

## 1. Purpose of the Website

The AMTEC Calendar Dispatch System is a web-based scheduling and monitoring tool for managing field dispatches, AMaTS testing sessions, personnel workloads, equipment assignments, and dispatch-related documents.

The website helps AMTEC personnel:

- View scheduled dispatches and AMaTS testing sessions in one place.
- Check the availability of engineers, technicians, machines, and instruments.
- Create, edit, and monitor dispatch records.
- Create and manage AMaTS testing sessions.
- Track workload through a month-based calendar view.
- Generate official dispatch documents for assigned personnel.
- Manage staff records and account activation.

---

## 2. User Roles

Access and available menu items depend on the user's role.

### Admin Scheduler

The Admin Scheduler can:

- View the dashboard.
- View, create, edit, and manage dispatches.
- View the workload calendar.
- Access the admin panel.
- Add or remove engineers and technicians from the staff directory.
- Activate pending user accounts if using the authorized verifier email.
- Manage account settings.

### AMaTS User

The AMaTS user can:

- View the dashboard.
- View and manage AMaTS testing sessions.
- Create new AMaTS testing forms.
- View the workload calendar.
- Access the admin panel.
- Activate pending user accounts if using the authorized verifier email.
- Manage account settings.

### Staff, Engineer, or Technician

Staff users can:

- View assigned dispatches.
- View their own calendar.
- View the public calendar and workload view.
- Update account settings.

### Public Viewer

Some pages are available without logging in:

- Public Calendar
- Workload View

These public pages are intended for shared viewing, monitoring, or quick reference.

---

## 3. Logging In

1. Open the AMTEC Calendar Dispatch website.
2. Go to the Login page.
3. Enter your registered email address and password.
4. Click the login button.
5. After successful login, the website redirects to the Dashboard.

If login fails, check that:

- The email address is correct.
- The password is correct.
- The account has already been activated by an authorized AMTEC verifier.

---

## 4. Creating a New Account

1. Open the Signup page.
2. Enter the required information:
   - Full name
   - Email address
   - Requested role
   - Password
   - Password confirmation
3. Submit the signup form.
4. Wait for an authorized AMTEC verifier to activate the account.

New accounts are inactive by default. Users cannot access protected pages until the account is activated.

---

## 5. Activating Pending Accounts

Pending account activation is shown in the sidebar for authorized verifier accounts.

1. Log in using the authorized verifier account.
2. Look for the Pending Signups notification in the sidebar.
3. Expand the pending signup list.
4. Review the user's name and requested role.
5. Click Activate.

After activation, the user can log in and access the website according to the assigned role.

Note: The verifier account currently used by the system is `teidd.amtec.uplb@up.edu.ph`.

---

## 6. Sidebar Navigation

The sidebar is the main navigation area of the website.

### Admin Scheduler Menu

- Dashboard
- Dispatches
- Workload
- New Dispatch
- Admin Panel
- Account Settings

### AMaTS Menu

- Dashboard
- AMaTS Sessions
- Workload
- New Testing Form
- Admin Panel
- Account Settings

### Staff Menu

- Dashboard
- Dispatches
- My Calendar
- Public Calendar
- Workload
- Account Settings

Use the sidebar to move between pages. The active page is highlighted.

---

## 7. Dashboard

The Dashboard gives a month-based summary of dispatch activity.

### Dashboard Contents

- Total dispatches
- Scheduled dispatches
- Ongoing dispatches
- Completed dispatches
- Monthly calendar view
- Dispatch details for selected dates
- Detailed dispatch table for the selected month

### How to Use the Dashboard

1. Open Dashboard from the sidebar.
2. Use the previous and next month buttons to change months.
3. Click Today to return to the current month.
4. Click a calendar day to view dispatches scheduled on that date.
5. Use the source filter to view records by source, such as Scheduler or AMaTS.
6. Review the dispatch table below the calendar for complete monthly details.

### Dispatch Status Colors

The dashboard uses visual status indicators for:

- Pending
- Scheduled
- Re-scheduled
- Ongoing
- Cancelled
- Done

---

## 8. Dispatches Page

The Dispatches page lists dispatch records in table form.

### Available Actions

- Search dispatches by dispatch number, company, or location.
- Filter by status.
- Filter by month.
- Filter by creator.
- Filter by assigned personnel.
- Sort by date, dispatch number, engineers, or technicians.
- Open a dispatch detail page by selecting a row.
- Download or export dispatch-related files when available.

### How to View a Dispatch

1. Open Dispatches from the sidebar.
2. Search or filter until the desired dispatch appears.
3. Click the dispatch row.
4. The system opens the Dispatch Detail page.

---

## 9. Creating a New Dispatch

Only authorized scheduler users can create dispatches.

1. Open New Dispatch from the sidebar.
2. Complete the Basic Info tab.
3. Add instruments in the Instruments tab, if needed.
4. Add machines in the Machines tab, if needed.
5. Review all entered information.
6. Save the dispatch.

### Basic Info Tab

Enter the following information:

- Dispatch number
- Date from
- Date to
- Lead engineer
- Assistant engineer or engineers
- Technician or technicians
- Company or client
- Contact person or contact information
- Location of testing
- Mode of transportation
- Remarks or observation
- Notes

The dispatch number should follow the format `DIS-YYYY-####`, for example `DIS-2026-0001`.

### Personnel Assignment

When the dispatch dates are selected, the system checks staff availability.

- Available personnel can be selected.
- Unavailable personnel are shown as unavailable and should not be assigned.
- The Lead Engineer field is required.
- Assistant Engineers and Technicians are optional depending on the dispatch requirements.

### Company and Client Information

Use the company search field to search for an existing company or type a new company name.

If an existing company is selected, available contact information may be filled automatically.

### Location of Testing

Choose one:

- AMTEC, for in-house testing.
- Client's Place, for field or on-site testing.

If Client's Place is selected, enter the testing address.

### Transportation

Choose one:

- Public Conveyance
- Test Applicant Vehicle
- College Vehicle
- Other

If Other is selected, enter the specific transportation mode.

---

## 10. Adding Instruments to a Dispatch

Use the Instruments tab when a dispatch requires test instruments.

1. Open the Instruments tab.
2. Click Add Instrument if another row is needed.
3. Search by instrument name, code, or brand.
4. Select the correct instrument from the list.
5. Review the auto-filled Code / Brand / Model field.
6. Select the Before Travel condition:
   - Good Condition
   - Not Good Condition
7. Add remarks if needed.

Booked instruments are marked as booked and should not be selected for overlapping schedules.

---

## 11. Adding Machines to a Dispatch

Use the Machines tab when a dispatch involves one or more machines for testing.

1. Open the Machines tab.
2. Click Add Machine if another machine row is needed.
3. Enter or select the machine name.
4. Enter the TAM number.
5. Enter brand, model, and serial number.
6. Enter the date of test.

When a machine is selected, the system may automatically add required instruments to the Instruments tab.

---

## 12. Editing a Dispatch

1. Open Dispatches.
2. Select the dispatch record.
3. On the Dispatch Detail page, click Edit Dispatch.
4. Update the necessary fields.
5. Save the dispatch.

The edit form uses the same major sections as the create form:

- Basic Info
- Instruments
- Itinerary
- Machines

Note: The Itinerary tab currently appears in the form, but itinerary entry is not yet implemented.

---

## 13. Dispatch Detail Page

The Dispatch Detail page is a read-only summary of one dispatch.

It shows:

- Dispatch number
- Current status
- Company name
- Contact information
- Date from and date to
- Type of testing
- Location
- Transport mode
- Assigned engineers
- Assigned technicians
- Instruments
- Machines
- Remarks and notes

Authorized users can edit the dispatch from this page.

---

## 14. Generating Dispatch Documents

The Dispatch Detail page includes document generation for official files.

1. Open a dispatch record.
2. Click Export Documents or Generate Documents.
3. In the document modal, click Generate All Documents.
4. Wait for the system to finish generating the files.
5. Download the generated documents.

The system is designed to generate documents such as:

- Dispatch form
- Travel request form
- SAL sample acceptance form

Generated documents may also be emailed to assigned personnel if email delivery is configured and available.

---

## 15. My Calendar

The My Calendar page is used mainly by logged-in staff to view assigned dispatches.

1. Open My Calendar from the sidebar.
2. Use the month and week controls to change the calendar view.
3. Click Today to return to the current date.
4. Click a date to view dispatches assigned on that day.

This page is useful for staff members who need to check their own schedule.

---

## 16. Public Calendar

The Public Calendar is available without login.

Use it to view shared dispatch and AMaTS schedule information.

1. Open Public Calendar.
2. Use the month navigation buttons to move between months.
3. Use filters to view records by status or source.
4. Click a dispatch or AMaTS session to view its summary panel.

The Public Calendar is useful for display screens, quick reference, or users who only need read-only schedule information.

---

## 17. Workload View

The Workload View shows engineer and technician assignments in a monthly grid.

It displays:

- Engineers
- Technicians
- Dispatch assignments
- AMaTS sessions
- Leave or absence markers
- Work-from-home markers
- Meeting or office event markers
- Holidays and suspensions

### How to Use the Workload View

1. Open Workload from the sidebar or public workload link.
2. Use previous and next buttons to change month.
3. Click This Month to return to the current month.
4. Review each staff row and date column.
5. Hover or select marked cells to view more information where available.

### Workload Legend

Common markers include:

- Scheduled dispatch
- Scheduled AMaTS session
- Trip accomplished
- Field Scheduler
- AMaTS Scheduler
- Work from Home
- Meeting / Office Event
- Offset / Emergency Leave
- Half Day AM
- Half Day PM
- Holiday
- No Pasok / Suspension

### Adding Workload Events

Authorized Admin Scheduler and AMaTS users can add workload events.

1. Select an empty cell or drag across multiple empty cells.
2. Choose the event type, such as WFH, Holiday, Meeting, Offset, or Half Day.
3. Add notes if needed.
4. Save the event.

Use Delete or the remove option to clear selected workload events.

---

## 18. AMaTS Testing Sessions

AMaTS users and authorized schedulers can manage AMaTS testing sessions.

### AMaTS Sessions Page

The AMaTS Sessions page lists testing sessions.

Users can:

- Search by session number.
- Search by machine.
- Open a session detail page.
- Copy session information for communication or reporting.
- Create a new AMaTS testing form if authorized.

### Creating a New AMaTS Testing Session

1. Open New Testing Form from the sidebar.
2. Enter the session number, such as `AMaTS-2026-0001`.
3. Select the machine type.
4. Enter the machine name or code.
5. Select the required tests.
6. Enter Date From and Date To.
7. Assign engineers and technicians.
8. Add notes if needed.
9. Save the session.

The system checks personnel availability based on the selected dates.

### Editing an AMaTS Session

1. Open AMaTS Sessions.
2. Select the session record.
3. Click Edit.
4. Update the necessary information.
5. Save the session.

### AMaTS Session Detail Page

The detail page shows:

- Session number
- Status
- Machine
- Machine name or code
- Date and time schedule
- Selected tests
- Assigned engineers
- Assigned technicians
- Notes

The page also includes a copy function for quickly copying formatted session details.

---

## 19. Admin Panel

The Admin Panel manages the AMTEC staff directory used for scheduling.

### Staff Directory

The staff directory includes:

- Full name
- Surname
- Initials
- Role
- Designation
- Email

### Adding a Staff Member

1. Open Admin Panel.
2. Click Add New Staff Member.
3. Enter the required fields:
   - Full name
   - Surname
   - Initials
   - Role
4. Optionally enter:
   - Designation
   - Email
5. Save the staff member.

### Searching and Filtering Staff

Use the search bar to search by:

- Name
- Initials
- Email

Use the role filters to show:

- All
- Engineers
- Technicians

### Removing a Staff Member

Use the delete action in the staff table to remove a staff member when necessary.

Important: Removing staff should be done carefully because staff records are used in dispatch and AMaTS assignments.

---

## 20. Account Settings

Use Account Settings to manage personal profile and login details.

### Profile Information

Users can review or update profile-related information such as:

- Full name
- Initials or other profile fields shown on the page

### Login and Security

Users can update password information when allowed by the authentication system.

If password verification is required:

1. Request a verification code.
2. Check the registered email address.
3. Enter the code.
4. Enter and confirm the new password.
5. Save changes.

---

## 21. Recommended Daily Workflow

### For Admin Schedulers

1. Log in.
2. Check pending signups, if any.
3. Review Dashboard for monthly dispatch activity.
4. Open Workload to check staff availability.
5. Create or edit dispatch records as needed.
6. Generate dispatch documents from the Dispatch Detail page.
7. Review the Public Calendar or Dashboard for final schedule checking.

### For AMaTS Users

1. Log in.
2. Open AMaTS Sessions.
3. Create or update testing sessions.
4. Check Workload for personnel conflicts.
5. Copy session details when needed for coordination.

### For Engineers and Technicians

1. Log in.
2. Open Dashboard or My Calendar.
3. Review assigned dispatches.
4. Use Public Calendar or Workload View for broader schedule reference.
5. Update account settings if needed.

---

## 22. Data Entry Reminders

Use consistent naming and formatting to keep reports clean.

Recommended formats:

- Dispatch number: `DIS-YYYY-####`
- AMaTS session number: `AMaTS-YYYY-####`
- TAM number: use the official AMTEC TAM number format.
- Names: use complete names where possible.
- Initials: use the official staff initials used by AMTEC.
- Dates: verify Date From and Date To before saving.
- Machines and instruments: select from existing suggestions when available.

---

## 23. Troubleshooting

### Cannot Log In

Check:

- Email and password are correct.
- Account has been activated.
- Internet connection is working.

### Account Created but Cannot Access the Website

The account may still be inactive. Ask the authorized verifier to activate the account.

### Staff Member Is Unavailable

The staff member may already have:

- A dispatch on overlapping dates.
- An AMaTS testing session.
- A workload event such as leave, holiday, or suspension.

Check the Workload View before assigning personnel.

### Instrument Is Marked Booked

The instrument may already be assigned to another dispatch during the selected dates. Choose another instrument or adjust the schedule.

### Generated Document Is Missing or Email Was Not Sent

Check:

- The dispatch has assigned personnel.
- Assigned personnel have email addresses in the staff directory.
- The document generation and email service are properly configured.

### Calendar Does Not Show Expected Records

Try:

- Refreshing the page.
- Checking the selected month.
- Checking active filters.
- Confirming the dispatch or session was saved successfully.

---

## 24. Current System Notes for Handover

These notes are included so AMTEC is aware of current system behavior.

- The Itinerary tab appears in dispatch create and edit forms, but itinerary entry is not yet implemented.
- New account activation is handled from the sidebar by the authorized verifier account.
- Public Calendar and Workload View can be accessed without login.
- Staff records in the Admin Panel are separate from login accounts.
- Document generation depends on the configured document and email services.
- If deployment is moved to a new server, confirm that environment variables, Supabase credentials, and email settings are configured.

---

## 25. Suggested Handover Checklist

Before turnover, confirm the following:

- AMTEC has the website URL.
- AMTEC has at least one active Admin Scheduler account.
- The authorized verifier account is active.
- Staff directory contains current engineers and technicians.
- Company, machine, and instrument records are populated.
- Dispatch creation has been tested.
- AMaTS session creation has been tested.
- Workload View displays assignments correctly.
- Public Calendar displays shared records correctly.
- Document generation has been tested.
- Email sending has been tested.
- AMTEC knows who to contact for technical support.

---

## 26. Quick Reference

| Task | Page |
| --- | --- |
| Log in | Login |
| Create account | Signup |
| Activate accounts | Sidebar Pending Signups |
| View monthly dispatch summary | Dashboard |
| Search dispatch records | Dispatches |
| Create dispatch | New Dispatch |
| Edit dispatch | Dispatch Detail > Edit Dispatch |
| Generate documents | Dispatch Detail > Export Documents |
| View personal schedule | My Calendar |
| View shared schedule | Public Calendar |
| View all staff workload | Workload |
| Create AMaTS testing session | New Testing Form |
| Manage AMaTS sessions | AMaTS Sessions |
| Add staff member | Admin Panel |
| Update profile or password | Account Settings |

