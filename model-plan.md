# Teacher Plan and Classroom Limit

## Goal

Limit new classrooms by the teacher's plan. Teachers contact an admin to get a code. The admin uses a terminal script. There is no admin page on the website.

This document is a development plan. It uses simple English. New technical choices below are proposed implementation details.

## Shared Rules

| Plan | Classroom limit | Plan life |
| --- | --- | --- |
| Starter | 2 | No end date |
| Level 1 | 6 | 13 calendar months |
| Level 2 | 15 | 13 calendar months |
| Level 3 | Unlimited | 13 calendar months |

- Every teacher starts with Starter. There are no old users to migrate.
- A plan belongs to one teacher account.
- Count classrooms in the current school year only. Count all terms and subjects together.
- One classroom is one school year, term, subject, and group.
- Use the existing school year rule: the year changes on May 1 at 00:00 in Asia/Bangkok. Use the Buddhist year number.
- Teachers can create classrooms in the current school year only.
- A new school year has its own count. Old classrooms do not use the new year's limit.
- When a paid plan ends, the teacher uses Starter again. Existing classrooms still work.
- A teacher can create a classroom only when the current count is below the limit.
- All plans keep the existing three-school-year data policy. Level 3 does not extend data storage time.
- Deleting a current-year classroom gives back one place. Deleting an old classroom does not change the current-year count.

## 1. UX/UI

### 1.1 Plan Summary

Show these items on the classroom page or a plan page:

- Current plan name.
- Paid plan end date, in Thailand time.
- Current school year.
- Used classrooms and limit, such as `4 / 6`.
- For Level 3, show the used count and `Unlimited`.
- An `Enter code` button.
- A `Contact admin` button.

The count must include both terms, even when the teacher views only one term. Show the plan end date and the data storage policy as separate items.

When a plan ends, show Starter and the current count. If the teacher has 8 classrooms, show `8 / 2`. Keep the existing classrooms available. Explain why a new classroom cannot be created.

### 1.2 Contact Admin

The button opens a small panel with this information:

- LINE ID: `smalldoc124`
- Phone: `088-3564267`
- Message: Contact the admin to change your plan. Give the admin the email used to sign in.

Allow the teacher to copy the LINE ID and phone number. The phone number can also open a phone call. The admin sends the code to the teacher outside the website.

### 1.3 Enter a Code

1. The teacher opens the code page and enters a code.
2. The server checks the code and shows the target plan and the new end date.
3. The teacher confirms the change.
4. The server checks the code again and applies the plan.
5. The page shows success and refreshes the plan summary.

For an upgrade, explain that the new plan starts now and the old remaining time is not added.

Show clear messages for an invalid code, an expired code, a cancelled code, a used code, a code for another account, and a blocked downgrade. Do not show another teacher's personal information.

Disable repeat clicks while a request is running. A network retry must not add the plan time twice.

### 1.4 Create a Classroom

- Offer the current school year only.
- Show the term, subject, and group before the teacher confirms.
- Show the current count and plan limit.
- When the limit is full, explain the limit and show `Enter code` and `Contact admin`.
- Refresh the count after a successful create or delete.

The server makes the final decision. A disabled button alone is not enough.

### 1.5 Delete a Classroom

1. Show the classroom details.
2. Warn that the classroom, student records in this classroom, work, scores, and related data will be deleted. The teacher cannot restore them.
3. Ask the teacher to type the displayed classroom name.
4. After the server accepts the delete, remove the classroom from normal use and update the count.

Explain that deleting an old-year classroom does not give more places in the current year. If the teacher is on Starter with 8 classrooms, they must reduce the count to fewer than 2 before creating another one.

## 2. Backend Service

### 2.1 Plan Service

Use the existing Firebase callable functions, authentication, and request validation.

- Keep plan limits in one shared definition.
- Use server time for all dates and checks.
- Read the saved plan to find the effective plan. If its end date has passed, the effective plan is Starter.
- Check the effective plan during every create request. Do not depend on a daily job to end a plan.
- Add 13 calendar months, not a fixed number of days. Proposed date rule: use Thailand time and use the last valid day if the target month is shorter.
- Treat a plan or code as expired when server time is equal to or later than its end date.

### 2.2 Code Rules

- A code is for one teacher UID and one paid level.
- The teacher must already have signed in before the admin can issue a code.
- A code can be used once and expires 30 days after creation.
- The admin can cancel a code only before it is used.
- Generate random 5-character codes using uppercase English letters and digits, with at least one of each. Accept lowercase input by normalizing to uppercase. Retry collisions without replacing existing codes. Save a hash, not the full code.
- Show the full code once in the terminal. Do not write it to logs or history records.
- If the admin loses a code, cancel it and create another one.
- Limit code-check and code-use requests to reduce guessing.

| Teacher state | Code level | Result |
| --- | --- | --- |
| Starter or paid plan expired | Any paid level | Start that level now for 13 months |
| Paid plan active | Same level | Add 13 months to the current end date |
| Paid plan active | Higher level | Change now; end 13 months from now; do not add old time |
| Paid plan active | Lower level | Reject; keep the code unused |

Code preview does not reserve or use a code. When the teacher confirms, check all rules again. If the preview is no longer correct, show the new result and ask for confirmation again.

Use one Firestore transaction to check the code, update the plan, mark the code as used, and save the event. Concurrent requests must not use the same code twice. A retry of a completed request returns its saved result.

### 2.3 Classroom Count

Keep one count document per teacher and school year.

In one transaction:

1. Check the teacher, current school year, and effective plan.
2. Check whether this classroom already exists.
3. Read the year's count and compare it with the limit.
4. Create the classroom and add one to the count.

A duplicate request or an existing classroom must not add to the count. All create requests must use the same count document so that two requests cannot pass the last free place together.

### 2.4 Delete and Cleanup

In one transaction:

1. Check ownership and the teacher's confirmation.
2. Mark the classroom as deleting.
3. Subtract one from that classroom year's count, once only.
4. Create a cleanup job.

After this transaction, block all normal access to the classroom, including student links and QR access. The place is now free. A background worker deletes all data linked to this classroom and retries failures until cleanup is complete. It must not delete records belonging to other classrooms.

The current classroom ID is based on the year, term, subject, and group. Proposed rule: block creation of the same classroom identity while its cleanup is running. Show a short message asking the teacher to try again later. This stops an old cleanup job from deleting a new classroom with the same ID.

The existing school-year cleanup must work with this process. It must not return the same place twice or change the current-year count for an old classroom.

### 2.5 Admin Terminal Script

Use trusted Firebase admin credentials. Keep credentials outside the repository. No web admin role or admin page is needed for this scope.

Proposed commands:

| Command | Input | Output |
| --- | --- | --- |
| Find teacher | Email | UID, email, current plan, end date, classroom count |
| Create code | Teacher email, level | Code ID, full code once, target teacher, level, expiry |
| List codes | Teacher email | Code IDs, levels, dates, and statuses; no full codes |
| Cancel code | Code ID | Updated status |
| View history | Teacher email | Code and plan events |

Show the Firebase project and teacher details before a write. Require confirmation for code creation and cancellation. Record who ran the action using the trusted admin identity.

### 2.6 Permissions and Reliability

- Teachers can read only their own plan and counts.
- Browser clients cannot write plans, codes, counts, events, or cleanup jobs directly.
- Code documents are available only to trusted server code and admin scripts.
- Keep plan and code request results separate from school-year request expiry.
- Keep an audit record for code creation, cancellation, and use, and for plan changes.
- Use the existing error and rate-limit patterns where they fit.
- Add shared schemas for inputs and responses.

## 3. Data Structure

These are proposed Firestore paths and fields. Use Firestore timestamps for stored dates. A missing plan document means Starter. A missing yearly count means zero only for a new year with no classrooms.

### 3.1 Plan Definitions

Store these values in shared code:

| Key | Rank | Classroom limit |
| --- | --- | --- |
| `starter` | 0 | 2 |
| `level1` | 1 | 6 |
| `level2` | 2 | 15 |
| `level3` | 3 | `null` means unlimited |

### 3.2 Teacher Plan

Path: `teachers/{uid}/subscription/current`

| Field | Type | Meaning |
| --- | --- | --- |
| `planId` | string | Saved paid plan level |
| `startedAt` | timestamp | Start of this plan period |
| `expiresAt` | timestamp | End of paid access |
| `lastCodeId` | string | Last code used |
| `version` | number | Version for change checks |
| `updatedAt` | timestamp | Last change |

Keep this separate from the teacher profile. The current profile update replaces the teacher document, so plan fields on that document could be lost.

For a same-level renewal, keep `startedAt` and extend `expiresAt`. For an upgrade or a new plan after expiry, set a new `startedAt`. Do not delete this document when the plan ends; calculate Starter from its expiry.

### 3.3 Yearly Classroom Count

Path: `teachers/{uid}/classroomUsage/{schoolYear}`

| Field | Type | Meaning |
| --- | --- | --- |
| `schoolYear` | number | Buddhist school year |
| `classroomCount` | number | Classrooms that have not been marked for deletion |
| `updatedAt` | timestamp | Last count change |

The count cannot be negative. Do not reset the old document on May 1. Use the new year's document.

### 3.4 Activation Code

Path: `planCodes/{codeHash}`

The document ID is the code hash and also acts as the code ID for admin actions.

| Field | Type | Meaning |
| --- | --- | --- |
| `teacherUid` | string | Only this teacher can use the code |
| `planId` | string | `level1`, `level2`, or `level3` |
| `status` | string | `unused`, `used`, or `cancelled` |
| `createdAt` | timestamp | Creation time |
| `expiresAt` | timestamp | Creation time plus 30 days |
| `createdBy` | string | Trusted admin identity |
| `usedAt` | timestamp or null | Successful use time |
| `usedBy` | string or null | Teacher UID |
| `cancelledAt` | timestamp or null | Cancellation time |
| `cancelledBy` | string or null | Trusted admin identity |
| `resultPlanExpiresAt` | timestamp or null | Plan end date from this code use |

An unused code is shown as expired when its expiry time has passed. It does not need a scheduled status update. Code expiry is a business date, not a Firestore auto-delete setting.

### 3.5 Plan Events and Request Results

Path: `teachers/{uid}/planEvents/{eventId}`

Fields: `type`, `actorId`, `codeId`, `oldPlanId`, `newPlanId`, `oldExpiresAt`, `newExpiresAt`, `requestId`, and `createdAt`. Fields that do not apply can be null. Event types include code creation, cancellation, redemption, renewal, and upgrade.

Path: `teachers/{uid}/planRequests/{requestId}`

Fields: `action`, `inputHash`, `result`, and `createdAt`. Save a successful redemption result in the same transaction as the plan change. Reject reuse of the same request ID with different input. Never save the full code here.

### 3.6 Classroom Deletion Fields

Existing path: `teachers/{uid}/classes/{classId}`

Add `status` (`active` or `deleting`), `deletionRequestedAt`, and `deletionRequestedBy`. For existing code paths, treat a missing status as active. Update every classroom access path to reject deleting classrooms.

Path: `classroomDeletionJobs/{jobId}`

Fields: `teacherUid`, `classId`, `schoolYear`, `status`, `attempts`, `createdAt`, `updatedAt`, `nextAttemptAt`, `completedAt`, and `lastError`. Job status is `pending`, `running`, or `complete`. Failed work returns to a retry state. The worker must safely handle repeated delivery.

### 3.7 Queries and Indexes

- List codes by `teacherUid`, ordered by `createdAt`.
- List teacher plan events by `createdAt`.
- Find pending cleanup jobs by `status` and `nextAttemptAt`.
- List active classrooms by year and term using the existing query patterns.
- Add Firestore indexes for the final query shapes during implementation.

## 4. Delivery Steps

1. Add shared plan definitions and request/response schemas.
2. Add plan, code, event, request-result, and usage records with access rules.
3. Build the plan service and code preview/redemption functions.
4. Add transactional limits to classroom creation. Remove past years from creation inputs.
5. Build classroom deletion, access blocking, and background cleanup.
6. Build and document the admin terminal commands.
7. Build the plan summary, contact panel, code page, and delete confirmation.
8. Run focused service, rules, and UI tests, then the project type checks and build.

## 5. Acceptance Checks

- Starter accepts 2 classrooms and rejects a third.
- Level 1 accepts 6 and Level 2 accepts 15. Level 3 has no classroom cap.
- Two concurrent requests for the last place create only one new classroom.
- Repeated create, delete, and redemption requests do not change counts or dates twice.
- Both terms use the same yearly count. Past-year creation is rejected.
- The May 1 boundary uses Thailand time and starts a new yearly count.
- A used, cancelled, expired, or wrong-account code cannot change a plan.
- Two concurrent uses of one code have only one successful effect.
- Renewal, upgrade, downgrade rejection, and post-expiry activation follow the table.
- Calendar-month addition works at month ends and in leap years.
- Expired paid plans use Starter without waiting for a background job.
- Deletion frees one place immediately, blocks all classroom access, and finishes cleanup after retries.
- Old-year deletion does not change current-year usage.
- A classroom cannot be recreated with the same identity until its old cleanup ends.
- Direct browser writes and cross-teacher access are rejected.
- Profile edits do not remove plan data.
- The admin script never stores or logs full codes after showing them once.
- The contact panel shows the agreed LINE ID and phone number.
