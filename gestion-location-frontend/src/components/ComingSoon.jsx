import EmptyState from "./EmptyState";

export default function ComingSoon({ title }) {
  return <EmptyState icon="bi-hourglass-split" title={title} description="Cette section arrive bientôt." />;
}
