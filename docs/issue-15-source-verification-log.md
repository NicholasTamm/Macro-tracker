# Issue #15 — Primary-source verification log (Expo reconciliation)

**Reconciled:** 2026-09-29 PT  
**Status:** Submitted as a GitHub PR for review; not merged. Awaiting Nicholas approval — do not merge without explicit approval. Demo smoke: `docs/demo/smoke-source-log.sh`.  
**Shipping stack:** Expo + React Native + TypeScript under `software/`.  
**Source issue:** [NicholasTamm/Macro-tracker #15](https://github.com/NicholasTamm/Macro-tracker/issues/15)  
**Research OUT (Swift-era framing, superseded for implementation):** `/workspace/macrofactor-codex-research/OUT/source-log.md`  
**Access date for every source in the tables below:** 2026-09-23  
**Not legal or medical advice.** Contract terms and license application should be reviewed by counsel before TestFlight / Play internal testing.

## Supersession notice

The research OUT and original GitHub issue #15 body are a **primary-source verification log**. Claim statuses (**VERIFIED** / **PARTIALLY VERIFIED** / **UNVERIFIED**) and first-party URLs remain binding. What is **superseded** is any implication that Macro-tracker ships as a SwiftUI / StoreKit-only / CloudKit / HealthKit-only / watchOS client.

| Research-era implication | Expo / RN decision |
| --- | --- |
| Compete / ship only on App Store (US/CA IAP sheets) | Ship **iOS + Android**. Competitor App Store prices stay competitive context only. Our own SKUs must be verified on **App Store Connect and Google Play Console** (store-localized; never hard-code competitor prices as policy — see [#14](./issue-14-freemium-matrix.md)). |
| HealthKit-only integration evidence | Platform-neutral health interface: iOS HealthKit + Android Health Connect adapters (`software/modules/health-sync/`). |
| Apple Watch / Lock Screen widgets as required parity | Optional post-M3 surfaces behind feature flags; not M1 blockers ([#13](./issue-13-mvp-backlog.md)). |
| SwiftData / CloudKit storage of food or user data | Read-only `FoodSeed.sqlite` + mutable `UserData.sqlite` via **expo-sqlite** ([#12](./issue-12-food-schema-seed-contract.md)). No CloudKit as system of record. |
| On-device FatSecret / Edamam secrets | Remote paid/restricted providers go through a **server proxy**; secrets never ship in the Expo binary. |
| Pure-Swift EWMA / TDEE from public papers | Pure **TypeScript** `TransparentTrend v1` estimator with deterministic fixtures (`software/modules/coaching/`). |
| Attribution only in iOS Settings / App Store text | About / Data Sources screens in Expo + store listing text on **both** App Store and Google Play; preserve source URL + license in build metadata. |

**Pointers**

- Food schema / seed (#12): [`docs/issue-12-food-schema-seed-contract.md`](./issue-12-food-schema-seed-contract.md)
- MVP backlog (#13): [`docs/issue-13-mvp-backlog.md`](./issue-13-mvp-backlog.md) (merged)
- Freemium matrix (#14): [`docs/issue-14-freemium-matrix.md`](./issue-14-freemium-matrix.md) (merged)
- Rollout checklist: [`software/ROLLOUT-STATUS.md`](../software/ROLLOUT-STATUS.md)
- Design system (RN): [`software/design-system/`](../software/design-system/)

**Hard exclusions (unchanged):** No MacroFactor trademarks, assets, copy, private APIs, food data, or Expenditure V3 reverse engineering. No MacroFactor private API access, binary analysis, or proprietary database inspection was performed for this log.

---

## Status key

- **VERIFIED** — the cited first-party source directly supports the stated claim.
- **PARTIALLY VERIFIED** — the source supports only part of the claim, or the public page exposes ambiguity that cannot be resolved without a purchase flow, account, or contract.
- **UNVERIFIED** — no accessible public first-party source established the claim as of the access date. The row states a concrete confirmation path.

---

## Expo implementation implications (from verified sources)

These rows translate the verification tables into stack decisions for Macro-tracker. They do **not** change claim status.

| Topic | Verified takeaway | Expo / M1–M3 implication |
| --- | --- | --- |
| Free-first catalog | USDA FDC Foundation + SR Legacy are CC0 / public domain; downloads are sized for a curated local seed | Bundle curated `FoodSeed.sqlite` via expo-sqlite; cite USDA in About/Data Sources; do not bundle full Branded/FNDDS |
| Barcode / branded | Open Food Facts is ODbL; rate limits 15 product / 10 search req/min/IP; bulk via CSV/JSONL | Remote OFF adapter with custom User-Agent, fair-use throttle, no durable merge into FoodSeed without ODbL counsel sign-off |
| Optional FatSecret | Basic free US-only, no barcode; Premier features include barcode; only IDs storable >24h; attribution required | Optional server-proxied remote; never seed nutrients into FoodSeed; attribution surfaces in UI + both store listings |
| Edamam / Spoonacular / Nutritionix | Tight cache / scraping bans; Nutritionix commercial price **UNVERIFIED** | Not foundations for a shared catalog; any use is provider-adapter + counsel + written quote |
| CNF / Ciqual | CNF 2026 Open Government Licence – Canada; Ciqual 2025 Licence Ouverte | Locale packs later; prefer downloads over high-volume API; attribution wording required |
| Adaptive coaching math | NIST EWMA + Hall metabolism papers are public bases; CDC/NHLBI are population guidance | `TransparentTrend v1` in TypeScript; calorie floors need clinical review (#21); never claim MacroFactor V3 compatibility |
| Competitor pricing | MacroFactor public US$11.99 / 47.99 / 71.99 and CA list amounts are competitive context | **Never** paste into our paywall. Our products: store-localized StoreKit + Play Billing at M3 |
| Health platforms | MacroFactor documents Apple Health / Health Connect sync | Our health module mirrors that dual-platform shape; coaching never consumes wearable EE as ground truth |

---

## 1. MacroFactor product, trial, and storefront pricing

Competitive context only. Do not copy prices, copy, assets, or private behavior into Macro-tracker.

| URL | Publisher | Claims supported | Status |
| --- | --- | --- | --- |
| [MacroFactor product page and FAQ](https://macrofactor.com/macrofactor/) | MacroFactor / Stronger By Science Technologies LLC | Premium-only; no permanent free version; seven-day free trial; public US prices of **US$11.99 monthly**, **US$47.99 every six months**, and **US$71.99 annually**. Also inventories barcode, label scanning, custom foods/recipes, copy/paste, speech-to-text, macro and micronutrient tracking, three program modes, weekly adjustments, weight trend, integrations, widgets, measurements/photos, period/step/habit tracking, privacy, and export. | **VERIFIED** for the public US price/trial/no-free-tier statements and the listed feature set. The exact post-expiry screen behavior (“locked”) is **UNVERIFIED**; confirm with an expired trial account or written support response. |
| [US App Store listing](https://apps.apple.com/us/app/macrofactor-macro-tracker/id1553503471) | Apple, using developer-supplied listing data | Seven-day trial; no free subscription tier; developer description lists US$11.99/month, US$47.99/half-year, US$71.99/year. Apple’s IAP section visibly includes those prices, plus duplicate and older entries such as US$9.99 monthly. | **VERIFIED** that the current public listing advertises the three stated US prices. **PARTIALLY VERIFIED** as an exact SKU inventory because Apple exposes display names/prices but not product identifiers or active/retired state. Confirm exact purchasable product IDs and introductory-offer eligibility in App Store Connect or a fresh US storefront purchase sheet. |
| [Canada App Store listing](https://apps.apple.com/ca/app/macrofactor-macro-tracker/id1553503471) | Apple, using developer-supplied listing data | Canadian storefront IAP list visibly includes **CA$15.49 monthly**, **CA$59.99 semiannual**, and **CA$90.99 annual** entries. It also lists legacy/duplicate entries, including CA$14.99 and CA$12.49 monthly and CA$73.99/CA$90.99/CA$119.99 annual entries. | **PARTIALLY VERIFIED**. The visible IAP list supports the CA-dollar amounts, but it does not identify active versus legacy SKUs; the developer description itself still quotes US prices. Treat CA$15.49/59.99/90.99 as the likely current trio, not a checkout guarantee. Confirm with a fresh Canadian Apple ID purchase sheet or App Store Connect territory pricing. |
| [Stronger By Science MacroFactor page](https://www.strongerbyscience.com/macrofactor/) | Stronger By Science / MacroFactor | Seven-day trial, premium-only positioning, no free version, public US subscription prices, broad logging/coaching/analytics/tracking feature inventory, and public high-level energy-expenditure explanation. | **VERIFIED**. |
| [AI Food Logging](https://help.macrofactorapp.com/en/articles/258-ai-food-logging) | MacroFactor Help Center | Photo, photo-plus-text, and uploaded-image AI flows populate an editable Plate before logging. | **VERIFIED**. |
| [MacroFactor Nutrition help collection](https://help.macrofactorapp.com/en/collections/18-macrofactor-nutrition) | MacroFactor Help Center | Public index confirms documented surfaces for dashboard, expenditure, weight trend, food logging, label scanning, recipes/custom foods, check-ins, integrations, export, widgets, Watch, and account/subscription management. | **VERIFIED** as a public feature index; individual behavior should be cited to its article where material. |
| [Connect Apple Health / Health Connect](https://help.macrofactorapp.com/en/articles/65-connect-health-connect-or-apple-health) | MacroFactor Help Center | Health-platform integration; up to 30 days of historical entries are pulled, followed by ongoing synchronization. | **VERIFIED**. |
| [Export Your Data](https://help.macrofactorapp.com/en/articles/68-export-your-data) | MacroFactor Help Center | Granular spreadsheet export and Quick Export covering expenditure, weight trend, scale weight, calories, macros, and primary nutrition targets. | **VERIFIED**. |
| [iPhone Widgets](https://help.macrofactorapp.com/en/articles/211-iphone-widgets) and [widgets announcement](https://macrofactor.com/widgets-announcement/) | MacroFactor | Home- and Lock-Screen widgets; configurable quick actions and nutrient views. | **VERIFIED**. |
| [Apple Watch announcement](https://macrofactor.com/apple-watch/) | MacroFactor | Watch timeline logging, voice/AI logging, library items, serving editing, nutrition overview, weight/trend view, and complications. | **VERIFIED**. |
| [Introduction to Check-Ins and Coaching Modules](https://help.macrofactorapp.com/en/articles/247-introduction-to-check-ins-and-coaching-modules) | MacroFactor Help Center | Weekly user-selected check-in day; algorithm review; suggested calorie/macro target changes; optional decline; coaching modules and Fast Check-In. | **VERIFIED**. |
| [Expenditure](https://help.macrofactorapp.com/dashboard/expenditure), [Weight Trend](https://help.macrofactorapp.com/dashboard/weight_trend), and [Change Rate](https://help.macrofactorapp.com/en/articles/19-change-rate) | MacroFactor Help Center | Public description only: expenditure is deterministically estimated from logged energy intake and change in trend weight; stored-energy change accounts for differing fat/lean energy density; trend weight is a recency-weighted moving average; change rate uses changes in trend weight over the preceding 20 days. | **VERIFIED** as competitive-context descriptions. These sources do **not** disclose V3 implementation details and must not be used to claim algorithmic compatibility. |

---

## 2. USDA FoodData Central

| URL | Publisher | Claims supported | Status |
| --- | --- | --- | --- |
| [FoodData Central API Guide](https://fdc.nal.usda.gov/api-guide/) | USDA Agricultural Research Service | API requires a data.gov key; default limit **1,000 requests/hour/IP**; exceeding it returns HTTP 429 and temporarily blocks the key for one hour; `DEMO_KEY` is 30/hour and 50/day; rate headers are documented. Data are public domain and published under CC0; permission is not required, while attribution is requested. | **VERIFIED**. |
| [FoodData Central home/licensing notice](https://fdc.nal.usda.gov/) | USDA Agricultural Research Service | FDC data are public domain, not copyrighted, and published under CC0 1.0; commercial and redistribution use therefore do not require permission. USDA requests source attribution and supplies a citation. | **VERIFIED**. |
| [CC0 1.0 deed](https://creativecommons.org/publicdomain/zero/1.0/) | Creative Commons | CC0 permits copying, modification, distribution, and commercial use without permission, subject to rights outside copyright and no implied endorsement. | **VERIFIED** for the license terms; FDC’s own page establishes that FDC applies CC0. |
| [Downloadable Data](https://fdc.nal.usda.gov/download-datasets/) | USDA Agricultural Research Service | Public CSV/JSON downloads exist. April 2026 sizes shown: Foundation CSV 3.7 MB zipped/32 MB unzipped; SR Legacy CSV 6.7 MB/54 MB; FNDDS 2021–2023 CSV 200 MB/1.6 GB; Branded CSV 428 MB/2.9 GB; full CSV 460 MB/3.1 GB. SR Legacy is final 2018; Foundation and branded files are downloadable. | **VERIFIED**. This supports a curated local Foundation + SR Legacy seed and argues against bundling the full Branded/FNDDS sets. |
| [FDC FAQ](https://fdc.nal.usda.gov/faq/) | USDA Agricultural Research Service | Foundation, SR Legacy, FNDDS, and Branded data types can be downloaded separately in CSV and JSON; the API is intended for applications/websites. | **VERIFIED**. |
| [FDC data documentation](https://fdc.nal.usda.gov/data-documentation/) | USDA Agricultural Research Service | Defines Foundation, FNDDS, Branded, and SR Legacy provenance and update cadence; Foundation is analytical, Branded is manufacturer label data, SR Legacy is frozen. | **VERIFIED**. |

---

## 3. Open Food Facts

| URL | Publisher | Claims supported | Status |
| --- | --- | --- | --- |
| [Open Food Facts API introduction](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/) | Open Food Facts | Database is ODbL; individual contents use the Database Contents License; images are CC BY-SA and may contain other protected elements. Current documented limits are **15 requests/minute/IP for product reads** and **10 requests/minute/IP for search**; HTTP 503 may be used for global limits; mobile requests are limited per user. More than a few hundred products should use CSV/JSONL exports. Reads need a custom `User-Agent`; writes require authentication. API v3 is current/recommended; v2 is deprecated but supports structured search. | **VERIFIED**. Note that earlier research’s “nightly” wording was not directly confirmed on the accessible 2026 page; confirm export cadence on the live data page before promising a refresh SLA. |
| [Open Food Facts data exports](https://world.openfoodfacts.org/data) | Open Food Facts | Canonical first-party location for bulk exports. The API documentation links here for CSV/JSONL bulk acquisition. | **PARTIALLY VERIFIED** because the page itself was not machine-readable in this environment; file formats and bulk-use recommendation are directly confirmed by the official API docs. Confirm exact formats, sizes, and refresh cadence immediately before building the importer. |
| [Open Food Facts terms of use/reuse](https://world.openfoodfacts.org/terms-of-use) | Open Food Facts | Canonical first-party terms page linked by official API docs. | **PARTIALLY VERIFIED** because robots controls prevented direct retrieval here. The license family is confirmed by the API docs. Human legal review must read the live terms before shipping. |
| [ODbL 1.0 full text](https://opendatacommons.org/licenses/odbl/1-0/) | Open Data Commons / Open Knowledge Foundation | Commercial use is permitted; public use of a Produced Work requires notice; publicly used Derivative Databases are share-alike; extraction or reuse of all or a substantial part into a new database is a Derivative Database; a machine-readable derivative or alteration file may need to be offered. | **VERIFIED** for the license text. Whether a particular app cache, merged catalog, or bundled subset is a Derivative Database is **UNVERIFIED legal interpretation**; obtain counsel’s written analysis of the planned schema/distribution. |

---

## 4. FatSecret Platform API

| URL | Publisher | Claims supported | Status |
| --- | --- | --- | --- |
| [API editions and pricing](https://platform.fatsecret.com/api-editions) | fatsecret Platform | Basic is free/self-sign-up, **5,000 calls/day**, US-only; Premier Free is free after verification, unlimited, US-only; paid Premier is quote-based, unlimited, and offers 62+ country datasets. Basic and Premier Free require attribution; paid Premier is white label. Premier Free eligibility includes startups with both annual revenue and funding below US$1M, nonprofits, and students/student research groups. Barcode, autocomplete, and caching are Premier features, not Basic. | **VERIFIED**. Premier Free access remains application/verification dependent; eligibility does not guarantee approval. |
| [Storable Data](https://platform.fatsecret.com/docs/guides/storable-data) | fatsecret Platform | Only enumerated identifiers/tokens—including `food_id` and `serving_id`—are storable indefinitely; all other information may not be cached for more than 24 hours and generally must be requested again. | **VERIFIED**. This rules out a durable FatSecret nutrient seed under the public terms. |
| [Attribution Policy](https://platform.fatsecret.com/attribution) | fatsecret Platform | Attribution is required wherever content is displayed, on an unauthenticated surface if login is required, in the App Store/Google Play description using the specified phrase, and on the app website. | **VERIFIED** for attribution-required editions. |
| [OAuth 2.0 guide](https://platform.fatsecret.com/docs/guides/authentication/oauth2) | fatsecret Platform | OAuth 2.0 uses client credentials; token requests must go through a proxy/server so secrets stay off devices; token-source IPs must be registered (CIDR ranges available to Premier/Premier Free). Barcode and localization are scopes. | **VERIFIED**. |
| [Platform home](https://platform.fatsecret.com/) and [terms](https://platform.fatsecret.com/terms) | fatsecret Platform | Public site states free commercial use is permitted; terms require attribution and impose use restrictions. | **VERIFIED** at the public-summary level. A production launch still requires accepting the then-current account-specific terms. |

---

## 5. Edamam, Spoonacular, and Nutritionix

| URL | Publisher | Claims supported | Status |
| --- | --- | --- | --- |
| [Edamam Food Database API](https://developer.edamam.com/food-database-api) | Edamam | Current public plans: **US$14/month Enterprise Basic** (100,000 calls/month, 50/min food/UPC, 50/day Vision, 30-day trial), **US$69/month Core** (750,000/month), **US$299/month Plus** (5M/month), and custom Unlimited. Basic caching is only FoodId/label; Core/Plus add protein, net carbs, total fat, and kcal. Cached data are for the end user’s password-protected account, cannot recreate a food search/database, and require an active eligible subscription. All plans require attribution and only human/end-user-driven calls; automated collection/scraping is prohibited. | **VERIFIED**. This corrects vague prior pricing: the public 2026 Food Database starting price is US$14/month, not a commercial free tier. |
| [Edamam API sign-up terms](https://developer.edamam.com/signup) and [API terms](https://www.edamam.com/terms/api/) | Edamam | Free API use is intended for personal/not-for-profit use; commercial or business-oriented use requires express authorization. | **VERIFIED**. |
| [Edamam FAQ](https://developer.edamam.com/api/faq) | Edamam | Cache permissions are plan-specific; after cancellation, Edamam nutritional information can no longer be used and must be returned/removed; attribution uses a “powered by” logo/link. | **VERIFIED**. |
| [Spoonacular pricing](https://spoonacular.com/food-api/pricing) | Spoonacular | Free: **US$0, 50 points/day**, then no calls, 1 request/second, 2 concurrent, backlink required. Cook US$29/month/1,500 points/day; Culinarian US$79/4,500; Chef US$149/10,000; Enterprise starts at US$300. Free exhaustion returns 402; quotas reset at midnight UTC. FAQ says user-requested caching is at most one hour. | **VERIFIED** as of access date. |
| [Spoonacular terms](https://spoonacular.com/food-api/terms) | Spoonacular | No scraping/copying/storing. With prior written permission, user-requested data may be cached for at most one hour, then deleted/refetched. On termination/suspension, obtained data must be deleted. Only recipe ID/title/image URL are indefinitely storable; ingredients, instructions, and nutrition are not. No resale or competing Spoonacular-like experience. Terms state last updated 2026-04-16. | **VERIFIED**. The pricing FAQ’s simplified cache wording should be read together with the terms’ “prior written permission” requirement. |
| [Nutritionix public API page](https://www.nutritionix.com/api) | Nutritionix / Syndigo | Previously reported plan prices (including “Starter US$499/month”) could not be retrieved from the first-party page in this environment; the endpoint returned HTTP 402. | **UNVERIFIED**. Do not budget or contract from the prior snapshot. Confirm in the authenticated Nutritionix/Syndigo plan selector and obtain a dated written sales quote covering MAU, overages, attribution, barcode/NLP rights, and cache/bulk-data add-ons. |
| [Nutritionix FAQ](https://docx.syndigo.com/developers/docs/faqs) | Syndigo / Nutritionix | Pre-approved caching is limited to a specific user’s historical food-log transaction. Data requested by one user cannot be served to another or cached to avoid per-user lookup; other caching requires a Premium Add-On discussion. | **VERIFIED**. This prevents a shared local/remote Nutritionix lookup cache under the default public terms. |
| [Nutritionix API documentation hub](https://docx.syndigo.com/developers) and [instant search endpoint](https://docx.syndigo.com/developers/docs/instant-endpoint) | Syndigo / Nutritionix | API uses branded/common search flows; official docs recommend at least 300 ms debounce and three typed characters before instant-search requests. | **VERIFIED** for API behavior, not commercial pricing. |

---

## 6. Canadian Nutrient File and ANSES-Ciqual

| URL | Publisher | Claims supported | Status |
| --- | --- | --- | --- |
| [Canadian Nutrient File 2026 dataset](https://open.canada.ca/data/en/dataset/1b6139bd-ed7e-4043-bc28-ff00e10f3109) | Health Canada / Government of Canada | CNF is Canada’s standard reference food-composition database; the 2026 release provides downloadable CSVs and an all-files ZIP; the portal assigns the **Open Government Licence – Canada**. | **VERIFIED**. This supersedes the prior research’s reliance on the 2015 dataset for a new locale pack. |
| [CNF API Guide](https://produits-sante.canada.ca/api/documentation/cnf-documentation-en.html) | Health Canada | Public JSON/XML API exists at the documented base URI and exposes CNF food/nutrient resources. | **VERIFIED**. No API rate limit was found in the public guide; any asserted limit is **UNVERIFIED**. Confirm with Health Canada before depending on high-volume remote calls; prefer the 2026 download for a local pack. |
| [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada) | Government of Canada | Canonical license governing the CNF portal record. The dataset metadata explicitly names this license. | **PARTIALLY VERIFIED** because the license page returned HTTP 403 to this research environment. Before distribution, counsel should read the live text and implement its source-attribution/non-endorsement requirements. |
| [Anses-Ciqual 2025 documentation (English)](https://ciqual.anses.fr/cms/sites/default/files/inline-files/Table%20Ciqual%202025%20doc%20ENG_2025_11_19.pdf) and [French text](https://ciqual.anses.fr/cms/sites/default/files/inline-files/Table%20Ciqual%202025%20doc%20FR_2025_11_19.pdf) | ANSES | Ciqual 2025 data are publicly and freely downloadable. Reuse is under France’s **Licence Ouverte/Open Licence**; required source wording is “Anses. 2025. Table de composition nutritionnelle des aliments Ciqual”; reuse must not distort meaning and should state source/version. | **VERIFIED**. |
| [Licence Ouverte 2.0](https://www.data.gouv.fr/datasets/licence-ouverte-2-0) | French government / data.gouv.fr | Open Licence 2.0 permits reproduction, redistribution, adaptation, and commercial exploitation, while requiring source attribution. | **VERIFIED** for the license terms; Ciqual’s own 2025 documentation establishes applicability. |

---

## 7. Primary/authoritative sources for an original adaptive algorithm

These sources support an independently documented **TypeScript** implementation (`TransparentTrend v1`). They do not disclose or validate MacroFactor Expenditure V3.

| URL | Publisher | Claims supported and permissible design use | Status |
| --- | --- | --- | --- |
| [NIST EWMA](https://www.itl.nist.gov/div898/handbook/pmc/section3/pmc324.htm) and [single exponential smoothing](https://www.itl.nist.gov/div898/handbook/pmc/section4/pmc431.htm) | U.S. National Institute of Standards and Technology | Defines exponentially weighted moving average / single exponential smoothing: recent observations get greater weight and the smoothing factor controls memory. Suitable public mathematical basis for an original trend-weight smoother. | **VERIFIED**. Choice of alpha, gap handling, outlier handling, and initialization remain product design decisions that must be documented and tested. |
| [Hall et al., “Quantification of the effect of energy imbalance on bodyweight”](https://pubmed.ncbi.nlm.nih.gov/21872751/) (PMID 21872751; DOI 10.1016/S0140-6736(11)60812-X) | The Lancet; record hosted by U.S. National Library of Medicine | Validated dynamic human-metabolism model; weight response to intake change is slow and depends on adiposity, opposing a simplistic fixed-calories-per-pound assumption. Supports using a damped, uncertainty-aware estimator rather than a fixed 3,500-kcal rule as ground truth. | **VERIFIED** primary research. Implementing the published model exactly may require reading the full paper/supplement and checking code/license terms. |
| [Hall, “Predicting metabolic adaptation, body weight change, and energy intake in humans”](https://pubmed.ncbi.nlm.nih.gov/19934407/) (PMID 19934407; DOI 10.1152/ajpendo.00559.2009) | American Journal of Physiology; record hosted by U.S. National Library of Medicine | A validated computational model accounts for carbohydrate, fat, and protein metabolism, body composition, and adaptive expenditure. Supports the proposition that stored-energy conversion is composition- and time-dependent. | **VERIFIED** primary research. It does not justify copying MacroFactor’s implementation. |
| [CDC: Steps for Losing Weight](https://www.cdc.gov/healthy-weight-growth/losing-weight/index.html) | U.S. Centers for Disease Control and Prevention | Public-health guidance describes gradual loss of about **1–2 lb/week** as more sustainable than faster loss and advises clinical consultation where appropriate. | **VERIFIED** authoritative guidance. It is not an individualized prescription and should be converted to configurable guardrails with clinician override, not a universal promise. |
| [NHLBI 2013 obesity evidence review](https://www.nhlbi.nih.gov/sites/default/files/media/docs/obesity-evidence-review.pdf) | U.S. National Heart, Lung, and Blood Institute | Evidence review describes common trial prescriptions of 1,200–1,500 kcal/day for women and 1,500–1,800 kcal/day for men, adjusted for body weight, and common 500–1,000 kcal/day deficits associated with roughly 1–2 lb/week loss. | **VERIFIED** authoritative evidence review. These are population-level ranges, not safe universal floors. A shipping app should require age, pregnancy/lactation, eating-disorder, and medical-risk exclusions and route low targets to a clinician. |
| [Current U.S. Dietary Guidelines landing page](https://odphp.health.gov/our-work/nutrition-physical-activity/dietary-guidelines) and [Dietary Reference Intakes](https://odphp.health.gov/our-work/nutrition-physical-activity/dietary-guidelines/dietary-reference-intakes) | U.S. HHS/USDA Office of Disease Prevention and Health Promotion | Current federal nutrition guidance and DRI framework; DRIs include EAR, RDA, AI, UL, CDRR, AMDR, and EER concepts. | **VERIFIED** as authoritative guardrail context. Exact calorie floors for this app remain **UNVERIFIED as a product rule**; obtain a registered-dietitian/medical safety review and document excluded populations before release. |

---

## 8. Explicit unresolved claims and confirmation paths

| Claim | Status | Confirmation path |
| --- | --- | --- |
| MacroFactor post-trial app is fully “locked,” with no read-only/export access | **UNVERIFIED** | Let a clean test account expire without subscribing and record accessible screens, or request a written answer from MacroFactor support. Public pages prove no free tier, not every post-expiry behavior. |
| Exact active MacroFactor product IDs/SKUs and offer eligibility in US and Canada | **UNVERIFIED** | Inspect App Store Connect if authorized, or capture fresh purchase sheets using new US and Canadian Apple IDs. Public App Store pages expose duplicate/legacy display-name entries and no product IDs. |
| CA current checkout prices are exactly CA$15.49 / CA$59.99 / CA$90.99 | **PARTIALLY VERIFIED** | These amounts appear in the Canadian IAP list and form the likely current trio, but only a fresh CA purchase sheet/App Store Connect can distinguish them from retained legacy SKUs. |
| Open Food Facts export is specifically “nightly” and includes every previously listed format | **UNVERIFIED** | Check the live official data/export page and export metadata immediately before importer implementation; the accessible API docs confirm CSV/JSONL bulk export, not the promised cadence. |
| A bundled or merged OFF subset in the proposed schema is outside ODbL share-alike | **UNVERIFIED — LEGAL** | Give counsel the exact extraction threshold, schema, merge rules, binary distribution method, and public download/alteration-file plan; obtain written classification under ODbL sections 4.3–4.6. |
| FatSecret Premier Free approval | **UNVERIFIED** | Apply with current revenue/funding documentation. Public eligibility criteria do not guarantee approval. |
| Nutritionix current commercial prices, MAU limits, attribution, rate limits, and add-on costs | **UNVERIFIED** | Obtain a dated first-party proposal or authenticated plan-page capture from Syndigo/Nutritionix. Do not rely on the earlier US$499/month snapshot. |
| CNF public API rate limit | **UNVERIFIED** | Ask Health Canada at the dataset contact address and load-test only with written permission; use the downloadable 2026 files for bulk/local use. |
| A universal calorie floor or safe percent-body-weight/week rule for all adults | **UNVERIFIED / unsafe as stated** | Have a registered dietitian and medical reviewer define adult-only guardrails, contraindications, clinician override, and jurisdictional copy. Use CDC/NHLBI ranges as context, not individualized medical advice. |
| Our own App Store **and** Google Play SKU/price/trial sheets for Macro-tracker premium | **UNVERIFIED** (Expo cross-platform gap vs research-era App-Store-only framing) | Configure mirrored `premium.monthly` / `premium.annual` in App Store Connect and Play Console; capture fresh purchase sheets per territory before marketing copy. Never use MacroFactor prices as ours. |

---

## Bottom line for Expo implementation

- The free-first core remains supported: **USDA Foundation + SR Legacy local** (`FoodSeed.sqlite` / expo-sqlite), **Open Food Facts remote barcode/branded**, with attribution and ODbL legal review (#20).
- FatSecret is viable only as an optional **server-proxied** remote source under its attribution and 24-hour/ID-only storage rules; Basic does not include barcode. Secrets stay off the Expo binary.
- Edamam and Spoonacular are poor foundations for a durable shared food catalog because their current public terms tightly restrict caching and automated collection.
- Nutritionix commercial pricing must be treated as **UNVERIFIED** until a first-party quote is obtained; its public cache rule still prohibits a shared lookup cache.
- An original adaptive system can safely start from documented EWMA smoothing and a conservative, damped energy-balance estimator in **TypeScript** (`TransparentTrend v1`), but calorie/rate floors require explicit clinical review (#21) and exclusion rules.
- IAP / paywall enforcement is **M3**, cross-platform (StoreKit + Play Billing), store-localized prices only ([#14](./issue-14-freemium-matrix.md)). Competitor prices in §1 are context, not product policy.
- Health, barcode, OCR, and widgets use platform-neutral interfaces + Expo-compatible adapters; Watch / rich widgets are post-M3 optional.
