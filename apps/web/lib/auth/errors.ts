/** Caller has no session. Route handlers turn this into a 401. */
export class UnauthorizedError extends Error {
  constructor(message = "Not signed in") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/** Caller is signed in but not a member of the workspace they asked for. */
export class ForbiddenError extends Error {
  constructor(message = "Not a member of this workspace") {
    super(message);
    this.name = "ForbiddenError";
  }
}
