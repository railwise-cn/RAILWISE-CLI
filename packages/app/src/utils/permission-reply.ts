type PermissionReply = "once" | "always" | "reject"

export function permissionReplyInput(input: {
  sessionID?: string
  permissionID: string
  response: PermissionReply
  directory?: string
}) {
  return {
    requestID: input.permissionID,
    reply: input.response,
    directory: input.directory,
  }
}
