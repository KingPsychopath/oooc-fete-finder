# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: event-routes.spec.ts >> event share routes >> offline acceptance pass covers PWA cache boundaries and reconnect
- Location: e2e/event-routes.spec.ts:583:6

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: 'Search events, locations, genres, phases...' })

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - link "Skip to main content" [ref=e2] [cursor=pointer]:
    - /url: "#main-content"
  - generic [ref=e3]:
    - banner [ref=e4]:
      - generic [ref=e5]:
        - generic [ref=e6]:
          - link "Fete Finder home" [ref=e7] [cursor=pointer]:
            - /url: /
            - generic [ref=e9]:
              - paragraph [ref=e10]: Out Of Office Collective
              - heading "Fete Finder" [level=1] [ref=e11]
          - navigation "Main" [ref=e12]:
            - link "Home" [ref=e13] [cursor=pointer]:
              - /url: /
            - link "How it works" [ref=e14] [cursor=pointer]:
              - /url: /how-it-works
            - link "Submit Event" [ref=e15] [cursor=pointer]:
              - /url: /submit-event
            - link "Promote" [ref=e16] [cursor=pointer]:
              - /url: /feature-event
            - link "FAQs" [ref=e17] [cursor=pointer]:
              - /url: https://outofofficecollective.co.uk/faqs
          - generic [ref=e18]:
            - generic [ref=e19]:
              - generic [ref=e20]:
                - generic [ref=e21]: 05:03:10
                - generic [ref=e22]: samedi 23 mai 2026
              - button "🌓 Toggle theme" [ref=e23]:
                - generic [ref=e24]: 🌓
                - generic [ref=e25]: Toggle theme
            - button "Quick actions menu" [ref=e27]:
              - img
              - img
            - button "Logout" [ref=e28]:
              - img
        - generic [ref=e31]:
          - generic [ref=e32]: Fete de la Musique
          - generic [ref=e33]: •
          - generic [ref=e34]: 28d 18h 57m until Sunday, 21 June 2026
    - generic "Curated by Out Of Office Collective. Paris summer rhythm, mapped live. Tap essentials for playlist, food and toilets" [ref=e35]:
      - generic [ref=e37]:
        - generic [ref=e38]:
          - generic [ref=e40]: Curated by Out Of Office Collective
          - generic [ref=e43]: Paris summer rhythm, mapped live
          - generic [ref=e46]: Tap essentials for playlist, food and toilets
          - generic [ref=e49]: Curated by Out Of Office Collective
          - generic [ref=e52]: Paris summer rhythm, mapped live
          - generic [ref=e55]: Tap essentials for playlist, food and toilets
        - generic [ref=e57]:
          - generic [ref=e59]: Curated by Out Of Office Collective
          - generic [ref=e62]: Paris summer rhythm, mapped live
          - generic [ref=e65]: Tap essentials for playlist, food and toilets
          - generic [ref=e68]: Curated by Out Of Office Collective
          - generic [ref=e71]: Paris summer rhythm, mapped live
          - generic [ref=e74]: Tap essentials for playlist, food and toilets
    - main [ref=e76]:
      - generic [ref=e77]:
        - strong [ref=e78]: "Cached event data:"
        - text: You are viewing the latest event snapshot saved on this device from May 23, 4:02 AM. Some live details may be unavailable until the app reconnects.
        - generic [ref=e79]: Filters and search are available with cached data until May 26, 4:02 AM.
      - region "Introduction" [ref=e80]:
        - generic [ref=e81]:
          - generic [ref=e82]:
            - paragraph [ref=e83]: Paris · Fête de la Musique
            - heading "Discover events across the city" [level=2] [ref=e84]
            - paragraph [ref=e85]: Explore live music and cultural events by arrondissement. Use the map and filters to find what’s on.
            - link "New here? See how Fête Finder works →" [ref=e86] [cursor=pointer]:
              - /url: /how-it-works
              - generic [ref=e87]: New here? See how Fête Finder
              - generic [ref=e88]: works →
          - generic [ref=e90]:
            - generic [ref=e91]:
              - paragraph [ref=e92]: OOOC Picks
              - paragraph [ref=e93]: Short on time? Start with the community-curated favourites.
            - button "Showing Picks" [active] [ref=e94]
      - generic [ref=e96]:
        - generic:
          - generic: Current favourites
        - generic [ref=e97]:
          - generic [ref=e99]:
            - generic [ref=e100]:
              - paragraph [ref=e102]: Worth a look
              - link "Get noticed by thousands more yearners with a Spotlight placement →" [ref=e104] [cursor=pointer]:
                - /url: /feature-event
                - img [ref=e105]
                - generic [ref=e108]: Get noticed by thousands more yearners with a Spotlight placement →
            - button "Browse All 58 Events" [ref=e110]:
              - text: Browse All 58 Events
              - img
          - generic [ref=e111]:
            - 'button "Fête OOOC Pick Where The Funktion: FDLM Sunday 21st · 13:00 - 00:00 36 Rue Notre Dame de Nazareth · 3e Free All ages 🇳🇱 NL Afro Amapiano +6 View details" [ref=e112]':
              - generic:
                - img
              - generic [ref=e114]:
                - generic [ref=e115]:
                  - img
                  - text: Fête
                - generic [ref=e116]:
                  - img
                  - text: OOOC Pick
              - generic [ref=e117]:
                - generic [ref=e118]:
                  - 'heading "Where The Funktion: FDLM" [level=3] [ref=e119]'
                  - generic [ref=e120]:
                    - generic [ref=e121]:
                      - img [ref=e122]
                      - generic [ref=e124]: Sunday 21st · 13:00 - 00:00
                      - generic "Daytime and early evening" [ref=e125]:
                        - img [ref=e126]
                    - generic [ref=e132]:
                      - img [ref=e133]
                      - generic [ref=e136]:
                        - generic [ref=e137]: 36 Rue Notre Dame de Nazareth
                        - generic [ref=e138]: ·
                        - generic [ref=e139]: 3e
                      - generic "Outdoor event" [ref=e141]:
                        - img [ref=e142]
                    - generic [ref=e145]:
                      - generic [ref=e146]:
                        - img [ref=e147]
                        - generic [ref=e149]: Free
                      - generic [ref=e150]:
                        - img [ref=e151]
                        - generic [ref=e156]: All ages
                - generic [ref=e157]:
                  - generic [ref=e158]: 🇳🇱 NL
                  - generic [ref=e159]: Afro
                  - generic [ref=e160]: Amapiano
                  - generic [ref=e161]: "+6"
                  - generic [ref=e162]:
                    - text: View details
                    - img [ref=e163]
            - button "Pre-Fete Soirée Pré-Pride QR & Alliées Edition 2026 Friday 19th · 20:00 - 01:30 Speechless · 11e €5.99 - €11.00 18+ 🇫🇷 FR Afrobeats Shatta +5 View details" [ref=e166]:
              - generic [ref=e169]:
                - img
                - text: Pre-Fete
              - generic [ref=e170]:
                - generic [ref=e171]:
                  - heading "Soirée Pré-Pride QR & Alliées Edition 2026" [level=3] [ref=e172]
                  - generic [ref=e173]:
                    - generic [ref=e174]:
                      - img [ref=e175]
                      - generic [ref=e177]: Friday 19th · 20:00 - 01:30
                      - generic "Late start or runs into the night" [ref=e178]:
                        - img [ref=e179]
                    - generic [ref=e181]:
                      - img [ref=e182]
                      - generic [ref=e185]:
                        - generic [ref=e186]: Speechless
                        - generic [ref=e187]: ·
                        - generic [ref=e188]: 11e
                      - generic "Indoor event" [ref=e190]:
                        - img [ref=e191]
                    - generic [ref=e195]:
                      - generic [ref=e196]:
                        - img [ref=e197]
                        - generic [ref=e199]: €5.99 - €11.00
                      - generic [ref=e200]:
                        - img [ref=e201]
                        - generic [ref=e206]: 18+
                - generic [ref=e207]:
                  - generic [ref=e208]: 🇫🇷 FR
                  - generic [ref=e209]: Afrobeats
                  - generic [ref=e210]: Shatta
                  - generic [ref=e211]: "+5"
                  - generic [ref=e212]:
                    - text: View details
                    - img [ref=e213]
            - button "Pre-Fete Slow Jams Nation - Fete De La Musique Slow Jams Party Friday 19th · 22:00 - 05:00 Salons du Louvre · 1e €25.00 18+ 🇬🇧 UK R&B Soul +1 View details" [ref=e216]:
              - generic [ref=e219]:
                - img
                - text: Pre-Fete
              - generic [ref=e220]:
                - generic [ref=e221]:
                  - heading "Slow Jams Nation - Fete De La Musique Slow Jams Party" [level=3] [ref=e222]
                  - generic [ref=e223]:
                    - generic [ref=e224]:
                      - img [ref=e225]
                      - generic [ref=e227]: Friday 19th · 22:00 - 05:00
                      - generic "Late start or runs into the night" [ref=e228]:
                        - img [ref=e229]
                    - generic [ref=e231]:
                      - img [ref=e232]
                      - generic [ref=e235]:
                        - generic [ref=e236]: Salons du Louvre
                        - generic [ref=e237]: ·
                        - generic [ref=e238]: 1e
                      - generic "Indoor event" [ref=e240]:
                        - img [ref=e241]
                    - generic [ref=e245]:
                      - generic [ref=e246]:
                        - img [ref=e247]
                        - generic [ref=e249]: €25.00
                      - generic [ref=e250]:
                        - img [ref=e251]
                        - generic [ref=e256]: 18+
                - generic [ref=e257]:
                  - generic [ref=e258]: 🇬🇧 UK
                  - generic [ref=e259]: R&B
                  - generic [ref=e260]: Soul
                  - generic [ref=e261]: "+1"
                  - generic [ref=e262]:
                    - text: View details
                    - img [ref=e263]
      - generic [ref=e266]:
        - generic [ref=e268]:
          - img [ref=e270]
          - generic [ref=e272]:
            - generic [ref=e273]: Events
            - generic [ref=e274]: "3"
            - generic [ref=e275]: Events filtered
        - generic [ref=e277]:
          - img [ref=e279]
          - generic [ref=e283]:
            - generic [ref=e284]: Coverage
            - generic [ref=e285]: "2"
            - generic [ref=e286]: Arrondissements with matching events
        - generic [ref=e288]:
          - img [ref=e290]
          - generic [ref=e292]:
            - generic [ref=e293]: Date Span
            - generic [ref=e294]: "2"
            - generic [ref=e295]: Days • 19-21 June 2026
      - generic [ref=e297]:
        - generic [ref=e300]:
          - generic [ref=e301]:
            - generic [ref=e302]:
              - img [ref=e303]
              - generic [ref=e306]: Paris Event Map
            - generic [ref=e307]: Offline
          - generic [ref=e308]:
            - button "Open Paris event map full screen" [ref=e309]:
              - img
              - generic [ref=e310]: Full screen
            - button "Expand Paris event map" [ref=e311]:
              - img
              - generic [ref=e312]: Expand
        - generic [ref=e314]:
          - generic [ref=e319]:
            - generic [ref=e321]:
              - paragraph [ref=e322]: Paris Map
              - paragraph [ref=e323]: Map temporarily unavailable
            - paragraph [ref=e324]: Map style, sprite, glyph, and tile assets are online-only. Cached event browsing, search, and filters are still available below.
          - generic:
            - paragraph: Map style, sprite, glyph, and tile assets are online-only. Cached event browsing, search, and filters are still available below.
      - generic [ref=e325]:
        - complementary [ref=e326]:
          - generic [ref=e328]:
            - generic [ref=e329]:
              - generic [ref=e330]:
                - img [ref=e331]
                - text: Filters
                - generic [ref=e333]: 1 active
              - generic [ref=e334]:
                - button "Clear" [ref=e335]
                - button "Collapse filters" [ref=e336]:
                  - img
            - generic [ref=e338]:
              - generic [ref=e342]:
                - img
                - text: OOOC Picks
                - button [ref=e343]:
                  - img
              - region [ref=e344]:
                - generic [ref=e345]:
                  - heading "Date & Times" [level=3] [ref=e346]:
                    - button "Date & Times" [expanded] [ref=e347]:
                      - generic [ref=e348]:
                        - img [ref=e349]
                        - text: Date & Times
                      - img
                  - region "Date & Times" [ref=e351]:
                    - generic [ref=e353]:
                      - generic [ref=e354]: Showing this year's events by default. Older showcase events are still available if you widen the date range.
                      - generic [ref=e355]:
                        - heading "Filter by Time" [level=4] [ref=e357]
                        - generic [ref=e358]:
                          - button "Day" [ref=e359]:
                            - generic [ref=e360]:
                              - generic [ref=e361]:
                                - img
                              - generic [ref=e362]: Day
                          - button "Night" [ref=e363]:
                            - generic [ref=e364]:
                              - generic [ref=e365]:
                                - img
                              - generic [ref=e366]: Night
                      - generic [ref=e367]:
                        - generic [ref=e368]:
                          - heading "Pick Date Range" [level=4] [ref=e369]
                          - button "All dates" [ref=e371]
                        - button "Open date range picker" [ref=e372]:
                          - img
                          - text: Thu, 1 Jan 2026 - Thu, 31 Dec 2026
                        - generic [ref=e373]:
                          - button "Fri, 19 Jun 2026" [ref=e374]:
                            - generic [ref=e375]: Fri, 19 Jun 2026
                          - button "Sun, 21 Jun 2026" [ref=e376]:
                            - generic [ref=e377]: Sun, 21 Jun 2026
                          - button "Sat, 20 Jun 2026" [ref=e378]:
                            - generic [ref=e379]: Sat, 20 Jun 2026
                          - button "Thu, 18 Jun 2026" [ref=e380]:
                            - generic [ref=e381]: Thu, 18 Jun 2026
                - heading "Location" [level=3] [ref=e383]:
                  - button "Location" [ref=e384]:
                    - text: Location
                    - img
                - heading "Music & Culture" [level=3] [ref=e386]:
                  - button "Music & Culture" [ref=e387]:
                    - text: Music & Culture
                    - img
                - heading "Preferences 1 active" [level=3] [ref=e389]:
                  - button "Preferences 1 active" [ref=e390]:
                    - text: Preferences
                    - generic [ref=e391]: 1 active
                    - img
              - generic [ref=e392]: Showing 3 matching events.
        - generic [ref=e394]:
          - generic [ref=e396]:
            - generic [ref=e397]:
              - generic [ref=e400]:
                - img [ref=e401]
                - generic [ref=e403]: Events
              - generic [ref=e404]:
                - button "Saved" [ref=e405]:
                  - img
                  - generic [ref=e406]: Saved
                - button "Near me" [ref=e407]:
                  - img
                  - generic [ref=e408]: Near me
                - group "Sort events" [ref=e409]:
                  - generic [ref=e410]: Sort events
                  - button "Upcoming" [pressed] [ref=e411]
                  - button "Fresh activity" [ref=e412]
                - button "Filters 1" [ref=e413]:
                  - img
                  - generic [ref=e414]: Filters
                  - generic [ref=e415]: "1"
                - button "Clear" [ref=e416]
            - link "Hosting something special? Put it on the map with the collective and submit your event →" [ref=e417] [cursor=pointer]:
              - /url: /submit-event
            - generic [ref=e420]:
              - generic [ref=e421]:
                - img [ref=e422]
                - textbox "Search events, locations, genres, categories..." [ref=e425]
              - paragraph [ref=e427]: 3 events found
              - generic [ref=e429]:
                - button "Monday" [ref=e430]:
                  - generic [ref=e431]: Monday
                - button "Night" [ref=e432]:
                  - generic [ref=e433]: Night
                - button "Free" [ref=e434]:
                  - generic [ref=e435]: Free
                - button "21st" [ref=e436]:
                  - generic [ref=e437]: 21st
                - button "Pre-Fete" [ref=e438]:
                  - generic [ref=e439]: Pre-Fete
                - button "Post-Fete" [ref=e440]:
                  - generic [ref=e441]: Post-Fete
                - button "Konpa" [ref=e442]:
                  - generic [ref=e443]: Konpa
                - button "Amapiano" [ref=e444]:
                  - generic [ref=e445]: Amapiano
              - generic [ref=e446]:
                - generic [ref=e447]: Popular now
                - 'button "Popular now: Day" [ref=e448]':
                  - img
                  - generic [ref=e449]: Day
                - 'button "Popular now: Fete" [ref=e450]':
                  - img
                  - generic [ref=e451]: Fete
          - generic [ref=e453]:
            - generic [ref=e455] [cursor=pointer]:
              - img [ref=e457]
              - generic [ref=e459]:
                - generic [ref=e460]:
                  - generic [ref=e461]:
                    - generic [ref=e463]:
                      - img [ref=e464]
                      - text: Pre-Fete
                    - generic [ref=e468]:
                      - img [ref=e469]
                      - text: OOOC Pick
                  - generic [ref=e471]: 19e
                - heading "Krispy Jam N°29 - Tascha" [level=3] [ref=e472]
              - generic [ref=e473]:
                - generic [ref=e474]:
                  - img [ref=e475]
                  - generic [ref=e478]: Friday 19th • 20:00 - 02:00
                  - generic "Late start or runs into the night" [ref=e479]:
                    - img [ref=e480]
                - generic [ref=e482]:
                  - img [ref=e483]
                  - generic [ref=e486]: La Petite Halle
                  - generic [ref=e487]:
                    - generic "Indoor event" [ref=e488]:
                      - img [ref=e489]
                    - generic "Outdoor event" [ref=e493]:
                      - img [ref=e494]
                - generic [ref=e497]:
                  - img [ref=e498]
                  - generic [ref=e500]: Free
                - generic [ref=e501]:
                  - img [ref=e502]
                  - generic [ref=e507]: 18+
              - generic [ref=e508]:
                - generic [ref=e509]: 🇫🇷 FR
                - generic [ref=e510]: Soul
                - generic [ref=e511]: Jazz
                - generic "3 more genres in details" [ref=e512]: "+3"
            - generic [ref=e514] [cursor=pointer]:
              - img [ref=e516]
              - generic [ref=e518]:
                - generic [ref=e519]:
                  - generic [ref=e520]:
                    - generic [ref=e522]:
                      - img [ref=e523]
                      - text: Fête
                    - generic [ref=e527]:
                      - img [ref=e528]
                      - text: OOOC Pick
                  - generic [ref=e530]: 3e
                - 'heading "Where The Funktion: FDLM" [level=3] [ref=e531]'
              - generic [ref=e532]:
                - generic [ref=e533]:
                  - img [ref=e534]
                  - generic [ref=e537]: Sunday 21st • 13:00 - 00:00
                  - generic "Daytime and early evening" [ref=e538]:
                    - img [ref=e539]
                - generic [ref=e545]:
                  - img [ref=e546]
                  - generic [ref=e549]: 36 Rue Notre Dame de Nazareth
                  - generic "Outdoor event" [ref=e551]:
                    - img [ref=e552]
                - generic [ref=e555]:
                  - img [ref=e556]
                  - generic [ref=e558]: Free
                - generic [ref=e559]:
                  - img [ref=e560]
                  - generic [ref=e565]: All ages
              - generic [ref=e566]:
                - generic [ref=e567]: 🇳🇱 NL
                - generic [ref=e568]: Afrobeats
                - generic [ref=e569]: Francophone
                - generic "6 more genres in details" [ref=e570]: "+6"
            - generic [ref=e572] [cursor=pointer]:
              - img [ref=e574]
              - generic [ref=e576]:
                - generic [ref=e577]:
                  - generic [ref=e578]:
                    - generic [ref=e580]:
                      - img [ref=e581]
                      - text: Fête
                    - generic [ref=e585]:
                      - img [ref=e586]
                      - text: OOOC Pick
                  - generic [ref=e588]: 3e
                - heading "Damside Fete De La Musique Block Party Featuring YeYe" [level=3] [ref=e589]
              - generic [ref=e590]:
                - generic [ref=e591]:
                  - img [ref=e592]
                  - generic [ref=e595]: Sunday 21st • 14:00 - 00:00
                  - generic "Daytime and early evening" [ref=e596]:
                    - img [ref=e597]
                - generic [ref=e603]:
                  - img [ref=e604]
                  - generic [ref=e607]: 42 Rue Notre Dame De Nazareth
                  - generic "Outdoor event" [ref=e609]:
                    - img [ref=e610]
                - generic [ref=e613]:
                  - img [ref=e614]
                  - generic [ref=e616]: Free
                - generic [ref=e617]:
                  - img [ref=e618]
                  - generic [ref=e623]: All ages
              - generic [ref=e624]:
                - generic [ref=e625]: 🇫🇷 FR
                - generic [ref=e626]: 🇳🇱 NL
                - generic [ref=e627]: Afro
                - generic [ref=e628]: Amapiano
                - generic "2 more genres in details" [ref=e629]: "+2"
      - button "Scroll to top" [ref=e630]:
        - img
  - contentinfo [ref=e631]:
    - generic [ref=e633]:
      - generic [ref=e634]:
        - generic [ref=e635]:
          - generic [ref=e636]: Follow us on socials for updates
          - generic [ref=e637]:
            - link "Visit Out of Office Collective website" [ref=e638] [cursor=pointer]:
              - /url: https://www.outofofficecollective.co.uk/
              - img [ref=e639]
              - img [ref=e642]
            - link "Follow Out of Office Collective on Instagram" [ref=e646] [cursor=pointer]:
              - /url: https://www.instagram.com/outofofficecollectivee/
              - img [ref=e647]
              - img [ref=e649]
            - link "Follow Out of Office Collective on TikTok" [ref=e653] [cursor=pointer]:
              - /url: https://www.tiktok.com/@outofofficecollective
              - img [ref=e654]
              - img [ref=e656]
        - navigation "Footer" [ref=e660]:
          - link "How it works" [ref=e661] [cursor=pointer]:
            - /url: /how-it-works
          - link "Submit your event" [ref=e662] [cursor=pointer]:
            - /url: /submit-event
          - link "Promote" [ref=e663] [cursor=pointer]:
            - /url: /feature-event
          - link "Privacy Policy" [ref=e664] [cursor=pointer]:
            - /url: /privacy
          - link "Contact us" [ref=e665] [cursor=pointer]:
            - /url: https://outofofficecollective.co.uk/contact
          - link "FAQ's" [ref=e666] [cursor=pointer]:
            - /url: https://outofofficecollective.co.uk/faqs
      - generic [ref=e667]:
        - generic [ref=e668]:
          - generic [ref=e669]:
            - generic [ref=e670]: Web app v2.0.0 • Made by
            - link "Milkandhenny" [ref=e671] [cursor=pointer]:
              - /url: https://x.com/milkandh3nny
          - generic [ref=e672]: •
          - link "Buy me a croissant" [ref=e673] [cursor=pointer]:
            - /url: https://coff.ee/milkandhenny
            - img [ref=e674]
            - generic [ref=e680]: Buy me a croissant
        - generic [ref=e681]: Maintained by the OOOC Community
  - alert [ref=e682]
  - complementary "Community invitation":
    - generic:
      - generic:
        - generic:
          - generic:
            - generic:
              - paragraph: Out Of Office Collective
              - generic:
                - generic:
                  - img
                - heading "Join the collective" [level=3]
            - button "Close community invitation":
              - img
          - paragraph: Get real-time Paris updates and share your finds with the OOOC community.
          - button "Open WhatsApp Group":
            - img
            - text: Open WhatsApp Group
          - paragraph: Opens in WhatsApp
    - generic: Opens WhatsApp community chat in a new tab
  - generic [ref=e684]: Offline mode
```

# Test source

```ts
  541 | 			page.getByText("Protected discovery").locator(".."),
  542 | 		).toContainText("allowed");
  543 | 		await page.getByRole("button", { name: /show picks/i }).click();
  544 | 		await expect(
  545 | 			page.getByRole("button", { name: /showing picks/i }),
  546 | 		).toBeVisible();
  547 | 		await expect(page.getByRole("dialog")).toHaveCount(0);
  548 | 	});
  549 | 
  550 | 	test("event modal reopens offline from saved event detail", async ({
  551 | 		context,
  552 | 		page,
  553 | 	}) => {
  554 | 		await page.goto("/");
  555 | 		await expect(page.locator("#tour-first-event-card")).toBeVisible();
  556 | 		await waitForServiceWorkerReady(page);
  557 | 		await page.reload({ waitUntil: "domcontentloaded" });
  558 | 		await expect(page.locator("#tour-first-event-card")).toBeVisible();
  559 | 		await waitForHomeEventSnapshot(page);
  560 | 
  561 | 		await page
  562 | 			.locator("#tour-all-events")
  563 | 			.getByRole("heading", { name: EVENT_TITLE })
  564 | 			.click();
  565 | 		await expect(page.getByRole("dialog", { name: EVENT_TITLE })).toBeVisible();
  566 | 		await waitForEventDetailSnapshot(page, EVENT_KEY);
  567 | 
  568 | 		await setBrowserOffline(context, page, true);
  569 | 		await page.reload({ waitUntil: "domcontentloaded" });
  570 | 		await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  571 | 
  572 | 		await expect(page.getByRole("dialog", { name: EVENT_TITLE })).toBeVisible();
  573 | 		await expect(
  574 | 			page.getByText(
  575 | 				/Some live details may be unavailable until the app reconnects/,
  576 | 			),
  577 | 		).toBeVisible();
  578 | 		await expect(
  579 | 			page.getByRole("button", { name: "Close event details" }),
  580 | 		).toBeVisible();
  581 | 	});
  582 | 
  583 | 	test("offline acceptance pass covers PWA cache boundaries and reconnect", async ({
  584 | 		context,
  585 | 		page,
  586 | 	}) => {
  587 | 		await verifyUserSession(page);
  588 | 		await markTourSeen(page);
  589 | 		const assertNoChunkLoadError = failOnChunkLoadError(page);
  590 | 		await page.goto("/");
  591 | 		await expect(page.locator("#tour-first-event-card")).toBeVisible();
  592 | 		await waitForServiceWorkerReady(page);
  593 | 		await waitForServiceWorkerController(page);
  594 | 		await waitForNextStaticCache(page);
  595 | 		await page.reload({ waitUntil: "domcontentloaded" });
  596 | 		await expect(page.locator("#tour-first-event-card")).toBeVisible();
  597 | 
  598 | 		const serviceWorkerState = await page.evaluate(() => ({
  599 | 			hasController: Boolean(navigator.serviceWorker.controller),
  600 | 			manifestHref:
  601 | 				document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.href ??
  602 | 				null,
  603 | 		}));
  604 | 		expect(serviceWorkerState.hasController).toBe(true);
  605 | 		expect(serviceWorkerState.manifestHref).toContain("/manifest.webmanifest");
  606 | 		await waitForNextStaticCache(page);
  607 | 
  608 | 		await waitForHomeEventSnapshot(page);
  609 | 		await waitForOfflineGraceState(page);
  610 | 		await page
  611 | 			.locator("#tour-all-events")
  612 | 			.getByRole("heading", { name: EVENT_TITLE })
  613 | 			.click();
  614 | 		await waitForEventDetailSnapshot(page, EVENT_KEY);
  615 | 		await page.getByRole("button", { name: "Close event details" }).click();
  616 | 
  617 | 		await page.evaluate(async () => {
  618 | 			await Promise.allSettled([
  619 | 				fetch("/api/auth/session"),
  620 | 				fetch("/api/user/preferences"),
  621 | 				fetch("/api/admin/health"),
  622 | 			]);
  623 | 		});
  624 | 		const cachedPathnames = await getCachedPathnames(page);
  625 | 		expect(cachedPathnames).not.toContain("/api/auth/session");
  626 | 		expect(cachedPathnames).not.toContain("/api/user/preferences");
  627 | 		expect(cachedPathnames).not.toContain("/api/admin/health");
  628 | 
  629 | 		await setBrowserOffline(context, page, true);
  630 | 		await page.reload({ waitUntil: "domcontentloaded" });
  631 | 		await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  632 | 
  633 | 		await expect(page.getByText(/^Cached event data:/)).toBeVisible();
  634 | 		await page.getByRole("button", { name: /show picks/i }).click();
  635 | 		await expect(
  636 | 			page.getByRole("button", { name: /showing picks/i }),
  637 | 		).toBeVisible();
  638 | 		const searchInput = page.getByRole("textbox", {
  639 | 			name: "Search events, locations, genres, phases...",
  640 | 		});
> 641 | 		await searchInput.fill("Krispy");
      |                     ^ Error: locator.fill: Test timeout of 30000ms exceeded.
  642 | 		await expect(
  643 | 			page
  644 | 				.locator("#tour-all-events")
  645 | 				.getByRole("heading", { name: EVENT_TITLE }),
  646 | 		).toBeVisible();
  647 | 		await expect(page.getByText(/\b1 event found\b/)).toBeVisible();
  648 | 		await page
  649 | 			.locator("#tour-all-events")
  650 | 			.getByRole("heading", { name: EVENT_TITLE })
  651 | 			.click();
  652 | 		await expect(page.getByRole("dialog", { name: EVENT_TITLE })).toBeVisible();
  653 | 		await expect(
  654 | 			page.getByText(
  655 | 				"Map style, sprite, glyph, and tile assets are online-only. Cached event browsing, search, and filters are still available below.",
  656 | 			).first(),
  657 | 		).toBeVisible();
  658 | 
  659 | 		await setBrowserOffline(context, page, false);
  660 | 		await page.reload({ waitUntil: "domcontentloaded" });
  661 | 		await expect(page.getByRole("dialog", { name: EVENT_TITLE })).toBeVisible();
  662 | 		await expect(page.getByText(/^Cached event data:/)).toHaveCount(0);
  663 | 		await page.getByRole("button", { name: "Close event details" }).click();
  664 | 		await expect(page.locator("#tour-first-event-card")).toBeVisible();
  665 | 		assertNoChunkLoadError();
  666 | 	});
  667 | 
  668 | 	test("transient offline fallback returns to live events after reconnect", async ({
  669 | 		context,
  670 | 		page,
  671 | 	}) => {
  672 | 		await page.goto("/");
  673 | 		await expect(page.locator("#tour-first-event-card")).toBeVisible();
  674 | 		await waitForHomeEventSnapshot(page);
  675 | 
  676 | 		await setBrowserOffline(context, page, true);
  677 | 		await expect(page.getByText(/^Cached event data:/)).toBeVisible();
  678 | 
  679 | 		await setBrowserOffline(context, page, false);
  680 | 		await expect(page.getByText(/^Cached event data:/)).toHaveCount(0);
  681 | 		await expect(page.locator("#tour-first-event-card")).toBeVisible();
  682 | 	});
  683 | 
  684 | });
  685 | 
  686 | test.describe("event share routes on mobile", () => {
  687 | 	test.use({ viewport: { width: 390, height: 844 } });
  688 | 
  689 | 	test("tour spotlight frames the first OOOC Picks step on mobile", async ({
  690 | 		page,
  691 | 	}) => {
  692 | 		await startHomepageTour(page);
  693 | 
  694 | 		await expectTourSpotlightToContainTarget(page, "#tour-oooc-picks");
  695 | 	});
  696 | 
  697 | 	test("direct event URL is framed correctly on mobile", async ({ page }) => {
  698 | 		await page.goto(EVENT_PATH);
  699 | 
  700 | 		const modal = page.getByRole("dialog", { name: EVENT_TITLE });
  701 | 		await expect(modal).toBeVisible();
  702 | 		await expect(
  703 | 			page.getByRole("button", { name: "Close event details" }),
  704 | 		).toBeVisible();
  705 | 		const modalBox = await modal.boundingBox();
  706 | 		expect(modalBox).not.toBeNull();
  707 | 		expect(modalBox?.x ?? -1).toBeGreaterThanOrEqual(0);
  708 | 		expect(modalBox?.y ?? -1).toBeGreaterThanOrEqual(0);
  709 | 		expect(modalBox?.width ?? 0).toBeLessThanOrEqual(390);
  710 | 		expect(modalBox?.height ?? 0).toBeLessThanOrEqual(844);
  711 | 	});
  712 | });
  713 | 
  714 | test.describe("event share routes without JavaScript", () => {
  715 | 	test.use({ javaScriptEnabled: false });
  716 | 
  717 | 	test("direct event URL keeps a server-rendered modal preview", async ({
  718 | 		page,
  719 | 	}) => {
  720 | 		await page.goto(EVENT_PATH);
  721 | 
  722 | 		const preview = page.locator("section").filter({ hasText: EVENT_TITLE });
  723 | 		await expect(preview).toBeVisible();
  724 | 		await expect(
  725 | 			page.getByRole("link", { name: "Close event details" }),
  726 | 		).toBeVisible();
  727 | 		await expect(
  728 | 			page.getByRole("link", { name: "Browse all events" }),
  729 | 		).toBeVisible();
  730 | 		await expect(preview).toHaveScreenshot("no-js-event-preview.png");
  731 | 	});
  732 | });
  733 | 
```