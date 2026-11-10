<USER_REQUEST>
# TailorBird – Fix, Cleanup and Core Feature Implementation

You are a senior full-stack engineer, recommender-systems engineer and QA lead working on the EXISTING TailorBird repository. Keep the current stack and architecture. Do not rewrite from scratch.

## 0. Working rules
- First verify the repo yourself. Do not assume anything was built because it was discussed earlier. [PASTE AUDIT REPORT HERE IF AVAILABLE; otherwise re-run a quick audit of: auth, onboarding, wardrobe upload/review, Daily Fit, Home, Calendar, Planner, Insights, Wardrobe Gap, Settings.]
- All DB changes must be additive migrations (new columns/tables, defaults, backfill). Never drop user data or tables.
- No dummy, mock or fabricated data anywhere (products, prices, trends, weather, outfits). If data or an external source is unavailable, show an honest empty/blocked state.
- Every user-scoped query must filter by authenticated user_id (ownership checks on all endpoints).
- Work in phases (Section 7). After each phase: run build, typecheck, lint and tests, then report what changed, what was verified and what is still open.
- Clearly separate verified facts from assumptions.

## 1. Features NOT required (remove from UI, disable routes, keep data)
- Community, Explore, Messages, standalone Saved page: remove from navigation and frontend routes. Put them behind a disabled feature flag on the backend. DO NOT drop tables or delete user data. Saved outfits remain accessible from Daily Fit ("Saved outfits" tab) and Profile.
- Any mock/placeholder data, hardcoded shopping products, fake trends, fake prices, unused demo pages and dead components (list them in the report before deleting).
- Defer (hide behind flags, do not build now): Trending clothing discovery, product comparison, "Before You Buy", social sharing.

Final primary navigation: Home, Daily Fit, My Wardrobe, Calendar, Weekly Planner, Wardrobe Insights, Wardrobe Gap, Notifications, Profile, Settings.
Keep the 24-hour Moments section on Home as secondary content.

## 2. Fix first (P0 – correctness and data integrity)
Verify and repair each flow end-to-end (UI -> API -> service -> DB -> UI, survives refresh):
1. Upload (single/batch) -> original image in BYTEA -> EfficientNet-B0 prediction -> Pending Review -> edit attributes -> accept -> appears in wardrobe. Only ACCEPTED items may be used by recommendations, Insights and Gap analysis.
2. Auth, protected routes, multi-user isolation, ownership checks on every endpoint.
3. Onboarding/profile -> saved -> fully editable in Profile -> actually consumed by the recommender.
4. Remove duplicate API calls (e.g. Home and Daily Fit fetching recommendations separately). Use one shared recommendation source.
5. Loading, empty and error states on every page.
6. Fix every confirmed bug from the audit (list file + line, fix, add a regression test).

## 3. Laundry and wear tracking (NEW, required)

### 3.1 Rules
- Each clothing item has a wear count since last wash. Default: an item can be worn **2 times**, then it goes to laundry and is **unavailable for 4 days**, then it returns as clean (wear count reset to 0).
- Exact day rule: if the item reaches its wear limit on date D and wash_days = N, it is unavailable on D+1 ... D+N and available from D+N+1. Example: worn Mon (2nd wear), N=4 -> unavailable Tue-Fri, available Sat. Add a unit test for this.
- All values are editable in Settings (see 3.4). Resolution order: item override > category override > global default.
- Non-launderable categories (footwear, bags, belts, watches, jewellery, sunglasses) default to "not tracked for laundry" (editable). They may still get a soft rest-day penalty so the same shoes are not recommended daily.
- Wearing an outfit twice on the same day must not double-count. One wear per (user, item, date).
- A wear can be undone (decrement count, remove log entry, revert laundry state if it was triggered by that wear).
- Manual actions on an item: "Mark as washed now" (resets count, status clean), "Send to laundry now", "Mark unavailable" (dry clean, lent, damaged) with optional return date.

### 3.2 Data model (additive)
- clothing_items: wear_count_since_wash int default 0, last_worn_on date, laundry_status enum(clean, in_laundry, unavailable) default clean, laundry_started_on date, available_from date, max_wears_override int null, wash_days_override int null, track_laundry bool default true.
- wear_log (immutable history): id, user_id, item_id, outfit_id null, worn_on date, source (daily_fit | planner | manual), created_at, undone_at null.
- user_laundry_settings: user_id, default_max_wears (default 2), default_wash_days (default 4), category_overrides JSON {category: {max_wears, wash_days, track_laundry}}, same_item_cooldown_days (default 1, soft), auto_return_from_laundry bool (default true).
- Validation: max_wears 1-30, wash_days 0-14. Use the user's timezone for all date boundaries.

### 3.3 Single source of truth
Implement ONE function: is_available(item, target_date, settings) used by the recommender, Weekly Planner, wardrobe UI and Insights. It is evaluated for the TARGET date, not only today. If auto_return is on and target_date >= available_from, the item is treated as clean (lazily reset in a transaction when it is read for today). No cron dependency required.

### 3.4 API and UI
- POST /wear (items or outfit_id, date, source) -> idempotent, updates counts, laundry states and wear_log, returns updated item states.
- POST /wear/undo, POST /items/{id}/laundry (wash_now | send_to_laundry | mark_unavailable | restore).
- GET/PUT /settings/laundry.
- Settings page -> "Laundry and wear rules": global max wears, global wash days, per-category table, same-item cooldown, auto-return toggle, "Reset to defaults".
- My Wardrobe: filters Clean / In laundry (with "back on <date>") / Unavailable; badge "worn 1 of 2" on each item; quick actions above.
- Changing settings never silently regenerates the active recommendation; it marks it stale and shows a "Refresh suggestion?" prompt.
- After "Wear This Outfit": update wear_log, update item states, and if one of the worn items just went to laundry show a short toast ("Shirt goes to laundry, back on Sat").

## 4. How recommendations must work (NEW/FIX, required)

### 4.1 Pipeline (deterministic, explainable, wardrobe-only)

Step 1 – Resolve context (single function used by Home and Daily Fit):
  Occasion priority: user-selected occasion > calendar event for that day/time (mapped to an occasion by keywords, user can override) > weekly routine entry for that weekday > "everyday".
  Also collect: weather (temperature, rain, wind) from the real weather API with graceful fallback to "weather unavailable" (never invent), user profile (style, colours, fit, occasion preferences, occupation), recent wear history, feedback history, target date.

Step 2 – Hard filters (items failing any are excluded):
  accepted + not deleted; is_available(target_date); category allowed for the occasion; formality within the occasion range; not in the user's "never wear" list; weather hard rules (e.g. no open footwear when raining, outerwear required below the user's cold threshold).
  Record how many items each filter removed, per reason (pending review, not accepted, unavailable/in laundry with earliest return date, wrong category, formality, weather rule). The API returns these counts so the UI can explain an empty result accurately.

Step 3 – Item scoring (0-1 each, weighted):
  occasion_fit, preference_match (colour/style/fit), weather_fit, freshness (underused items get a bonus), cooldown_penalty (same item worn within same_item_cooldown_days), feedback_affinity (past likes/dislikes).

Step 4 – Outfit composition and scoring:
  Templates per occasion: [top + bottom + footwear (+ outerwear if cold/rain) (+ accessory)] or one-piece/set (dress, kurta set, suit). Keep top-8 items per slot, combine, then score the outfit: formality_coherence (items within 1 level of each other), colour_harmony (neutrals + max one accent, no clashing pairs, max one bold pattern), style_consistency, weather_fit, repetition_penalty (same combination or same top+bottom pair in the last 14 days), pair_affinity from feedback.

Step 5 – Selection with stability:
  Choose from the top-K using a seeded pick (seed = user_id + date + occasion + regenerate_counter) so the result is stable across refreshes and only changes on explicit Regenerate. Regenerate increments the counter and must never return an outfit already shown for that (date, occasion).

Step 6 – Explanation: build text from the actual top-scoring components and real values (e.g. "Light jacket because it is 17 C with 60% rain chance", "Navy shirt matches your preferred colours and wasn't worn this week"). No invented claims.

### 4.2 Occasion profiles (store as config/data, not scattered if-statements)
- Everyday: formality 1-2, comfort and preferences highest weight, wide colour freedom.
- College: formality 1-2, comfort and practicality, layers by weather, avoid very formal and party wear.
- Office: formality 3-4, colour_harmony and formality_coherence highest, conservative colours, no gym/party items.
- Party: formality 2-4, expressive colours and statement pieces allowed, preference_match weight raised.
- Wedding: formality 4-5, ethnic/formal categories and rich colours preferred, penalise casual items, respect the user's culture/dress preferences from the profile.
- Gym: activewear only, weather and comfort only, ignore colour harmony.
- Travel: comfort, layering, wrinkle-resistant/versatile, darker mix-and-match colours, closed comfortable footwear.
Test that the same wardrobe produces visibly different outfits per occasion and that disallowed categories never appear (e.g. no party shirt in Gym).

### 4.3 Persistence and caching
- Store the active recommendation in DB: daily_recommendations(user_id, date, occasion, context_hash, item_ids, outfit_hash, regenerate_counter, status active|stale|worn, created_at). One active row per (user, date, occasion).
- Navigating Home <-> Daily Fit <-> other pages or refreshing returns the SAME stored outfit. Never regenerate on navigation or page load.
- Switching occasion loads that occasion's stored outfit or generates one once and stores it.
- Mark as stale (do not auto-replace) if: profile changed, laundry settings changed, or an item in the outfit was deleted, sent to laundry or made unavailable. Show "One item is no longer available - Replace it".
- Frontend uses a shared query cache keyed by (date, occasion), with no duplicate requests.

### 4.4 Actions
- Replace item: re-run only that slot, using compatibility with the remaining items, excluding the current item.
- Save outfit, Regenerate, Wear This Outfit (-> POST /wear), Feedback (like/dislike + reason tags: colour, fit, formality, weather, already worn recently) -> persisted and used in scoring.

### 4.4a Empty and insufficient-wardrobe states (required)
After the hard filters (Step 2) run for the selected occasion, decide the result state:

1. NO ITEMS FOUND: zero eligible items remain for the selected occasion, or no valid outfit can be built.
   - Show a clear empty state: "No clothes found for <Occasion>".
   - Do NOT fall back to another occasion, and do NOT show a random or fake outfit. Do not generate anything and do not store a recommendation row.
   - Show the reason below the message, based on the real filter results (never guessed):
     a. No accepted items in the categories this occasion needs -> "Your wardrobe has no <Occasion>-suitable clothes yet." Actions: [Upload clothes] [View Wardrobe Gap].
     b. Suitable items exist but all are in laundry or unavailable on that date -> "All your <Occasion> clothes are in laundry or unavailable." Show the earliest return date ("Back on Sat") and a link to My Wardrobe -> Laundry filter.
     c. Items exist but are pending AI review -> "You have N items waiting for review." Action: [Review pending items].
     d. Items exist but were removed by weather hard rules -> state the rule ("Nothing suitable for rain").
   - The reasons come from the per-filter removal counts, so the message is always accurate.

2. PARTIAL OUTFIT: some required slots are filled and others are missing (for example, top and bottom but no footwear).
   - Show the partial outfit plus a notice naming the missing slot: "No footwear found for <Occasion>". Link to Wardrobe Gap.
   - A partial outfit may be shown, but "Wear This Outfit" must be disabled until the required slots are filled, or require explicit confirmation.

3. Switching to an occasion with no clothes shows the empty state for that occasion only. Other occasions' stored outfits are unaffected.
4. Empty states must never trigger repeated API calls. Cache the "empty" result per (date, occasion) and invalidate it only when the wardrobe, laundry state or settings change.
5. The Home "Today's Outfit" card shows the same empty state, using the shared recommendation source.
6. The Weekly Planner shows "No clothes found" for any day or occasion with no valid outfit, and leaves that day empty instead of repeating items beyond their wear limits.

### 4.5 Weekly Planner
Generate the plan day by day with simulated state: planned (not yet worn) outfits count as projected wears so no item is planned beyond its wear limit or while in laundry on that date. Projected state must not change real counts until the user confirms "Wear This Outfit". Calendar events drive the occasion for each day. Optional end-of-day prompt "Did you wear this?" for planned outfits. Days with no valid outfit follow rule 4.4a(6).

## 5. Wardrobe Insights and Wardrobe Gap
- Compute from real ACCEPTED items only: category distribution, occasion coverage, colour balance, utilisation from wear_log (never-worn and most-worn items), items often unavailable.
- Gap = missing essentials per occasion (e.g. no formal shoes, no outerwear) derived from the occasion templates in 4.1. Occasions that return "No clothes found" or a missing slot in 4.4a should appear here as gaps.
- Shopping suggestions only from a verified provider API with real URLs and prices, filtered by taste, gap, occasion and budget. If no provider/credentials exist, mark the feature BLOCKED and show an honest state listing the gap items without products. Never fabricate listings.

## 6. Tests and acceptance criteria
Automated tests (backend and frontend) for:
- is_available boundaries (the Mon->Sat example, wash_days = 0, per-item > category > global override order, non-launderable categories, same-day double wear, undo).
- Recommender: hard filters, laundry exclusion for the target date, occasion differences, stability across repeated calls, regenerate never repeating, explanation matches the real scores.
- Wear -> wear_log -> laundry state -> next recommendation excludes the item.
- Ownership/isolation: user A cannot read or mutate user B's items, settings or recommendations.
- Settings change marks the recommendation stale without regenerating.
- Empty state: a wardrobe with no items suitable for the selected occasion returns status "no_items" with the correct reason and no stored recommendation. Test each reason (no suitable items, all in laundry, pending review only, weather rule).
- Missing slot: a wardrobe with no footwear returns a partial outfit naming the missing slot and disables "Wear This Outfit".
- Switching occasion: moving from an occasion with clothes to one without shows the empty state and keeps the first occasion's stored outfit intact.
- The API response never contains placeholder or fabricated items in an empty state.

Acceptance: all 8 user journeys from the audit (register -> onboarding, upload -> review -> accept, occasion -> outfit, wear -> history, revisit Home -> same outfit, event -> event-aware outfit, gap -> real suggestion or honest blocked state, edit profile -> updated recommendations) pass manually and via tests. Report each as Implemented and verified / Partially implemented / Blocked / Broken with evidence.

## 7. Phases
1. Cleanup and removal (Section 1) and P0 fixes (Section 2).
2. Laundry/wear data model, is_available, wear/undo APIs, Settings UI (Section 3).
3. Recommendation engine, occasion configs, persistence, actions, empty states (Section 4).
4. Planner simulation, Home integration, Insights and Gap (Sections 4.5 and 5).
5. Test completion, regression run, final report: features verified / partial / blocked / broken, tests executed, remaining blockers.
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-11-09T21:49:13+05:30.

The user's current state is as follows:
Active Document: c:\Users\user 2\Desktop\ai-wardrobe\frontend\src\pages\WardrobeGap.tsx (LANGUAGE_UNSPECIFIED)
Cursor is on line: 34
Other open documents:
- c:\Users\user 2\Desktop\ai-wardrobe\frontend\src\pages\Onboarding.tsx (LANGUAGE_UNSPECIFIED)
- c:\Users\user 2\Desktop\ai-wardrobe\frontend\src\pages\Profile.tsx (LANGUAGE_UNSPECIFIED)
- c:\Users\user 2\Desktop\ai-wardrobe\frontend\src\pages\DailyFit.tsx (LANGUAGE_UNSPECIFIED)
- c:\Users\user 2\Desktop\ai-wardrobe\frontend\src\pages\Home.tsx (LANGUAGE_UNSPECIFIED)
- c:\Users\user 2\Desktop\ai-wardrobe\frontend\src\components\layout\MobileNavigation.tsx (LANGUAGE_UNSPECIFIED)
</ADDITIONAL_METADATA>