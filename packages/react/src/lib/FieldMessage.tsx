export type FieldMessageProps = {
  /** The element each message renders as: `span` for the atoms, `p` for `FormField`. */
  as: 'span' | 'p';
  hint?: string;
  error?: string;
  hintId: string | undefined;
  errorId: string | undefined;
  hintClassName: string;
  errorClassName: string;
};

/**
 * The hint and error slots every labelled control renders. Internal: not
 * exported from the package.
 *
 * Two slots, not one ternary: a hint turning into an error must mount a fresh
 * `role="alert"` element. Reusing the hint's node would add the role and the
 * text in one commit, and a live region that did not exist before the change
 * is not reliably announced. The hint renders only while there is no error,
 * so the caller must only describe the control by `hintId` in that case
 * (`messageDescribedBy`).
 */
export function FieldMessage({
  as: Tag,
  hint,
  error,
  hintId,
  errorId,
  hintClassName,
  errorClassName,
}: FieldMessageProps) {
  return (
    <>
      {hint && !error ? (
        <Tag id={hintId} className={hintClassName}>
          {hint}
        </Tag>
      ) : null}
      {error ? (
        <Tag id={errorId} className={errorClassName} role="alert">
          {error}
        </Tag>
      ) : null}
    </>
  );
}

/** The id of the message `FieldMessage` is showing, or `undefined` when it shows none. */
export function messageDescribedBy(
  hint: string | undefined,
  error: string | undefined,
  hintId: string | undefined,
  errorId: string | undefined,
): string | undefined {
  if (error) return errorId;
  if (hint) return hintId;
  return undefined;
}
