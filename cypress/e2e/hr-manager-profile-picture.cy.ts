/// <reference types="cypress" />

// Verifies a real HR_MANAGER account (rafiul.gaming007@gmail.com) can reach
// the my-profile page and upload a profile picture -- both the page and the
// upload feature are new/recently added and hadn't been exercised for this
// specific role before.

describe("HR manager: my-profile access and profile picture upload", () => {
  it("reaches the my-profile page without error", () => {
    cy.loginByRole("hrManager");
    // Regression: /dashboard/hr/my-profile lives under the center-admin shell
    // and silently bounces pure HR staff back to /hr/dashboard. Their My
    // Profile page is /hr/dashboard/my-profile.
    cy.visit("/hr/dashboard/my-profile");

    cy.location("pathname").should("eq", "/hr/dashboard/my-profile");
    cy.contains("h1, h4, h5", "My Profile").should("exist");
    // A crashed/misrouted page would show Next's default error boundary text.
    cy.contains("Application error").should("not.exist");
  });

  it("uploads a new profile picture from the topbar account menu", () => {
    cy.intercept("POST", "**/graphql", (req) => {
      if (req.body?.operationName === "UploadProfilePicture") req.alias = "uploadPicture";
      if (req.body?.operationName === "Me") req.alias = "me";
    });

    cy.loginByRole("hrManager");
    cy.visit("/dashboard");
    cy.wait("@me");

    cy.openAccountMenu();

    cy.get('[role="menu"] input[type="file"]').selectFile(
      "cypress/fixtures/sample-avatar.png",
      { force: true },
    );

    cy.wait("@uploadPicture").then(({ response }) => {
      expect(response?.body.errors, "uploadProfilePicture should not error").to.not.exist;
      const url = response?.body.data?.uploadProfilePicture?.profilePicture;
      expect(url, "returned profile picture URL").to.be.a("string").and.not.be.empty;
    });

    cy.contains("Profile picture updated").should("exist");
    cy.get('button[aria-haspopup="menu"] img').should("have.attr", "src");
  });
});
