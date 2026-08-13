# Bariq SEO + GEO + AI Discoverability Report

Date: 2026-08-13

## Scope Completed

This phase implemented safe, crawlable SEO improvements without changing Supabase queries, cart, orders, payment, product CRUD, admin, or bot logic.

## Files Changed

- `index.html`
- `categories.html`
- `product.html`
- `offers.html`
- `robots.txt`
- `sitemap.xml`
- `vercel.json`
- `seo-landing.css`
- `java/seo-entity.js`
- `llms.txt`

## New Public Landing Pages

- `/about-bariq`
- `/gifts`
- `/custom-gifts`
- `/corporate-gifts`
- `/events`
- `/newborn`
- `/graduation`
- `/national-day`
- `/ramadan`
- `/acrylic`
- `/forex`
- `/wood`
- `/leather`
- `/stickers`

## Titles Added

- عن بريق للهدايا والإبداع | Bariq Gifts
- هدايا في الإمارات | بريق للهدايا والإبداع
- هدايا مخصصة في الإمارات | بريق
- هدايا شركات وهدايا دعائية | بريق الإمارات
- تجهيز مناسبات وحفلات وفعاليات | بريق
- هدايا وتجهيزات مواليد في الإمارات | بريق
- هدايا تخرج مخصصة | بريق
- منتجات اليوم الوطني الإماراتي | بريق
- هدايا رمضان ومنتجات رمضانية | بريق
- منتجات أكريليك وهدايا مخصصة | بريق
- منتجات فوركس واستاندات مخصصة | بريق
- منتجات خشب مخصصة | بريق
- منتجات جلد مخصصة | بريق
- استيكر مخصص للمناسبات | بريق

## Meta Descriptions

Each new landing page has a unique description focused on its actual intent and links to real category pages. The offers page description was softened to avoid unsupported claims such as "best" or fixed maximum discount claims.

## Structured Data

Added:

- `LocalBusiness` entity for Bariq using verified business information.
- Phone/WhatsApp: `+971554423151`.
- Email: `bariq.gifts@gmail.com`.
- Locality-level address: Ras Al Khaimah, United Arab Emirates.
- UAE-wide service area.
- Working hours: Saturday to Thursday, 9:00 AM to 7:00 PM; Friday closed.
- Official social profiles via `sameAs`.
- `WebSite` entity with SearchAction.
- `BreadcrumbList` for selected landing pages.
- `WebPage` schema for the custom gifts landing page.

No fake reviews, ratings, street address, founding date, or unsupported guarantees were added.

## Sitemap

`sitemap.xml` now includes the new static landing pages with `lastmod` set to `2026-08-13`.

## Robots.txt

Updated to keep public pages crawlable while blocking admin, bot admin, reports, invoices, checkout, cart, account, and login areas. Added an explicit `OAI-SearchBot` section for public content while keeping private/admin areas blocked.

## Canonical Fixes

Every new landing page has a clean canonical URL. Dynamic category pages remain intact and are linked from static landing pages instead of replacing current product/category behavior.

## Internal Links

The homepage now includes a crawlable Bariq intro section with links to:

- Gifts
- Custom gifts
- Corporate gifts
- Events
- Newborn
- Acrylic
- Forex
- Wood
- Leather
- Stickers

Landing pages also link back to real category filters such as:

- `/categories.html?category=Acrylic`
- `/categories.html?category=Forex`
- `/categories.html?category=Occasions&subcategory=Born-in`
- `/categories.html?category=Ramadan`

## Core Web Vitals Improvements

The new landing pages are static, low-JS, CSS-light pages. They use actual image dimensions and `width`/`height` attributes to reduce layout shift. No heavy third-party scripts were added to them.

## AI Discoverability

Added `llms.txt` as a simple helper file. It states factual information only: contact details, Ras Al Khaimah location, UAE service area, working hours, official social profiles, factory/customization context, ordering process, and public page list. It explicitly notes that product availability, pricing, and customization details should be verified on current pages.

## Search Console Tasks

Manual tasks still required:

- Submit updated `sitemap.xml`.
- Inspect the new URLs with URL Inspection.
- Check duplicate canonical reports after Google recrawls.
- Monitor indexed products and category landing pages.
- Review Search Console crawl errors after deployment.

## Google Business Profile Tasks

Manual tasks still required:

- Create or verify Google Business Profile if eligible.
- Keep name, phone, website, Ras Al Khaimah locality, UAE service area, working hours, and social profiles consistent.
- Add real photos and real customer reviews only.

## External Authority Tasks

Manual tasks still required:

- Bing Places listing if eligible.
- Official social profiles with consistent brand information:
  - https://www.instagram.com/bariq.gifts/
  - https://www.facebook.com/bariq.gifts
- Real UAE business citations where appropriate.
- Supplier/partner/event mentions when truthful.
- No spam backlinks and no purchased low-quality links.

## Before / After Technical Audit

Before:

- Public pages existed but SEO depended heavily on dynamic category/product behavior.
- Sitemap did not include static service/material landing pages.
- Robots blocked private areas but did not explicitly document AI search crawler handling.
- No `llms.txt`.
- Offers description contained unsupported marketing wording.

After:

- Static landing pages exist for major commercial, occasion, and material intents.
- Sitemap includes the landing pages.
- Robots keeps private areas blocked and allows public pages.
- LocalBusiness/WebSite structured data is available from a shared SEO script and the about page.
- Homepage has crawlable text and internal links.
- No black-hat SEO, hidden text, fake reviews, or invented business data were added.

## Not Implemented In Code

- Google Business Profile setup.
- Bing Places setup.
- Real customer review collection.
- External backlinks/citations.
- Case studies based on real projects with specific names/photos/details.
