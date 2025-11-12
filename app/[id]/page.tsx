import TeamPageClient from "./TeamPageClient";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TeamPageClient teamId={parseInt(id)} />;
}
