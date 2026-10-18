export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string) => new AppError(400, msg, "BAD_REQUEST");
export const unauthorized = (msg = "Authentification requise") => new AppError(401, msg, "UNAUTHORIZED");
export const forbidden = (msg = "Accès refusé") => new AppError(403, msg, "FORBIDDEN");
export const notFound = (what = "Ressource") => new AppError(404, `${what} introuvable`, "NOT_FOUND");
export const conflict = (msg: string) => new AppError(409, msg, "CONFLICT");
