import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

// Le blog public (/blog et /blog/[slug]) est mis en cache côté serveur avec
// `next: { revalidate: 60 }` (voir src/app/blog/page.js et [slug]/page.js) :
// sans ce endpoint, publier/dépublier/modifier un article depuis le backoffice
// admin met jusqu'à 60s à se refléter côté public. Appelé juste après une
// mutation réussie (publish/unpublish/save/delete) pour que le changement soit
// visible dès le prochain chargement, tout en gardant le TTL de 60s comme
// filet de sécurité si cet appel échoue.
export async function POST(request) {
  const { slug, previousSlug } = await request.json().catch(() => ({}));

  revalidatePath("/blog");
  if (slug) revalidatePath(`/blog/${slug}`);
  if (previousSlug && previousSlug !== slug) revalidatePath(`/blog/${previousSlug}`);

  return NextResponse.json({ revalidated: true });
}
