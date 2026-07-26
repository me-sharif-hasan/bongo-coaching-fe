/// <reference types="cypress" />

// Regression guard: a report came in that the Employee dropdown on Staff
// Attendance (/hr/dashboard/attendance) appeared empty for the HR_MANAGER
// account rafiul.gaming007@gmail.com. Backend, the frontend's /api/graphql
// proxy, and a fresh production session all checked out fine when
// investigated -- most likely a stale cached JS bundle in that browser
// session. This pins the real behavior so a genuine regression here would
// be caught immediately.

describe("HR manager: staff attendance employee dropdown", () => {
  it("populates the Employee dropdown with real options", () => {
    cy.intercept("POST", "**/graphql", (req) => {
      if (req.body?.operationName === "GetEmployees") req.alias = "getEmployees";
    });

    cy.loginByRole("hrManager");
    cy.visit("/hr/dashboard/attendance");

    cy.wait("@getEmployees").then(({ response }) => {
      expect(response?.body.errors, "getEmployees should not error").to.not.exist;
      const list = response?.body?.data?.getEmployees;
      expect(list, "employees list").to.be.an("array").and.have.length.greaterThan(0);
    });

    cy.contains("label", "Employee").parents(".MuiAutocomplete-root").find("input").click();
    cy.get('[role="listbox"] [role="option"]').should("have.length.greaterThan", 0);
  });
});
