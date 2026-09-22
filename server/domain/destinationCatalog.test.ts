import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { WEBSITE_DESTINATIONS } from '@data/website/destinations';
import { EXPANDED_DESTINATIONS } from '@data/website/expanded-destinations';
import { findPlace } from '@data/places/index';
import { PLACE_IMAGES as COMMONS_IMAGES } from '@data/website/images';
import { MANUAL_PLACE_IMAGES } from '@data/website/images-manual';
import { filterDestinations } from '@client/lib/destinationFilters';
import { DestinationDetailModal } from '@client/components/DestinationDetailModal';
import { toDestination } from './mappers';
import { destinationPhotos, destinationRowData, locationPrecisionOf, validateDestinationCatalog } from './destinationCatalog';
import type { Destination as DestinationRow } from '@prisma/client';

const rows: DestinationRow[] = WEBSITE_DESTINATIONS.map(d => ({
  id: `fixture-${d.slug}`, slug: d.slug, name: d.name, vietnameseName: d.vietnameseName,
  district: d.regionLabel, category: d.category, elevation: d.elevation, distanceFromStart: d.distanceFromStart,
  difficulty: d.difficulty, bestTime: d.bestTime, highlights: d.highlights,
  imageUrl: destinationRowData(d).imageUrl, gallery: [], description: d.description, safetyTip: d.safetyTip,
  lat: d.lat, lng: d.lng, locationPrecision: locationPrecisionOf(d),
  recommendedStayHours: d.recommendedStayHours, localFood: d.localFood, sortOrder: d.sortOrder,
}));
const destinations = rows.map(toDestination);
const all = { query: '', category: 'all', region: 'all' };

describe('expanded discovery catalog', () => {
  it('contains 26 unique joined places, with all new parent references resolvable', () => {
    expect(() => validateDestinationCatalog(WEBSITE_DESTINATIONS)).not.toThrow();
    expect(new Set(WEBSITE_DESTINATIONS.map(d => d.slug)).size).toBe(26);
    expect(EXPANDED_DESTINATIONS).toHaveLength(13);
    expect(WEBSITE_DESTINATIONS.map(d => d.sortOrder)).toEqual(Array.from({ length: 26 }, (_, i) => i));
    for (const d of WEBSITE_DESTINATIONS) {
      const place = findPlace(d.slug)!;
      expect(place).toBeDefined();
      if (place.parentSlug) expect(findPlace(place.parentSlug)).toBeDefined();
    }
  });
  it('rejects a half-coordinate pair, a missing source, duplicate slug and invalid source protocol before upsert', () => {
    const point = EXPANDED_DESTINATIONS[0];
    for (const fixture of [[{ ...point, lat: 22 }], [{ ...point, sourceLinks: [] }], [point, point],
      [{ ...point, sourceLinks: [{ title: 'Unsafe', url: 'javascript:alert(1)' }] }]]) {
      expect(() => validateDestinationCatalog(fixture)).toThrow();
    }
  });
  it('carries every coordinate the place store holds, each at its own confidence', () => {
    for (const d of destinations.filter(d => d.collection === 'expanded-20260918')) {
      expect(d.distanceFromStart).toBeNull();
      expect(d.sourceLinks.length).toBeGreaterThan(0);
      // A coordinate and a confidence level always travel together, in both directions.
      expect(d.coordinates === null).toBe(d.locationPrecision === 'unknown');
    }
    const byPrecision = (level: string) => destinations.filter(d => d.locationPrecision === level).map(d => d.id);
    expect(byPrecision('surveyed')).toContain('sung-la');
    expect(byPrecision('surveyed')).toContain('thac-tien-deo-gio');
    expect(byPrecision('approximate')).toContain('ban-lo-lo-chai');
    // The five places with no geo entry anywhere keep saying so rather than borrowing a number.
    expect(byPrecision('unknown').sort()).toEqual(['bai-da-co-nam-dan', 'dinh-chieu-lau-thi',
      'dong-lung-khuy', 'lang-van-hoa-pa-vi-ha', 'thao-nguyen-suoi-thau']);
    // An elevation sourced on its own stands without coordinates; a missing one stays missing.
    expect(destinations.find(d => d.id === 'dinh-chieu-lau-thi')?.elevation).toBe(2402);
    expect(destinations.find(d => d.id === 'dinh-chieu-lau-thi')?.coordinates).toBeNull();
    expect(destinations.find(d => d.id === 'dong-lung-khuy')?.elevation).toBeNull();
  });
  it('refuses a catalog that drops or contradicts what the place store knows', () => {
    const stored = EXPANDED_DESTINATIONS.find(d => d.slug === 'ban-lo-lo-chai')!;
    // Blanking a coordinate the store still holds is the exact regression this patch undoes.
    expect(() => validateDestinationCatalog([{ ...stored, lat: null, lng: null }])).toThrow(/place store/);
    expect(() => validateDestinationCatalog([{ ...stored, lat: 21.5 }])).toThrow(/place store/);
    expect(() => validateDestinationCatalog([{ ...stored, elevation: 999 }])).toThrow(/place store/);
    expect(() => validateDestinationCatalog([stored])).not.toThrow();
  });
  it('shows an area map without directions when the position is only approximate', () => {
    const approximate = destinations.find(d => d.id === 'ban-lo-lo-chai')!;
    expect(approximate.locationPrecision).toBe('approximate');
    const html = renderToStaticMarkup(createElement(DestinationDetailModal,
      { destination: approximate, onClose() {}, onAskAI() {}, onPlanTripTo() {} }));
    expect(html).toContain('chưa xác minh lối vào');
    expect(html).not.toContain('Chưa có vị trí xác minh');
    expect(html).not.toContain('Mở trong Google Maps để chỉ đường');
  });
  it('states the exact position only for a surveyed one', () => {
    const surveyed = destinations.find(d => d.id === 'deo-ma-pi-leng')!;
    expect(surveyed.locationPrecision).toBe('surveyed');
    const html = renderToStaticMarkup(createElement(DestinationDetailModal,
      { destination: surveyed, onClose() {}, onAskAI() {}, onPlanTripTo() {} }));
    expect(html).toContain('23.241°N');
    expect(html).not.toContain('chưa xác minh lối vào');
  });
  it('drops content that leaked the editorial framing of the research document', () => {
    for (const d of EXPANDED_DESTINATIONS) {
      for (const food of d.localFood) expect(food).not.toMatch(/^Gợi ý/);
      // Split on commas, the later items used to arrive lowercase and the last one ran on.
      for (const highlight of d.highlights) {
        expect(highlight[0]).toBe(highlight[0].toLocaleUpperCase('vi'));
        expect(highlight.endsWith('.')).toBe(false);
      }
    }
  });
  it('does not render GPS, map, or zero distance for unverified places', () => {
    const destination = destinations.find(d => d.id === 'dong-lung-khuy')!;
    const html = renderToStaticMarkup(createElement(DestinationDetailModal, { destination, onClose() {}, onAskAI() {}, onPlanTripTo() {} }));
    expect(html).toContain('Chưa có vị trí xác minh');
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('0 km');
    expect(html).toContain('Nguồn tham khảo');
  });
  it('handles custom database content conservatively and rejects invalid coordinate pairs', () => {
    const unknown = toDestination({ ...rows[0], slug: 'custom-local-place', lat: null, lng: 105, imageUrl: 'https://example.com/unlicensed.jpg' });
    expect(unknown.coordinates).toBeNull();
    expect(unknown.collection).toBe('original');
    expect(unknown.imageMeta.kind).toBe('illustration');
    expect(unknown.sourceLinks).toEqual([]);
  });
  it('labels regional photos using the actual image region, not the destination district', () => {
    // Commons chưa có ảnh nào chụp đúng con dốc, nên Chín Khoanh mượn ảnh đường núi trên quốc lộ
    // 4C — cùng tuyến, cùng huyện, và quan trọng là chủ thể trong ảnh cũng là một con đường đèo.
    const d = WEBSITE_DESTINATIONS.find(d => d.slug === 'doc-chin-khoanh')!;
    expect(d.imageSlug).toBe('duong-hanh-phuc');
    const photos = destinationPhotos(d.slug, [destinationRowData(d).imageUrl]);
    expect(photos[0].kind).toBe('area');
    expect(photos[0].regionLabel).toBe('Con đường Hạnh Phúc (quốc lộ 4C)');
    expect(photos[0].sourcePage).toMatch(/^https:\/\//);
    expect(photos[0].credit).toBeTruthy();
  });
  it('marks a photo taken at the place itself as its own, not as a regional stand-in', () => {
    // Sáu điểm từng mượn ảnh của cả vùng nay đã có ảnh chụp đúng nơi trên Commons.
    for (const slug of ['nui-doi-co-tien', 'rung-thong-yen-minh', 'thac-du-gia', 'doc-tham-ma',
      'dinh-thu-ho-vuong', 'ruong-bac-thang-hoang-su-phi']) {
      const d = WEBSITE_DESTINATIONS.find(x => x.slug === slug)!;
      expect(d.imageSlug).toBe(slug);
      const photos = destinationPhotos(d.slug, [destinationRowData(d).imageUrl]);
      expect(photos[0].kind).toBe('place');
      expect(photos[0].credit).toBeTruthy();
      expect(photos[0].license).toBeTruthy();
    }
  });
  it('never lets an unlicensed photo claim a Creative Commons licence', () => {
    for (const [slug, images] of Object.entries(MANUAL_PLACE_IMAGES)) {
      // Commons is the only source whose licence field is verifiable, so it always wins; a slug
      // sitting in both files means the manual entry should have been deleted.
      expect(COMMONS_IMAGES[slug]).toBeUndefined();
      for (const image of images) {
        expect(image.license).not.toMatch(/^(cc|public domain|pd)\b/i);
        expect(image.credit).toBeTruthy();
        expect(image.sourcePage).toMatch(/^https:\/\//);
        // Only the generator may attest a licence, and only from Commons metadata.
        expect(image.licenseVerified).not.toBe(true);
      }
    }
    for (const images of Object.values(COMMONS_IMAGES)) {
      for (const image of images) expect(image.licenseVerified).toBe(true);
    }
  });
  it('links through to the source only for a photo whose licence was verified', () => {
    const verified = destinationPhotos('deo-ma-pi-leng',
      [destinationRowData(WEBSITE_DESTINATIONS.find(d => d.slug === 'deo-ma-pi-leng')!).imageUrl]);
    expect(verified[0].licenseVerified).toBe(true);
    const unverified = destinationPhotos('bai-da-co-nam-dan',
      [destinationRowData(WEBSITE_DESTINATIONS.find(d => d.slug === 'bai-da-co-nam-dan')!).imageUrl]);
    expect(unverified[0].licenseVerified).toBe(false);
    // Attribution itself is never conditional — only the hyperlink is.
    expect(unverified[0].credit).toBeTruthy();
    expect(unverified[0].license).toBeTruthy();
  });
  it('shows the state-portal photos for the two places Commons has none of', () => {
    for (const slug of ['thac-tien-deo-gio', 'bai-da-co-nam-dan']) {
      const d = WEBSITE_DESTINATIONS.find(x => x.slug === slug)!;
      const photos = destinationPhotos(d.slug, [destinationRowData(d).imageUrl]);
      expect(photos[0].kind).toBe('place');
      expect(photos[0].license).toMatch(/Chưa xác định giấy phép/);
    }
  });
  it('searches accents, case, repeated spaces and aliases', () => {
    for (const query of ['lo lo chai', 'LÔ LÔ CHẢI', '  lo  lo chai  ']) {
      expect(filterDestinations(destinations, { ...all, query }).map(d => d.id)).toEqual(['ban-lo-lo-chai']);
    }
    expect(filterDestinations(destinations, { ...all, query: 'hang lung khuy' }).map(d => d.id)).toEqual(['dong-lung-khuy']);
  });
  it('combines filters, preserves category counts and resets without losing original places', () => {
    expect(filterDestinations(destinations, { ...all, region: 'Quản Bạ' })).toHaveLength(6);
    expect(filterDestinations(destinations, { ...all, region: 'Quản Bạ', category: 'culture' })).toHaveLength(2);
    for (const [category, count] of Object.entries({ pass: 2, nature: 8, culture: 11, viewpoint: 3, waterfall: 2 })) {
      expect(filterDestinations(destinations, { ...all, category })).toHaveLength(count);
    }
    expect(filterDestinations(destinations, { ...all, query: 'no-such-place-xyz' })).toHaveLength(0);
    expect(filterDestinations(destinations, all)).toHaveLength(26);
  });
});
