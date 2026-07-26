/// <reference types="cypress" />

// Regression coverage for Staff Attendance's sibling page, Leave Management
// (/hr/dashboard/leave). Three real bugs reported here, all fixed:
//
//  - getLeaveApplications required employeeId (schema: ID!), so nothing
//    showed until an employee was picked. Backend now accepts a nullable
//    employeeId (ID) and returns every tenant leave application when it's
//    omitted; the frontend now always queries (no `skip`) and no longer
//    gates the table behind an employee-selection screen.
//  - The Employee column's accessorFn hardcoded "—" for any employee with
//    no linked user account (emp.userId null), instead of falling back to
//    the employee code like every other employee-picker in the app does.
//    EMP-2026-0001 has no linked user, so its leave application always
//    rendered a blank "—" in that column.
//  - The real one: even with both fixes above, the Employee column still
//    showed "—" for every row in the all-leaves view (employees WITH a
//    linked user included). tanstack-table memoizes its row model keyed on
//    the `data` array reference; GetLeaveApplications resolves before
//    GetEmployees does, so the accessorFn's employeeLookup/userLookup
//    closures were empty on the table's first pass, and since leaveRecords'
//    array reference never changed afterward, the table never recomputed
//    even once employees loaded. Fixed by baking the resolved name into
//    each row (employeeDisplayName) via .map() before handing the array to
//    the table, so `data` itself changes once employees load -- this is
//    the scenario the first test below actually exercises.

describe("Leave management", () => {
  it("shows every tenant leave application, with real employee names resolved, when no employee is selected", () => {
    cy.intercept("POST", "**/graphql", (req) => {
      if (req.body?.operationName === "GetLeaveApplications") req.alias = "getLeaveApplications";
      if (req.body?.operationName === "GetEmployees") req.alias = "getEmployees";
    });

    cy.loginByRole("hrManager");
    cy.visit("/hr/dashboard/leave");

    cy.wait("@getLeaveApplications").then(({ request, response }) => {
      expect(request.body.variables?.employeeId, "employeeId should be omitted").to.be.undefined;
      expect(response?.body.errors, "getLeaveApplications should not error").to.not.exist;
      const list = response?.body?.data?.getLeaveApplications;
      expect(list, "leave applications list").to.be.an("array").and.have.length.greaterThan(0);
    });
    cy.wait("@getEmployees");

    cy.contains("Total applications").parent().should("not.contain", "0");

    // The real regression: table cells must actually re-render with the
    // resolved name once employees load, not freeze on the table's
    // first-pass "—" (see comment above).
    cy.get("table tbody tr").should("have.length.greaterThan", 0);
    cy.get("table tbody tr td").first().should("not.have.text", "—");
  });

  it("shows the employee code (not a blank dash) for an employee with no linked user account", () => {
    cy.loginByRole("hrManager");
    cy.visit("/hr/dashboard/leave");

    cy.contains("label", "Employee").parents(".MuiAutocomplete-root").find("input").type("EMP-2026-0001");
    cy.get('[role="listbox"] [role="option"]').first().click();

    cy.get("table tbody tr").should("have.length.greaterThan", 0);
    // Scoped to the Employee column specifically -- other columns (Reason)
    // legitimately render "—" for null values.
    cy.get("table tbody tr").first().find("td").first().should("contain", "EMP-2026-0001");
  });
});
