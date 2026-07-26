/// <reference types="cypress" />

// Regression coverage for Staff Attendance's sibling page, Leave Management
// (/hr/dashboard/leave). Two real bugs reported here, both fixed:
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

describe("Leave management", () => {
  it("shows every tenant leave application when no employee is selected", () => {
    cy.intercept("POST", "**/graphql", (req) => {
      if (req.body?.operationName === "GetLeaveApplications") req.alias = "getLeaveApplications";
    });

    cy.loginByRole("hrManager");
    cy.visit("/hr/dashboard/leave");

    cy.wait("@getLeaveApplications").then(({ request, response }) => {
      expect(request.body.variables?.employeeId, "employeeId should be omitted").to.be.undefined;
      expect(response?.body.errors, "getLeaveApplications should not error").to.not.exist;
      const list = response?.body?.data?.getLeaveApplications;
      expect(list, "leave applications list").to.be.an("array").and.have.length.greaterThan(0);
    });

    cy.contains("Total applications").parent().should("not.contain", "0");
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
