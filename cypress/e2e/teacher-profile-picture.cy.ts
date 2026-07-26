/// <reference types="cypress" />

// Checks the teacher "My Profile" page/route for both teacher-shaped roles
// (requested alongside the HR_MANAGER check, since it uses the same
// UserProfile.tsx routing logic and MyProfileWorkspace component).

describe("Teacher / Head Teacher: my-profile access and profile picture upload", () => {
  it("teacher: reaches /teacher/dashboard/my-profile and can upload a photo", () => {
    cy.intercept("POST", "**/graphql", (req) => {
      if (req.body?.operationName === "UploadProfilePicture") req.alias = "uploadPicture";
      if (req.body?.operationName === "Me") req.alias = "me";
    });

    cy.loginByRole("teacher");
    cy.visit("/teacher/dashboard/my-profile");
    cy.location("pathname").should("eq", "/teacher/dashboard/my-profile");
    cy.contains("h1, h4, h5", "My Profile").should("exist");
    cy.contains("Application error").should("not.exist");

    cy.visit("/teacher/dashboard");
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
  });

  it("head teacher: reaches /teacher/dashboard/my-profile", () => {
    cy.loginByRole("headTeacher");
    cy.visit("/teacher/dashboard/my-profile");
    cy.location("pathname").should("eq", "/teacher/dashboard/my-profile");
    cy.contains("h1, h4, h5", "My Profile").should("exist");
    cy.contains("Application error").should("not.exist");
  });

  it("head teacher: profile picture upload is blocked by a real backend permission gap", () => {
    // HEAD_TEACHER (no USER role) has USER_READ but not USER_WRITE in
    // RolePermissions.java, so uploadProfilePicture/updateProfile are both
    // rejected for accounts holding only this role. This documents that gap
    // rather than asserting success -- it is a pre-existing permission-model
    // limitation, not something introduced by the profile picture feature.
    cy.intercept("POST", "**/graphql", (req) => {
      if (req.body?.operationName === "UploadProfilePicture") req.alias = "uploadPicture";
      if (req.body?.operationName === "Me") req.alias = "me";
    });

    cy.loginByRole("headTeacher");
    cy.visit("/teacher/dashboard");
    cy.wait("@me");
    cy.openAccountMenu();
    cy.get('[role="menu"] input[type="file"]').selectFile(
      "cypress/fixtures/sample-avatar.png",
      { force: true },
    );

    cy.wait("@uploadPicture").then(({ response }) => {
      expect(response?.body.errors, "expected a permission error for HEAD_TEACHER-only accounts")
        .to.exist;
    });
  });
});
