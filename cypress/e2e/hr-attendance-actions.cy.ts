/// <reference types="cypress" />

// Regression coverage for Staff Attendance's check-in / check-out / manual
// request / approve actions -- none of these had any e2e coverage before,
// and all three backend mutations were actually broken:
//
//  - recordCheckIn/recordCheckOut: RecordCheckInDto/RecordCheckOutDto read
//    dto.date()/dto.source(), but RecordCheckInInput/RecordCheckOutInput in
//    the GraphQL schema only expose employeeId + checkInTime/checkOutTime,
//    so date was always null -> LocalDate.parse(null) threw
//    NullPointerException("text") (java.time's own
//    Objects.requireNonNull(text, "text") inside LocalDate.parse). Also,
//    checkInTime/checkOutTime were parsed as bare LocalTime, but the
//    frontend sends a full ISO instant (new Date().toISOString()).
//  - requestManualAttendance: the Status <Select> sends lowercase values
//    ("present"/"late"), but the backend did a case-sensitive
//    EmployeeAttendanceStatus.valueOf(dto.status()), so every manual
//    request threw "No enum constant ...present".
//
// Check-in/check-out are tied to "today" (the frontend always sends
// new Date().toISOString()), so a same-day rerun of this spec legitimately
// hits the "Attendance already recorded for this date" business rule rather
// than a bug -- this test accepts that specific outcome as a pass, but fails
// on anything else (in particular the old NullPointerException/"text" bug).

// Spread across a wide range of past dates so repeated CI runs essentially
// never collide with a prior run's record for the same employee/day.
const randomPastDate = () => {
  const daysAgo = 1 + Math.floor(Math.random() * 3650);
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
};

describe("Staff attendance actions", () => {
  it("check-in: records today's check-in, or hits the real once-per-day rule (not a crash)", () => {
    cy.intercept("POST", "**/graphql", (req) => {
      if (req.body?.operationName === "RecordCheckIn") req.alias = "checkIn";
    });

    cy.loginByRole("hrManager");
    cy.visit("/hr/dashboard/attendance");
    cy.contains("label", "Employee").parents(".MuiAutocomplete-root").find("input").type("EMP-2026-0008");
    cy.get('[role="listbox"] [role="option"]').first().click();

    cy.contains("button", "Check-in").click();
    cy.wait("@checkIn").then(({ response }) => {
      const errors = response?.body?.errors;
      if (errors) {
        const message = JSON.stringify(errors);
        expect(message, `unexpected recordCheckIn error: ${message}`).to.match(
          /already recorded for this date/i,
        );
      } else {
        const record = response?.body?.data?.recordCheckIn;
        expect(record?.id, "recorded attendance id").to.be.a("string").and.not.be.empty;
        expect(record?.attendanceDate, "attendance date").to.be.a("string").and.not.be.empty;
        expect(record?.checkInTime, "check-in time").to.be.a("string").and.not.be.empty;
      }
    });
  });

  it("check-out: records today's check-out (after check-in), or reports no matching record", () => {
    cy.intercept("POST", "**/graphql", (req) => {
      if (req.body?.operationName === "RecordCheckOut") req.alias = "checkOut";
    });

    cy.loginByRole("hrManager");
    cy.visit("/hr/dashboard/attendance");
    cy.contains("label", "Employee").parents(".MuiAutocomplete-root").find("input").type("EMP-2026-0008");
    cy.get('[role="listbox"] [role="option"]').first().click();

    cy.contains("button", "Check-out").click();
    cy.wait("@checkOut").then(({ response }) => {
      const errors = response?.body?.errors;
      if (errors) {
        const message = JSON.stringify(errors);
        expect(message, `unexpected recordCheckOut error: ${message}`).to.match(
          /attendance record not found for this date/i,
        );
      } else {
        const record = response?.body?.data?.recordCheckOut;
        expect(record?.checkOutTime, "check-out time").to.be.a("string").and.not.be.empty;
      }
    });
  });

  it("manual request + approve: submits a correction and an HR manager approves it", () => {
    cy.intercept("POST", "**/graphql", (req) => {
      if (req.body?.operationName === "RequestManualAttendance") req.alias = "manualRequest";
    });

    cy.loginByRole("hrManager");
    cy.visit("/hr/dashboard/attendance");
    cy.contains("label", "Employee").parents(".MuiAutocomplete-root").find("input").type("EMP-2026-0009");
    cy.get('[role="listbox"] [role="option"]').first().click();

    const date = randomPastDate();
    cy.contains("button", "Manual request").click();
    cy.get('[role="dialog"]').filter(":visible").within(() => {
      cy.get('input[type="date"]').clear().type(date);
      cy.contains("button", "Submit request").click();
    });

    cy.wait("@manualRequest").then(({ response }) => {
      expect(response?.body.errors, "requestManualAttendance should not error").to.not.exist;
      const record = response?.body?.data?.requestManualAttendance;
      // Frontend's mutation doesn't select requestedStatus/approvedBy, only
      // status -- a fresh request stays ABSENT until HR approves it. The
      // record's date can land in a month other than the one currently
      // displayed, so approval is verified directly through the app's own
      // same-origin /api/graphql proxy (authenticated via the session
      // cookie cy.loginByRole already set) rather than fighting month
      // navigation in the table UI.
      expect(record?.id, "created record id").to.be.a("string").and.not.be.empty;
      expect(record?.status, "status before approval").to.eq("ABSENT");

      cy.request({
        method: "POST",
        url: "/api/graphql",
        headers: { Origin: Cypress.config("baseUrl") ?? "" },
        body: {
          operationName: "ApproveManualAttendance",
          query: `mutation ApproveManualAttendance($attendanceId: ID!) {
            approveManualAttendance(attendanceId: $attendanceId) { id status }
          }`,
          variables: { attendanceId: record.id },
        },
      }).then((res) => {
        expect(res.body.errors, "approveManualAttendance should not error").to.not.exist;
        expect(res.body.data?.approveManualAttendance?.status, "approved status").to.eq("PRESENT");
      });
    });
  });
});
