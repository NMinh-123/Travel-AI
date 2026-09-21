import type { Prisma } from '@prisma/client';
import { WEBSITE_DESTINATIONS } from '@data/website/destinations';
import { PLACE_IMAGES } from '@data/website/images';
import { findPlace } from '@data/places/index';
import type { WebsiteDestination } from '@data/website/types';
import type { Destination, DestinationPhoto } from '@shared/types';

export const DESTINATION_ILLUSTRATION = '/destination-illustration.svg';
const bySlug = new Map(WEBSITE_DESTINATIONS.map(d => [d.slug, d]));
export function destinationContent(slug: string): WebsiteDestination | undefined { return bySlug.get(slug); }

/** Only display photos with known attribution. Never silently label a regional fallback as this place. */
export function destinationPhotos(slug: string, urls: string[]): DestinationPhoto[] {
  const content = bySlug.get(slug);
  const own = new Set((PLACE_IMAGES[slug] ?? []).map(image => image.url));
  return [...new Set(urls)].flatMap(url => {
    const sourceKey = content && PLACE_IMAGES[content.imageSlug]?.some(photo => photo.url === url)
      ? content.imageSlug : Object.keys(PLACE_IMAGES).find(key => PLACE_IMAGES[key].some(photo => photo.url === url));
    const image = sourceKey ? PLACE_IMAGES[sourceKey].find(photo => photo.url === url) : undefined;
    if (!image) return [];
    return [{ url, kind: own.has(url) ? 'place' as const : 'area' as const,
      regionLabel: sourceKey ? findPlace(sourceKey)?.name ?? 'Hà Giang' : 'Hà Giang', credit: image.credit,
      license: image.license, sourcePage: image.sourcePage }];
  });
}

/**
 * How sure we are of this destination's coordinates — read from the one store that records it.
 *
 * Deliberately derived rather than stored a second time on WebsiteDestination: @data/website/types
 * requires slug, lat, lng and elevation to match Place.geo, and a duplicated confidence level is
 * exactly the second source of truth that rule exists to prevent.
 */
export function locationPrecisionOf(d: WebsiteDestination): NonNullable<Destination['locationPrecision']> {
  if (d.lat === null || d.lng === null) return 'unknown';
  return findPlace(d.slug)?.geo?.precision ?? 'unknown';
}

export function destinationRowData(d: WebsiteDestination): Prisma.DestinationUncheckedCreateInput {
  const images = PLACE_IMAGES[d.imageSlug] ?? [];
  return { slug: d.slug, name: d.name, vietnameseName: d.vietnameseName,
    district: d.regionLabel, category: d.category, elevation: d.elevation,
    distanceFromStart: d.distanceFromStart, difficulty: d.difficulty, bestTime: d.bestTime,
    highlights: d.highlights, imageUrl: images[0]?.url ?? DESTINATION_ILLUSTRATION,
    gallery: images.slice(1).map(image => image.url), description: d.description,
    safetyTip: d.safetyTip, lat: d.lat, lng: d.lng,
    locationPrecision: locationPrecisionOf(d) as Prisma.DestinationUncheckedCreateInput['locationPrecision'],
    recommendedStayHours: d.recommendedStayHours,
    localFood: d.localFood, sortOrder: d.sortOrder };
}

/** Validate before any write, including a dry run; fail rather than partially publish a broken catalog. */
export function validateDestinationCatalog(items: WebsiteDestination[]): void {
  const slugs = new Set<string>();
  const categories = new Set(['pass', 'nature', 'culture', 'viewpoint', 'waterfall', 'homestay']);
  const difficulties = new Set(['Dễ đi', 'Trung bình', 'Đòi hỏi tay lái vững', 'Hiểm trở']);
  for (const d of items) {
    if (slugs.has(d.slug) || !findPlace(d.slug)) throw new Error(`Invalid destination slug: ${d.slug}`);
    slugs.add(d.slug);
    if (!categories.has(d.category) || !difficulties.has(d.difficulty)) throw new Error(`Invalid classification: ${d.slug}`);
    if ((d.lat === null) !== (d.lng === null) ||
      (d.lat !== null && (!Number.isFinite(d.lat) || Math.abs(d.lat) > 90)) ||
      (d.lng !== null && (!Number.isFinite(d.lng) || Math.abs(d.lng) > 180))) throw new Error(`Invalid coordinates: ${d.slug}`);
    // The catalog must carry whatever the place store knows, not a quietly emptier copy of it.
    // Blanking these here is how 8 destinations lost coordinates the store still held, and how
    // two of them lost a surveyed position that would have rendered a map.
    const geo = findPlace(d.slug)?.geo;
    if (geo && (d.lat !== geo.lat || d.lng !== geo.lng)) throw new Error(`Coordinates disagree with the place store: ${d.slug}`);
    if (geo?.elevationM != null && d.elevation !== null && d.elevation !== geo.elevationM) throw new Error(`Elevation disagrees with the place store: ${d.slug}`);
    for (const value of [d.elevation, d.distanceFromStart]) {
      if (value !== null && (!Number.isInteger(value) || value < 0)) throw new Error(`Invalid measurement: ${d.slug}`);
    }
    if (!Number.isFinite(d.recommendedStayHours) || d.recommendedStayHours <= 0 || !Number.isInteger(d.sortOrder)) throw new Error(`Invalid duration/order: ${d.slug}`);
    if (!d.name || !d.vietnameseName || !d.description || !d.bestTime || !d.safetyTip || d.highlights.length < 3) throw new Error(`Incomplete content: ${d.slug}`);
    if (d.collection === 'expanded-20260918' && !d.sourceLinks?.length) throw new Error(`Missing sources: ${d.slug}`);
    for (const source of d.sourceLinks ?? []) {
      if (new URL(source.url).protocol !== 'https:') throw new Error(`Invalid source URL: ${d.slug}`);
    }
  }
}
