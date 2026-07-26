/// <reference types="cypress" />

// Covers /bongo/dashboard (BongoDashboardPage.tsx), which previously had no
// e2e coverage. Regression guard for a real bug: BillingService.getRevenueSummary
// (backend) throws "Plan not found" if ANY tenant's planId points to a deleted
// SubscriptionPlan row, which kills the whole GraphQL response (data: null).
// The frontend's useQuery never destructures `error`, so that failure rendered
// as silent blank "—" stat tiles with no visible sign anything was wrong.
// This test asserts the tiles actually render numeric/currency values, not "—".

describe("Bongo platform dashboard", () => {
  it("super admin: sees populated revenue summary stat tiles and recent tenants", () => {
    cy.intercept("POST", "**/graphql", (req) => {
      if (req.body?.operationName === "GetRevenueSummary") req.alias = "getRevenueSummary";
      if (req.body?.operationName === "GetTenants") req.alias = "getTenants";
    });

    cy.loginByRole("bongo");
    cy.visit("/bongo/dashboard");

    cy.wait("@getRevenueSummary").then(({ response }) => {
      expect(response?.body.errors, "getRevenueSummary should not error").to.not.exist;
      expect(response?.body.data?.getRevenueSummary).to.exist;
    });
    cy.wait("@getTenants").then(({ response }) => {
      expect(response?.body.errors, "getTenants should not error").to.not.exist;
    });

    const tileLabels = [
      "Total Tenants",
      "Active Subscriptions",
      "Monthly Recurring Revenue",
      "Outstanding",
    ];

    tileLabels.forEach((label) => {
      cy.contains(label)
        .parents(".MuiCardContent-root")
        .first()
        .within(() => {
          // The bug this guards against renders literally "—" here instead
          // of a number/currency string when the backend query errors out.
          cy.get(".MuiTypography-h4").invoke("text").should("not.equal", "—");
        });
    });

    cy.contains("Recently Onboarded").should("exist");
  });
});
