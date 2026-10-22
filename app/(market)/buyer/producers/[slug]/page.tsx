import { notFound } from "next/navigation";
import { ProducerProfile } from "@/components/demo-views";
import { producers } from "@/lib/demo-data";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!producers.some((producer) => producer.slug === slug)) notFound();
  return <ProducerProfile slug={slug} />;
}
