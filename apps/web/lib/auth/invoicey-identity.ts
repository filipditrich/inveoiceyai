/** Password credentials are provisioned by operators, never public registration. */
export const invoiceyIdentityOptions = {
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 16,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
  },
  disabledPaths: [
    "/sign-up/email",
    "/request-password-reset",
    "/reset-password",
    "/set-password",
  ],
};
