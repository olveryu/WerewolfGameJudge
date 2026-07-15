/** Avatar upload boundary implemented by the active infrastructure adapter. */
export interface IAvatarUploadService {
  /** Upload a local avatar image and return its public URL. */
  uploadAvatar(fileUri: string): Promise<string>;
}
