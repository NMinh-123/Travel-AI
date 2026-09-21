import 'dotenv/config';
import { prisma } from '@server/infra/db';
import { EXPANDED_DESTINATIONS } from '@data/website/expanded-destinations';
import { PLACES } from '@data/places/index';
import { destinationRowData, validateDestinationCatalog } from '@server/domain/destinationCatalog';

// Dry run by default. Only upsert the expanded collection; never delete or rewrite the original stops.
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--apply')) throw new Error('Usage: npm run db:sync-explore -- [--apply]');
  const apply = args.includes('--apply');
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('This command only supports a verified local database.');
  validateDestinationCatalog(EXPANDED_DESTINATIONS);
  const slugs = EXPANDED_DESTINATIONS.map(d => d.slug);
  const places = PLACES.filter(p => slugs.includes(p.slug));
  const existing = await prisma.destination.findMany({ where: { slug: { in: slugs } }, select: { slug: true } });
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', destinations: slugs,
    create: slugs.filter(slug => !existing.some(d => d.slug === slug)).length,
    update: existing.length, deletes: 0 }));
  if (!apply) return;
  await prisma.$transaction(async tx => {
    for (const p of places) {
      const data = { name: p.name, kind: p.kind, aliases: p.aliases, sortOrder: p.sortOrder };
      // Existing region/Place metadata is preserved; the five missing places are inserted.
      await tx.place.upsert({ where: { slug: p.slug }, create: { slug: p.slug, ...data }, update: {} });
    }
    for (const d of EXPANDED_DESTINATIONS) {
      const data = destinationRowData(d);
      await tx.destination.upsert({ where: { slug: d.slug }, create: data, update: data });
    }
  });
  console.log(JSON.stringify({ expandedDestinations: await prisma.destination.count({ where: { slug: { in: slugs } } }),
    totalDestinations: await prisma.destination.count() }));
}

main().catch(error => { console.error(error instanceof Error ? error.message : 'Explore sync failed'); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
