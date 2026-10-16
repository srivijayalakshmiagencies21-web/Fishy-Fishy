/**
 * Lets the root layout (and the launch splash in it) stream before the workspace data resolves.
 * The splash waits for this marker to disappear before fading out.
 */
export default function Loading() {
  return <span data-launch-pending hidden />;
}
