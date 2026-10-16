# UX/UI

## 1. Goal

Build a web app for teachers to record student work with QR codes.

- Use `requiremen.txt` and the agreed choices in this plan.
- Before implementing a feature, creating a file, or changing dependencies, read [README.md](README.md) for the required tech stack, folder structure, and file placement rules. Create files in their owning feature as defined there.
- Write all user-facing web text in Thai, including menus, buttons, forms, table labels, loading states, and errors. This plan is in simple English.
- Make the app easy to use on a phone.
- Support Safari and Chrome on iPhone and Android.
- Also support a computer for class lists, Excel files, and printing.
- The teacher needs the internet. There is no app to install.
- Only teachers have an account. Students do not sign in.
- Teachers sign in with Google and can start at once.
- Each teacher can see and change only their own data.
- Record the work status only. There are no file uploads for student work.
- Plan for 30–50 students and 10–30 tasks in each class. Allow larger tables too.

## 2. Look and Feel

- Use `#6eecff` as the main color.
- Use a light page and dark text. Use dark text on the main color too.
- Use solid colors. Do not use purple-to-blue gradients on the web app.
- Keep shadows small and subtle. Use spacing and light borders to separate sections. Avoid large blurred shadows and decorative glow effects.
- Use Noto Sans Thai for web pages, buttons, forms, and tables. Start normal text at 16px and allow browser text scaling.
- Keep the web font files in `web/src/assets/fonts/` and serve them from the app. Do not load fonts from an external font service at runtime.
- Use clear Thai text, large buttons, and enough space to tap.
- Show a status with words as well as color.
- Keep the same names, buttons, and page layout across the app.
- Keep the main action easy to see on a small screen.
- Check long Thai names and large text on a phone.

## 3. Main Pages

Use three main menu items at the bottom of the phone screen:

| Page | Main use |
| --- | --- |
| Home | Start a scan, add a task, or open a recent class |
| Scan | Record work with the camera |
| Classes | Open class tables, tasks, student lists, and QR files |

Use the same page names on a computer. Put the Google account and sign-out action under the teacher's photo.

Page map:

```text
Google sign-in
  Home
    Scan
    Add task
    Recent classes
  Scan
    Normal scan
    Past work
  Classes
    School year and term
    Class list
    Add class
    Class page
      Summary
        Work status form
      Tasks
        Add task
        Change task name
      Students
        Add or change student
        Excel review
        QR download
```

Do not show a new-user tour or a setup guide. When a list is empty, show a short message and the needed action.

## 4. Home

Page order:

1. Page name and teacher photo.
2. A large **Scan work** button.
3. An **Add task** button.
4. Recently opened classes.

If there are no classes, show **Add class**. Do not show a setup checklist.

## 5. Classes

One class means one school year, term, subject, and group under one teacher.

- Select the school year and term before showing the class list.
- Use Thai school years, such as 2569, and terms 1 and 2.
- Show the subject and group on each class card.
- Also show the school year and term clearly.
- Keep the chosen year, term, and class when moving between class tabs.
- Open old classes within the three-year data period by choosing their year and term. See Backend Service for the expiry rule.

For a new class:

1. Use the current school year and chosen term. Older-year filters are for opening existing classes only.
2. Choose a saved subject or enter a new subject name.
3. Enter the group name.
4. Check that the same subject and group do not already exist in that year and term.
5. Check the teacher's effective plan and shared yearly classroom usage, then save and open the class. See [model-plan.md](model-plan.md) for plan limits and code activation.

Do not allow changes to a class's year, term, subject, or group after it is made. Teachers can delete a class by typing its displayed name; access stops and usage is returned immediately, followed by retriable background cleanup as specified in [model-plan.md](model-plan.md). Do not add move-student actions.

Each class has three tabs: **Summary**, **Tasks**, and **Students**. Open **Summary** first.

## 6. Students

Show the student number, full name, and an action to change the student data.

- Allow a teacher to add one student with a number and full name.
- Do not allow blank names, blank numbers, or a number already used in that class.
- Allow name changes while keeping past work records.
- For a number change, check the new number before saving.
- Ask the teacher to confirm a number change. Say that the old QR will stop working.
- Keep past work records and the internal student ID. Make a new public student code and QR, and show **Download new QR**.
- Build the public student code from the year, term, subject, group, and number. Keep each teacher's data separate.

Allow the teacher to turn a student off after a check message:

- Keep the student's past work.
- Hide the student from the normal list and table.
- Add **Show students who are turned off** to view their past work.
- Allow the teacher to turn the same student on again.
- When turned on, the student's current QR works again.
- Old QR codes from earlier number changes must still not work.

## 7. Excel Review

Start from the chosen class. Show its year, term, subject, and group above the file action.

- Offer a sample Excel file with two columns: student number and full name.
- Read the file and show a review table before saving any student changes.
- Let the teacher change numbers and names in this table.
- Let the teacher remove a row from the list waiting to be saved.
- Removing a row here does not remove a saved student.

Show a count and a label for each kind of row:

| Row type | Meaning |
| --- | --- |
| New | The number is new to this class |
| Name change | The number exists and the name is different |
| No change | The number and name are the same |
| Needs a fix | A needed value is blank or a number is used twice in the file |

After each change, check the table again and update its labels and counts. Show the row, the field, and a short reason for each error.

Allow **Save students** only when all rows pass the checks. On save:

- Add new numbers.
- Update names for existing numbers.
- Keep all past work records.
- Keep saved students who are not in the file.

Show a clear result when the save is done. A changed number in the Excel review is matched as that number; use the student change form to change an existing student's number and keep their records linked.

## 8. Tasks

- Add a task to one class at a time.
- Fill in the next name, **Task i+1**, using the next number after the highest task order number in the class. Use Thai text in the app.
- Start with **Task 1** when there are no tasks.
- Let the teacher change the name before saving.
- Explain that normal scans for this class will now record work for this new task.
- After saving, show **Scan work**.
- The scan still reads the class from each QR. Opening it from a class does not limit it to that class.

Keep tasks in the order they were made. Do not allow drag-to-sort. The latest task means the task made most recently in that class.

Allow task name changes. Allow task delete only when no current sent work records remain. A task can be deleted after all its work statuses have been changed to Not sent. Keep its past changes in the audit history until the school year's data expires.

There are no due dates. The teacher must add a task before scanning work for it. A scan never adds a task.

## 9. Work Status

| Status | Use |
| --- | --- |
| Not sent | No work is recorded |
| On time | The teacher chooses on time |
| Late 1 | 2–3 days, as judged by the teacher |
| Late 2 | 3–7 days, as judged by the teacher |
| Late 3 | 7–14 days, as judged by the teacher |
| Late 4 | More than 14 days, as judged by the teacher |

The teacher chooses the late level. The app does not count late days or choose a level where the day ranges overlap.

For scans, offer **On time** and **Late 1–4**. Show the chosen status clearly at all times. Show the day range when a late level is chosen.

- Start with **On time** when the teacher opens the scan page.
- Keep the chosen status between scans.
- Keep it when changing scan modes.
- Keep it when switching to another app and back to the same scan page.
- Reset it to **On time** after leaving for another page and opening Scan again.
- Check the camera and internet before scanning again after returning from another app.

## 10. Scan Page

Page order:

1. Mode choice: **Normal** or **Past work**.
2. Work status choice, with the current choice easy to see.
3. Camera view.
4. Latest scan result.

Do not require a year, term, subject, or group choice before a normal scan. Read them from the QR.

Normal flow:

1. Read the QR.
2. Check the teacher, student, and class.
3. Find the latest task in that class.
4. Check that the student has not sent that task already.
5. Save the chosen status and today's date in Thai time.
6. Show only the saved status and play the success sound.

Do not show the student's name, number, class, or task in the success result. Keep the latest result below the camera until a new result replaces it.

Do not ask the teacher to close a success result. Read the same QR only once while it stays in view. Wait for it to leave the camera view before reading it again.

Always use the latest task, even if a student has not sent older tasks. Never replace an existing work record through a scan.

## 11. Past Work

Flow:

1. Choose **Past work** and the work status.
2. Scan the student's QR without saving work yet.
3. Open a panel with the student and the class's tasks.
4. List tasks from newest to oldest.
5. Show the old status for tasks already sent and do not allow them to be chosen.
6. Let the teacher choose one task that has not been sent.
7. Show the status to be saved and a confirm button.
8. Save only after the teacher confirms.
9. Close the panel and clear the task choice for the next student.

Keep the chosen work status, but never keep the chosen task for the next student. Use the date of the save in Thai time, even for past work.

Check again before saving. If the task already has a work record, show an error and do not replace it. The teacher can change its status in Summary.

## 12. Scan Errors and Waiting

Use clear words and a sound different from the success sound. For a QR error, keep the latest reason visible and allow the next QR without a close button.

| Case | What to show or do |
| --- | --- |
| Task already sent | Say it was not saved. Show the old date and status |
| No task in the class | Say it was not saved. Offer Add task for the class read from the QR |
| Student turned off | Say it was not saved because the student is turned off |
| Old QR after a number change | Say the QR no longer works |
| Unknown QR | Say the QR was not found or cannot be used |
| Another teacher's QR | Say it cannot be used with this account |
| Camera access blocked or camera not ready | Stop scanning and show how to allow or open the camera |
| No internet before a scan | Stop scanning and ask the teacher to connect again |
| Waiting for a save result | Pause new scans and show that the app is checking the save |

If the internet stops during a save:

- Do not show success or failure before the result is known.
- Show **Checking the save result** and stop new scans.
- When the connection returns, check the first save before trying again.
- A retry must not add the same work twice.
- Show success and play its sound only after the save is confirmed.
- If the result is still unknown, show **The save result is not yet known**.

## 13. Summary Table

Keep the agreed table direction:

- Student columns run across the top.
- Task rows run down the page, from oldest to newest.
- Keep the student headers and task-name column in place while scrolling.
- Allow up-and-down and side-to-side scrolling.
- Show each student's number and short name in the header.
- Show the full name in the panel opened from a cell.

Each cell shows a short Thai date, such as **10/10/69**, and **On time** or **Late 1–4**. Use Thai words in the app. For work not sent, show **—**.

Use status words as well as color. A student is complete when every task has been sent, including late work.

If there are no students, offer student entry or Excel import. If there are no tasks, offer **Add task**. Do not show an empty grid with no reason.

## 14. Change Work Status

Tap a table cell to open a panel with:

- Student number and full name.
- Task name.
- Saved date, if there is one.
- Current status and the new status choices.
- A **Save** button.

Only the status can be changed here. Do not allow direct changes to the student, task, or saved date.

| Change | Date rule |
| --- | --- |
| One sent status to another sent status | Keep the old date |
| Sent to Not sent | Ask for confirmation, then clear the date |
| Not sent to a sent status | Use the date of this change in Thai time |

Before saving, make the date rule clear. Ask for an extra confirmation only when changing to **Not sent**.

## 15. QR Files

Put **Download QR** in the Students tab. Offer a whole-class PDF and a single-student QR download.

Use Sarabun for QR-card PDF text. Keep its font files in `web/src/assets/fonts/` and embed the font in each PDF so Thai text displays and prints correctly.

- Each student has a QR for their year, term, subject, and group.
- A student in more than one subject has a different QR for each subject.
- Use the same QR for all tasks in that class and term unless the number changes.
- For the whole-class file, include only students who are turned on.
- Sort by student number.
- Use A4 paper, with the short side at the top.
- Put **4 columns × 5 rows**, or **20 QR cards per page**.
- Add cut lines.
- Put the student's name, number, subject, group, year, and term on each card.
- Keep clear white space around each QR.

Check a real printed page. All text must be readable, and a phone must scan each code well. Keep the agreed 4 × 5 layout when adjusting spacing and text size.

## 16. Page States

Design these states for each page that needs them:

- Loading: say what is being loaded.
- Empty: say why there is no data and show the next useful action.
- Editing: show which fields can change.
- Saving: show that the save is in progress and block repeat taps.
- Saved: show a clear result.
- Error: give a short reason and a useful next action.

Keep entered data after a failed save when possible. Do not show a save as done until it is confirmed. Keep short messages close to the field or action they describe.

## 17. Build Order

1. Set the colors, text styles, buttons, forms, panels, and main menu.
2. Build Google sign-in, Home, year and term choice, and class pages.
3. Build student entry, student changes, and the editable Excel review.
4. Build task entry and the next task name.
5. Build class and single-student QR downloads.
6. Build normal scanning, status choice, sounds, and repeat-read checks.
7. Build past-work scanning and task choice.
8. Build Summary and work-status changes.
9. Add all empty, waiting, and error states. Check phone and computer layouts.
10. Run the checks below and fix any failed flow.

## 18. Checks Before Release

- A new teacher can sign in with Google without approval or a new-user tour.
- A teacher cannot see, change, or scan another teacher's data.
- Year and term choices lead to the right classes and stay in place between tabs.
- A class cannot be made twice with the same year, term, subject, and group.
- Excel rows can be changed or removed before saving. Errors block the save.
- Importing again updates names and adds new students without losing old work.
- Changing a student's number keeps past work, stops the old QR, and offers a new QR.
- Turning a student off hides them from normal views and blocks their QR.
- Turning them on again restores the current QR, but not old replaced QR codes.
- Task names start with the next task number. A task with current sent work records cannot be deleted. A task with only Not sent statuses can be deleted.
- Normal scans always use the latest task in the QR's class, even when older work is missing.
- Normal success shows only the saved status and plays a sound.
- A QR held in view causes only one read. Removing it allows another read.
- Scanning a task already sent does not replace it and shows the old date and status.
- Past work needs a new task choice and confirmation for each student.
- The scan status stays or resets exactly as described in this plan.
- Camera and internet errors give a clear next step.
- A lost save reply does not cause false success or two work records.
- Summary works with 50 student columns and 30 task rows on a phone.
- Table headers stay in view, and cell details show full names.
- Status changes keep, clear, or set dates as required, using Thai time.
- A whole-class PDF prints 20 cards per A4 page, with clear text and working QR codes.
- Web pages, buttons, forms, and tables use the locally served Noto Sans Thai font, with normal text starting at 16px. User-facing web text is Thai.
- QR PDFs embed Sarabun. Thai names, vowels, and tone marks display and print correctly, including on a device without Sarabun installed.
- The web app uses no purple-to-blue gradients or decorative glow. Shadows stay small and subtle.
- All main flows work on iPhone Safari and Chrome, Android Chrome, and a computer.
- Text, status colors, tap areas, and sounds work well on real phones.

# Backend Service

## 1. Goal and Test Size

Use Firebase for the first version. Keep server care and running costs low while protecting each teacher's data.

Follow [README.md](README.md#tech-stack) for technology choices and its [folder structure and file placement rules](README.md#folder-structure) when building backend actions, shared schemas, jobs, and tests. This plan defines their behavior and release checks.

| Item | Test target |
| --- | --- |
| Teachers | 100 |
| Teachers scanning at the same time | 20 |
| Classes per teacher per school year | 5 |
| Normal class | 30 students and 20 tasks |
| Large class | 50 students and 100 tasks |
| Excel import | Up to 200 rows in one save |

These class sizes are test targets, not hard limits. The 200-row import limit is a hard limit for the first version.

At the normal size, if all work is sent, there are about 300,000 work records per school year and 900,000 across three school years. Audit history and saved request results need extra space.

## 2. Firebase Services

| Service | Use |
| --- | --- |
| Firebase Hosting | Serve the static web app |
| Firebase Authentication | Google sign-in |
| Firebase App Check | Help block requests from untrusted app clients |
| Cloud Firestore, Standard edition | Store app data |
| Cloud Functions, second generation | Check and save changes, check save results, and run data expiry jobs |

- Write the backend in TypeScript.
- Put Firestore and Functions in Singapore, `asia-southeast1`.
- Use the Blaze pay-as-you-go plan and a linked billing account.
- Use a separate Firebase project for testing and for production.
- Use Firebase Emulator Suite for most local development and tests.
- Read Excel files and build QR images and PDFs in the browser. Send only the reviewed student data to the backend.
- Do not store Excel files, PDFs, or student work files. Cloud Storage is not needed for these files in the first version.

## 3. Sign-in and Access

- Use the Firebase Authentication user ID as the teacher's owner ID.
- A teacher can start after Google sign-in without approval.
- Students do not have accounts.
- Store all class data under its teacher's ownership.
- Allow browser reads only for the signed-in teacher's data. Enforce this with Firestore Security Rules.
- Send all browser requests that change app data through Functions. Block direct browser writes to Firestore.
- Check the sign-in token, owner, class, and related records in each backend action. Do not trust an owner ID sent by the browser.
- Backend database access must check ownership even though server access does not use browser Security Rules.
- A QR is a student lookup code, not permission to read or change data.
- Keep browser data and pending requests separate by account. Do not show or replay one teacher's requests under another account.

## 4. Stored Data

Keep these records separate. Do not store a whole class table in one large document.

| Record | Main data |
| --- | --- |
| Teacher | Owner ID and basic account data |
| Subject | Owner and saved subject name |
| Class | Owner, school year, term, subject, group, latest task, and data version |
| Student | Class, stable internal ID, number, full name, active state, public code, and data version |
| QR | Token, owner, class, student, and current or replaced state |
| Task | Class, task ID, name, order number, creation time, and data version |
| Work | Class, student ID, task ID, status, saved time, and data version |
| Request result | Owner, request ID, original action, and its confirmed result |
| Audit entry | Owner, class, action, affected IDs, old and new values, and server time |

- Allow at most one current work record for each student and task in a class.
- A missing work record means Not sent. Changing to Not sent clears the current sent record and date, while keeping audit history.
- Use internal IDs to link records. Names and student numbers must not be the links that keep work history together.
- Keep request results and audit entries with their related school-year data so expiry can remove them too.
- Add indexes for class lists by year and term, students by number, and tasks by order.

## 5. Input and Duplicate Checks

- Check all fields again on the backend, even if the browser already checked them.
- Student numbers must be positive whole numbers. Treat `01` and `1` as the same number.
- A number must be unique in its class, including students who are turned off.
- Trim spaces at the start and end of subject names, group names, and student names before checking and saving them.
- Reject blank required values and invalid work statuses.
- A class must be unique by teacher, school year, term, subject, and group.
- Check duplicates and save in one transaction so two requests cannot create the same class or student number.
- Keep a class's year, term, subject, and group fixed after creation.

## 6. Student IDs and QR Changes

- Give each student record an internal ID that stays the same when the number or name changes.
- Build its public code from the school year, term, subject, group, and number, within the teacher's data.
- Use that code with a random token in the QR. Do not put the student's name in the QR payload.
- Resolve the QR on the backend and check the teacher, class, token, and student state before saving work.
- When the number changes, check the new number, update the public code, replace the token, and keep the internal ID and work history.
- Keep replaced tokens marked as invalid so an old QR can be reported clearly. Never give a replaced token to another student.
- Turning a student off blocks the current QR but keeps the number and history.
- Turning the student on restores only the current QR. Replaced QR codes stay invalid.
- A name change does not require a new QR.

## 7. Tasks and Work Saves

Use a transaction: either all related changes are saved together, or none are saved.

For a normal scan:

1. Check the teacher, QR, class, and active student.
2. Read the class's latest task inside the transaction.
3. Check that no current sent record exists for this student and task.
4. Save the chosen status, server time, request result, and audit entry together.

The latest task is decided when the backend transaction saves. If a new task was created before that point, the scan uses the new task. A retry of a confirmed request returns the first result and never picks another task.

For past work, scanning only loads the student and tasks. Save after confirmation, and check the chosen task and absence of sent work again in the transaction.

- A scan cannot overwrite sent work or create a task.
- Create task order numbers safely when two requests arrive together.
- Use the next number after the highest current task order number for the suggested task name.
- Keep the latest task reference correct when a task is created or deleted.
- Delete a task only when no current sent work remains, and check this together with the delete.
- Keep audit history after clearing work or deleting a task.

## 8. Dates and Status Changes

- Use backend time for every saved work date. Do not use the phone clock.
- Store timestamps as UTC and show dates in `Asia/Bangkok` with the Thai school-year and date format needed by the UI.
- The teacher chooses On time or Late 1–4. The backend does not calculate late days.
- Changing one sent status to another keeps the original saved time.
- Changing to Not sent requires confirmation and clears the sent status and saved date.
- Changing Not sent to a sent status uses the time of that change.
- Past-work saves use the save time, not the task's creation date.

## 9. Lost Replies and Retries

- Make a unique request ID before sending a save. Keep it with the original action and data.
- Keep an unresolved request on the teacher's device so it survives a page reload or browser restart.
- Save the request result together with the data change. A repeated request ID returns the same result without repeating the change.
- Reject reuse of the same request ID with different data.
- Stop new scans while a scan save result is unknown.
- After the connection returns or the page reloads, check the original request result before retrying.
- If a retry is needed, send the original request ID and data.
- Show success and play its sound only after the backend confirms the save.
- If the result cannot yet be checked, keep the unknown-result message and the pending request.
- An expired school year's request cannot create data again after expiry.

## 10. Changes from Two Devices

- Use data versions for editable records and a class roster version for student imports.
- Forms send the version they loaded. Check that version in the save transaction.
- If another device changed the data, reject the old edit, fetch the latest data, and ask the teacher to review it.
- Keep entered values where possible after a rejected save.
- Do not quietly overwrite newer data.
- Use the same rule for student changes, task name changes, work-status changes, and Excel imports.

## 11. Excel Import

- Accept at most 200 reviewed rows per save.
- Read and edit the file in the browser. Send numbers, names, and the roster version to the backend.
- Check blanks, valid numbers, duplicate numbers, ownership, and current roster data again.
- Match by student number. Add new numbers and update existing names.
- Keep students absent from the file, all work history, and existing students' active states.
- An import does not change an existing student's number or turn a student on.
- Save the whole import, its request result, and audit history together. No partial import is allowed.
- If the roster changed after review, reject the save and fetch a new review before trying again.
- Return clear counts of added, changed, and unchanged students.

## 12. Fetching Fresh Data

Fetch fresh data when:

1. A page opens.
2. The teacher returns to the page.
3. The teacher returns from another app.
4. A save succeeds.
5. The teacher presses refresh.

- Fetch only the class or list needed by the current page.
- Merge overlapping refresh requests so one event does not cause several identical reads.
- Replace the displayed data with the fresh result. Keep loading and error states clear.
- Summary does not update automatically while left open on another device. Use the refresh events above.
- Do not load three years of tables on every page visit or keep listeners open for every class.

## 13. School-Year Data Expiry

- Keep only the current school year and the two previous school years.
- The app changes its current school year on May 1 in Thai time. This is the app's agreed rule.
- For example, on May 1, 2570, keep years 2568–2570 and expire year 2567.
- Show an in-app notice 30 days before a school year's data expires.
- Do not use the year selected by a teacher to decide the current year or expiry.
- Allow class creation only in the current school year. Data changes to existing active classes remain available within the retained three-year period.
- At expiry, block access and writes for that year and remove its classes, students, tasks, work, QR records, request results, and audit history.
- Run cleanup as a backend job that can safely resume after failure. Removing a class document alone must not leave its child records behind.
- Automatic expiry and manual class deletion share the same cleanup process and must never return the same place twice. All plans, including Level 3, retain the same three-school-year data policy.
- Teacher account data and reusable subject names are separate from expired class data.

## 14. Audit, Backup, and Restore

- Record important changes, including work saves and clears, student number changes, student on/off changes, imports, and task deletion.
- Store who made the change, when it happened, the affected IDs, and old and new values.
- Do not store QR tokens in audit history or student data in general application logs.
- The first version has no teacher-facing audit page.
- Delete audit history with its related school year.
- Use daily Firestore backups and keep each backup for 30 days.
- A restore may lose changes made after the latest backup, about one day of data.
- Aim to restore service within one day. Test this before release; it is a recovery target, not a guaranteed service level.
- Deleted data may remain in older backups until those backups expire.
- Remove expired school-year data from a restored database before reopening access. Restoring a backup must not bring expired data back into use.
- Include the database configuration, indexes, Security Rules, and backend code in the recovery procedure.

## 15. Cost Controls

- Keep the agreed budget target at 1,000 baht per month.
- Use 300–500 baht per month as an initial planning allowance, not a confirmed quote. Measure actual reads, writes, stored data, backup size, and function use before release.
- Set budget alerts at 50%, 80%, and 100%. Alerts do not cap charges or stop service automatically.
- Start with `minInstances: 0` so idle Functions can scale to zero. The first request after idle time may be slower.
- Set a maximum instance count and request-rate limits based on load tests. They must still support the agreed 20 teachers scanning at once.
- Keep Functions and Firestore in the same region.
- Fetch only needed data and avoid duplicate refetches.
- Keep backup, audit, log, and build-artifact storage under review.
- Use Emulators for most tests. Keep the separate test project small and avoid idle reserved instances there.
- Budget estimates exclude domain fees and taxes. Blaze charges, including paid backup storage, depend on actual use.
- The operator checks usage and the cause when an alert arrives. Do not stop the app automatically at the budget target.

Pricing and setup references:

- [Firebase pricing](https://firebase.google.com/pricing)
- [Firestore pricing, including backups](https://cloud.google.com/firestore/pricing)
- [Function instance settings](https://firebase.google.com/docs/functions/manage-functions)
- [Firestore backups](https://firebase.google.com/docs/firestore/backups)
- [Firebase billing controls](https://firebase.google.com/docs/projects/billing/avoid-surprise-bills)

## 16. Build Order and Release Checks

Build in this order:

1. Set up projects, Hosting, Google sign-in, App Check, Emulators, access rules, and indexes.
2. Build class, subject, student, and QR actions with ownership and duplicate checks.
3. Build task actions and work saves with transactions, request results, and audit history.
4. Build whole-import saves, data-version checks, and fresh-data fetching.
5. Add school-year notices, expiry jobs, backups, cost alerts, and recovery steps.
6. Run the checks below and fix failures before release.

Release checks:

- One teacher cannot read, edit, import, or scan another teacher's data, including through direct API calls.
- Two simultaneous requests cannot create a duplicate class, student number, or sent work record.
- Changing a number keeps work linked to the same internal student ID and blocks all replaced QR codes.
- Normal scanning and concurrent task creation select the latest task consistently.
- A lost reply, repeated request, and page reload do not repeat a save or switch its task.
- Old pending requests cannot restore cleared work by replaying an already completed action.
- Stale edits and stale import reviews cannot overwrite newer data.
- An invalid row or failed import leaves every student unchanged.
- Clearing sent work removes its date. Deleting a task is allowed only when no sent work remains.
- Refetch runs at all five agreed events and loads the latest data without repeated identical calls.
- Thai dates stay correct across midnight and when the device clock is wrong.
- Expiry uses May 1 in Thai time, blocks expired-year writes, and removes all related child records.
- A restored backup is checked for expired data before access is reopened.
- A real backup can be restored within the recovery target.
- Load tests cover 100 teachers, 20 concurrent scanners, normal classes, large classes, and a 200-row import.
- Cost measurements include Summary refetches, audit entries, request results, backup storage, and both Firebase projects.
- Complete the security checks in the next section before release.

## 17. Standard Security

Use the [OWASP ASVS](https://owasp.org/projects/asvs) as the security review guide, including the Level 2 checks that apply to this app. This section sets the first version's requirements; it is not a claim of full ASVS compliance.

### 17.1. Authentication and Sessions

- Use the Firebase SDK and Google sign-in flow. Do not build a password system or store Google passwords.
- Verify Firebase ID tokens with the Admin SDK. Check the correct project, expiry, and account state before protected backend actions.
- Reject revoked sessions and disabled accounts for backend changes and result lookups. Revoke sessions when an account is compromised.
- Restrict Authentication's authorized domains to the app's real domains. Keep development domains in the test project.
- Let the SDK manage tokens. Never put tokens in URLs, application logs, or custom browser storage.
- On sign-out, clear displayed student data and stop listeners and in-flight account actions. A response for the old account must not update the new account's screen.

Reference: [Firebase session management](https://firebase.google.com/docs/auth/admin/manage-sessions).

### 17.2. Authorization and Database Rules

- Deny access by default. Allow only the specific reads needed by the signed-in owner.
- Check ownership for every supplied class, student, task, request-result, and QR reference. Knowing an ID must not grant access.
- Reject a student or task from another class, even when both classes belong to the same teacher.
- Deny direct browser writes, audit changes, and reads of backend-only records. Return QR and request data only through the checked actions that need them.
- Check the three-year access window in both browser read rules and backend actions, even if cleanup has not finished.
- Keep audit entries immutable during their retained period. Only trusted expiry jobs may remove them.
- Treat Security Rules and backend ownership checks as separate controls and test both.

### 17.3. App Check and Abuse Limits

- Use App Check for Firestore and callable Functions. For the web app, use the supported reCAPTCHA Enterprise provider.
- Observe App Check metrics in testing, then enforce valid tokens before production release. Debug tokens belong only in the test environment.
- Authentication and owner checks are still required. App Check does not replace them or request-ID checks.
- Limit request rates per teacher and action. Set stricter limits for imports and bulk actions than for scans.
- Set request-size, execution-time, and query-result limits. Validate limits before starting expensive database work.
- Return a clear retry delay for throttled actions. Preserve pending request IDs and avoid rapid retry loops.
- Test limits against 20 concurrent scanners and include App Check usage in cost monitoring.

Reference: [App Check for Functions](https://firebase.google.com/docs/app-check/cloud-functions).

### 17.4. Input and File Safety

- Define an allowed schema for each action: field names, types, length limits, number ranges, and status values. Reject extra fields that could change ownership, saved dates, or internal state.
- Validate names as text and allow Thai characters. Do not accept HTML as a name.
- Render names and error values as plain text. Never insert them as raw HTML or run them as code.
- Use structured database calls. Do not turn user text into database paths or executable queries without validation.
- Limit Excel file size before parsing and row count before saving. Accept only the supported workbook format.
- Do not run spreadsheet macros, formulas, embedded scripts, or external links. Reject formula cells in required number and name fields.
- Treat QR content as data. Check its format and length; never open arbitrary links or execute QR text.

### 17.5. Browser and Network Safety

- Serve the app and APIs over HTTPS. Set HSTS, `X-Content-Type-Options: nosniff`, and a restrictive Referrer Policy.
- Set a Content Security Policy that permits only the scripts and connections needed for Firebase, Google sign-in, and App Check. Block framing with `frame-ancestors`.
- Allow camera access only for the app's own origin through Permissions Policy.
- Restrict browser API origins to approved app domains. CORS is a browser control; every API must still verify authentication and ownership.
- Use authenticated callable POST actions for changes. Do not use GET requests to change data or add custom cookie sessions without a CSRF design.
- Do not cache API responses containing student data in a service worker or shared HTTP cache. Keep Firestore persistent data caching off in the first version.
- Store only the minimum unresolved-request data needed for recovery, separated by teacher. Keep it hidden until that teacher signs in, and remove it after resolution or expiry.
- Test headers on real phones; they must not break Google sign-in, App Check, camera use, or PDF downloads.

### 17.6. Secrets and Operator Access

- Keep service-account keys, private keys, and third-party secrets out of the repository, browser bundle, and logs.
- Use the Functions runtime identity for Google services and Secret Manager for any external secrets. Avoid downloaded service-account keys.
- Give runtime and deployment accounts only the permissions their jobs need. Avoid Owner or Editor roles for routine work.
- Restrict backup and production-data access to named operators. Require MFA for operator Google accounts.
- Use short-lived credentials for CI deployment. Keep test and production credentials separate.
- Firebase web configuration and its API key are public identifiers. Restrict the key to required APIs; do not use it as authorization.

Reference: [Firebase security checklist](https://firebase.google.com/support/guides/security-checklist).

### 17.7. Data, Errors, and Monitoring

- Use the provider's encryption in transit and at rest for Firestore and backups.
- Collect only data needed for the agreed teacher workflows. Use fake student data in tests.
- Return stable error codes and short Thai messages. Do not expose stack traces, database paths, or another teacher's student details.
- Keep sensitive request bodies, names, QR tokens, and auth tokens out of general logs. Store necessary old and new values only in the protected audit history.
- Log action type, result, duration, and a correlation ID for diagnosis. Restrict log access and set an explicit retention period before release.
- Alert on unusual denied access, failed App Check, request spikes, backend errors, and failed expiry or backup jobs. Group alerts to avoid a flood.

### 17.8. Dependencies and Incident Response

- Keep a lockfile and use supported runtimes and SDK versions.
- Run dependency and secret scans in CI. Fix exploitable high or critical issues before release, or document a reviewed mitigation.
- Deploy only after ownership, Security Rules, and backend security tests pass. Keep a tested rollback procedure.
- Assign an operator for security alerts. Keep steps to disable a compromised account, revoke sessions, rotate exposed secrets, and block an abused endpoint.
- Preserve the required recovery and audit evidence without copying student data into general logs. Record the incident and verify the fix before reopening a blocked action.

### 17.9. Security Release Checks

- Missing, forged, expired, revoked, and wrong-project tokens are rejected by protected backend actions.
- A teacher cannot access another teacher's records by changing IDs, query filters, QR values, or request IDs.
- Direct browser writes and access to audit or backend-only records are denied.
- Expired school-year data is unreadable before, during, and after cleanup, including after restore.
- Missing or invalid App Check tokens are rejected in production; supported phone browsers still work.
- Extra fields, oversized imports, formula cells, invalid QR text, and HTML-like names cannot bypass checks or execute code.
- Sign-out and account switching do not expose old data or replay another account's pending actions.
- Repeated or throttled requests do not duplicate saves or bypass owner checks.
- Production responses and logs contain no secrets, tokens, stack traces, or unintended student data.
- Browser headers, operator permissions, CI credentials, dependency scans, and the incident procedure are reviewed before launch.
