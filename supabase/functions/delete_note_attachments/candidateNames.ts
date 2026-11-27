const MAX_CANDIDATES_PER_CALL = 100;

// The app uploads files under the caller's organization id, named
// `${Math.random()}${extension}`, e.g. `org_2abc/0.8262106278726917.pdf`.
const UPLOADED_FILE_NAME = /^0\.[0-9]+(\.[^./]*)?$/;

type NoteAttachment = {
  path?: string | null;
  src?: string | null;
};

export type WebhookPayload = {
  old_record?: { attachments?: NoteAttachment[] | null } | null;
};

// Returns the paths of the files attached to the note before the change: the
// files we may delete. The payload is not trusted, so only paths under the
// caller's organization that look like files uploaded by the app are returned,
// at most MAX_CANDIDATES_PER_CALL.
export const getCandidateNames = (
  payload: WebhookPayload,
  organizationId: string,
): string[] => {
  const attachments = payload?.old_record?.attachments;
  if (!organizationId || !Array.isArray(attachments)) {
    return [];
  }

  const names = Array.from(
    new Set(
      attachments
        .map((attachment) => getFileName(attachment, organizationId))
        .filter((name): name is string => name != null),
    ),
  );

  if (names.length > MAX_CANDIDATES_PER_CALL) {
    console.warn("Too many note attachments, only checking the first ones", {
      count: names.length,
      checked: MAX_CANDIDATES_PER_CALL,
    });
  }

  return names.slice(0, MAX_CANDIDATES_PER_CALL);
};

// Returns the object path of an attachment, read from its `path`, or from its
// `src` URL when it has no path. Returns null for anything that is not under
// the caller's organization or does not look like a file uploaded by the app,
// so the caller cannot point at another tenant's files or other bucket paths.
const getFileName = (
  attachment: NoteAttachment | null | undefined,
  organizationId: string,
) => {
  const name =
    typeof attachment?.path === "string" && attachment.path !== ""
      ? attachment.path
      : getPathFromSrc(attachment?.src);
  if (name == null || !name.startsWith(`${organizationId}/`)) {
    return null;
  }
  const fileName = name.slice(organizationId.length + 1);
  return UPLOADED_FILE_NAME.test(fileName) ? name : null;
};

const getPathFromSrc = (src?: string | null) => {
  if (typeof src !== "string") {
    return null;
  }
  try {
    const pathname = new URL(src).pathname;
    // Public URLs end with /object/public/<bucket>/<path>; authenticated and
    // signed URLs vary, so fall back to the last path segment.
    const marker = "/object/";
    const markerIndex = pathname.indexOf(marker);
    if (markerIndex >= 0) {
      const afterObject = pathname.slice(markerIndex + marker.length);
      const segments = afterObject.split("/");
      // Drop "public|authenticated|sign" and the bucket name.
      return safelyDecodePath(segments.slice(2).join("/"));
    }
    return safelyDecodePath(pathname.slice(pathname.lastIndexOf("/") + 1));
  } catch {
    return null;
  }
};

const safelyDecodePath = (path: string) => {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
};
