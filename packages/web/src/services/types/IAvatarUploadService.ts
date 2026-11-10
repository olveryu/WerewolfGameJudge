/** Avatar upload boundary implemented by the active infrastructure adapter. */
export interface IAvatarUploadService {
  /** Upload a picked avatar image and return its public URL. */
  uploadAvatar(file: File): Promise<string>;
}
