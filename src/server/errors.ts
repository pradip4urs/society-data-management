export class DomainError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const denied = () => new DomainError(403, "Access denied");
export const missing = () => new DomainError(404, "Record not found");
