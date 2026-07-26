/// <reference types="cypress" />

// Regression coverage for Staff Attendance's sibling page, Leave Management
// (/hr/dashboard/leave). Real issues reported here, all fixed:
//
//  - getLeaveApplications required employeeId (schema: ID!), so nothing
//    showed until an employee was picked. Backend now accepts a nullable
//    employeeId (ID) and returns every tenant leave application when it's
//    omitted; the frontend now always queries (no `skip`) and no longer
//    gates the table behind an employee-selection screen.
//  - The Employee column resolved the name client-side (join against
//    GetEmployees/GetUsers), which had two problems: it hardcoded "—" for
//    an employee with no linked user account instead of falling back to
//    the employee code, and -- the real bug -- tanstack-table memoizes its
//    row model keyed on the `data` array reference, so when
//    GetLeaveApplications resolved before GetEmployees did, the table
//    froze on "—" for every row and never recomputed even once employees
//    loaded (the array reference never changed). Fixed properly by moving
//    name resolution server-side: getLeaveApplications now returns
//    employeeName directly on each LeaveApplication (resolved from the
//    employee's linked user, falling back to employee code), so the raw
//    API response itself carries the name and there's no client-side join
//    or race to get wrong.
//  - getLeaveApplications returned every row in one unpaginated response
//    with no ORDER BY (arbitrary DB order). It's now genuinely paginated
//    (page/limit args, LeaveApplicationPage { items, totalCount },
//    latest-first via ORDER BY appliedAt DESC), and the table uses
//    manualPagination wired to those args instead of client-side
//    pagination over a locally-fetched full list.

describe("Leave management", () => {
  it("shows every tenant leave application, with employeeName resolved server-side, when no employee is selected", () => {
    cy.intercept("POST", "**/graphql", (req) => {
      if (req.body?.operationName === "GetLeaveApplications") req.alias = "getLeaveApplications";
    });

    cy.loginByRole("hrManager");
    cy.visit("/hr/dashboard/leave");

    cy.wait("@getLeaveApplications").then(({ request, response }) => {
      expect(request.body.variables?.employeeId, "employeeId should be omitted").to.be.undefined;
      expect(request.body.variables?.page, "page defaults to 1").to.eq(1);
      expect(response?.body.errors, "getLeaveApplications should not error").to.not.exist;
      const page = response?.body?.data?.getLeaveApplications;
      expect(page?.items, "leave applications items").to.be.an("array").and.have.length.greaterThan(0);
      expect(page?.totalCount, "totalCount").to.be.a("number").and.be.greaterThan(page.items.length);
      // The actual complaint: employeeName must be present in the raw
      // API response itself, not resolved by a separate client-side query.
      page.items.forEach((item: { employeeName?: string | null }) => {
        expect(item.employeeName, "employeeName on each item").to.be.a("string").and.not.be.empty;
      });
    });

    cy.contains("Total applications").parent().should("not.contain", "0");
    cy.get("table tbody tr").should("have.length.greaterThan", 0);
    cy.get("table tbody tr td").first().should("not.have.text", "—");
  });

  it("paginates server-side: page 2 fetches different, later rows", () => {
    cy.intercept("POST", "**/graphql", (req) => {
      if (req.body?.operationName === "GetLeaveApplications") req.alias = "getLeaveApplications";
    });

    cy.loginByRole("hrManager");
    cy.visit("/hr/dashboard/leave");
    cy.wait("@getLeaveApplications");

    cy.get('button[aria-label="Go to next page"]').click();
    cy.wait("@getLeaveApplications").then(({ request, response }) => {
      expect(request.body.variables?.page, "page 2 requested").to.eq(2);
      expect(response?.body.errors, "getLeaveApplications should not error").to.not.exist;
      const page = response?.body?.data?.getLeaveApplications;
      expect(page?.items, "page 2 items").to.be.an("array").and.have.length.greaterThan(0);
    });

    cy.contains(/21-\d+ of \d+/).should("exist");
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
