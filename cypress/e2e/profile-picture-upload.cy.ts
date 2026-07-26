/// <reference types="cypress" />

// Covers the profile picture upload feature (ProfilePictureUploader.tsx),
// which previously didn't exist at all: profilePicture was a plain string
// field settable only via updateProfile, with no UI to actually upload an
// image. This exercises the real path -- topbar avatar in the account menu,
// backed by UploadProfilePicture (base64 -> FileStoragePort -> R2 URL).

describe("Profile picture upload", () => {
  it("uploads a new photo from the topbar account menu and it takes effect", () => {
    cy.intercept("POST", "**/graphql", (req) => {
      if (req.body?.operationName === "UploadProfilePicture") req.alias = "uploadPicture";
      if (req.body?.operationName === "Me") req.alias = "me";
    });

    cy.loginByRole("tenant");
    cy.visit("/dashboard");
    cy.wait("@me");

    // Opens the account menu (the compact topbar button), where the larger
    // avatar + upload affordance lives.
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

    // The topbar's small trigger avatar should now render the uploaded image
    // rather than falling back to initials.
    cy.get('button[aria-haspopup="menu"] img').should("have.attr", "src");
  });
});
