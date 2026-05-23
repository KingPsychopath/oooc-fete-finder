# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: event-routes.spec.ts >> event share routes >> homepage reloads offline from saved events with search and map fallback
- Location: e2e/event-routes.spec.ts:470:6

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
                - generic [ref=e21]: 05:02:59
                - generic [ref=e22]: samedi 23 mai 2026
              - button "🌓 Toggle theme" [ref=e23]:
                - generic [ref=e24]: 🌓
                - generic [ref=e25]: Toggle theme
            - button "Quick actions menu" [ref=e27]:
              - img
              - img
            - button "Logout" [ref=e28]:
              - img
        - generic [ref=e33]:
          - generic [ref=e34]: Fete de la Musique
          - generic [ref=e35]: •
          - generic [ref=e36]: 28d 18h 57m until Sunday, 21 June 2026
    - generic "Curated by Out Of Office Collective. Paris summer rhythm, mapped live. Tap essentials for playlist, food and toilets" [ref=e37]:
      - generic [ref=e39]:
        - generic [ref=e40]:
          - generic [ref=e42]: Curated by Out Of Office Collective
          - generic [ref=e45]: Paris summer rhythm, mapped live
          - generic [ref=e48]: Tap essentials for playlist, food and toilets
          - generic [ref=e51]: Curated by Out Of Office Collective
          - generic [ref=e54]: Paris summer rhythm, mapped live
          - generic [ref=e57]: Tap essentials for playlist, food and toilets
        - generic [ref=e59]:
          - generic [ref=e61]: Curated by Out Of Office Collective
          - generic [ref=e64]: Paris summer rhythm, mapped live
          - generic [ref=e67]: Tap essentials for playlist, food and toilets
          - generic [ref=e70]: Curated by Out Of Office Collective
          - generic [ref=e73]: Paris summer rhythm, mapped live
          - generic [ref=e76]: Tap essentials for playlist, food and toilets
    - main [ref=e78]:
      - generic [ref=e79]:
        - strong [ref=e80]: "Cached event data:"
        - text: You are viewing the latest event snapshot saved on this device from May 23, 4:02 AM. Some live details may be unavailable until the app reconnects.
        - generic [ref=e81]: Filters and search are available with cached data until May 26, 4:02 AM.
      - region "Introduction" [ref=e82]:
        - generic [ref=e83]:
          - generic [ref=e84]:
            - paragraph [ref=e85]: Paris · Fête de la Musique
            - heading "Discover events across the city" [level=2] [ref=e86]
            - paragraph [ref=e87]: Explore live music and cultural events by arrondissement. Use the map and filters to find what’s on.
            - link "New here? See how Fête Finder works →" [ref=e88] [cursor=pointer]:
              - /url: /how-it-works
              - generic [ref=e89]: New here? See how Fête Finder
              - generic [ref=e90]: works →
          - generic [ref=e92]:
            - generic [ref=e93]:
              - paragraph [ref=e94]: OOOC Picks
              - paragraph [ref=e95]: Short on time? Start with the community-curated favourites.
            - button "Show Picks" [ref=e96]
      - generic [ref=e98]:
        - generic:
          - generic: Current favourites
        - generic [ref=e99]:
          - generic [ref=e101]:
            - generic [ref=e102]:
              - paragraph [ref=e104]: Worth a look
              - link "Get noticed by thousands more yearners with a Spotlight placement →" [ref=e106] [cursor=pointer]:
                - /url: /feature-event
                - img [ref=e107]
                - generic [ref=e110]: Get noticed by thousands more yearners with a Spotlight placement →
            - button "Browse All 58 Events" [ref=e112]:
              - text: Browse All 58 Events
              - img
          - generic [ref=e113]:
            - 'button "Fête OOOC Pick Where The Funktion: FDLM Sunday 21st · 13:00 - 00:00 36 Rue Notre Dame de Nazareth · 3e Free All ages 🇳🇱 NL Afro Amapiano +6 View details" [ref=e114]':
              - generic:
                - img
              - generic [ref=e116]:
                - generic [ref=e117]:
                  - img
                  - text: Fête
                - generic [ref=e118]:
                  - img
                  - text: OOOC Pick
              - generic [ref=e119]:
                - generic [ref=e120]:
                  - 'heading "Where The Funktion: FDLM" [level=3] [ref=e121]'
                  - generic [ref=e122]:
                    - generic [ref=e123]:
                      - img [ref=e124]
                      - generic [ref=e126]: Sunday 21st · 13:00 - 00:00
                      - generic "Daytime and early evening" [ref=e127]:
                        - img [ref=e128]
                    - generic [ref=e134]:
                      - img [ref=e135]
                      - generic [ref=e138]:
                        - generic [ref=e139]: 36 Rue Notre Dame de Nazareth
                        - generic [ref=e140]: ·
                        - generic [ref=e141]: 3e
                      - generic "Outdoor event" [ref=e143]:
                        - img [ref=e144]
                    - generic [ref=e147]:
                      - generic [ref=e148]:
                        - img [ref=e149]
                        - generic [ref=e151]: Free
                      - generic [ref=e152]:
                        - img [ref=e153]
                        - generic [ref=e158]: All ages
                - generic [ref=e159]:
                  - generic [ref=e160]: 🇳🇱 NL
                  - generic [ref=e161]: Afro
                  - generic [ref=e162]: Amapiano
                  - generic [ref=e163]: "+6"
                  - generic [ref=e164]:
                    - text: View details
                    - img [ref=e165]
            - button "Pre-Fete Soirée Pré-Pride QR & Alliées Edition 2026 Friday 19th · 20:00 - 01:30 Speechless · 11e €5.99 - €11.00 18+ 🇫🇷 FR Afrobeats Shatta +5 View details" [ref=e168]:
              - generic [ref=e171]:
                - img
                - text: Pre-Fete
              - generic [ref=e172]:
                - generic [ref=e173]:
                  - heading "Soirée Pré-Pride QR & Alliées Edition 2026" [level=3] [ref=e174]
                  - generic [ref=e175]:
                    - generic [ref=e176]:
                      - img [ref=e177]
                      - generic [ref=e179]: Friday 19th · 20:00 - 01:30
                      - generic "Late start or runs into the night" [ref=e180]:
                        - img [ref=e181]
                    - generic [ref=e183]:
                      - img [ref=e184]
                      - generic [ref=e187]:
                        - generic [ref=e188]: Speechless
                        - generic [ref=e189]: ·
                        - generic [ref=e190]: 11e
                      - generic "Indoor event" [ref=e192]:
                        - img [ref=e193]
                    - generic [ref=e197]:
                      - generic [ref=e198]:
                        - img [ref=e199]
                        - generic [ref=e201]: €5.99 - €11.00
                      - generic [ref=e202]:
                        - img [ref=e203]
                        - generic [ref=e208]: 18+
                - generic [ref=e209]:
                  - generic [ref=e210]: 🇫🇷 FR
                  - generic [ref=e211]: Afrobeats
                  - generic [ref=e212]: Shatta
                  - generic [ref=e213]: "+5"
                  - generic [ref=e214]:
                    - text: View details
                    - img [ref=e215]
            - button "Pre-Fete Slow Jams Nation - Fete De La Musique Slow Jams Party Friday 19th · 22:00 - 05:00 Salons du Louvre · 1e €25.00 18+ 🇬🇧 UK R&B Soul +1 View details" [ref=e218]:
              - generic [ref=e221]:
                - img
                - text: Pre-Fete
              - generic [ref=e222]:
                - generic [ref=e223]:
                  - heading "Slow Jams Nation - Fete De La Musique Slow Jams Party" [level=3] [ref=e224]
                  - generic [ref=e225]:
                    - generic [ref=e226]:
                      - img [ref=e227]
                      - generic [ref=e229]: Friday 19th · 22:00 - 05:00
                      - generic "Late start or runs into the night" [ref=e230]:
                        - img [ref=e231]
                    - generic [ref=e233]:
                      - img [ref=e234]
                      - generic [ref=e237]:
                        - generic [ref=e238]: Salons du Louvre
                        - generic [ref=e239]: ·
                        - generic [ref=e240]: 1e
                      - generic "Indoor event" [ref=e242]:
                        - img [ref=e243]
                    - generic [ref=e247]:
                      - generic [ref=e248]:
                        - img [ref=e249]
                        - generic [ref=e251]: €25.00
                      - generic [ref=e252]:
                        - img [ref=e253]
                        - generic [ref=e258]: 18+
                - generic [ref=e259]:
                  - generic [ref=e260]: 🇬🇧 UK
                  - generic [ref=e261]: R&B
                  - generic [ref=e262]: Soul
                  - generic [ref=e263]: "+1"
                  - generic [ref=e264]:
                    - text: View details
                    - img [ref=e265]
      - generic [ref=e268]:
        - generic [ref=e270]:
          - img [ref=e272]
          - generic [ref=e274]:
            - generic [ref=e275]: Events
            - generic [ref=e276]: "58"
            - generic [ref=e277]: Events in view
        - generic [ref=e279]:
          - img [ref=e281]
          - generic [ref=e285]:
            - generic [ref=e286]: Coverage
            - generic [ref=e287]: "15"
            - generic [ref=e288]: Arrondissements in view
        - generic [ref=e290]:
          - img [ref=e292]
          - generic [ref=e294]:
            - generic [ref=e295]: Date Span
            - generic [ref=e296]: "4"
            - generic [ref=e297]: Days • 18-21 June 2026
      - generic [ref=e299]:
        - generic [ref=e302]:
          - generic [ref=e303]:
            - generic [ref=e304]:
              - img [ref=e305]
              - generic [ref=e308]: Paris Event Map
            - generic [ref=e309]: Offline
          - generic [ref=e310]:
            - button "Open Paris event map full screen" [ref=e311]:
              - img
              - generic [ref=e312]: Full screen
            - button "Expand Paris event map" [ref=e313]:
              - img
              - generic [ref=e314]: Expand
        - generic [ref=e316]:
          - generic [ref=e321]:
            - generic [ref=e323]:
              - paragraph [ref=e324]: Paris Map
              - paragraph [ref=e325]: Map temporarily unavailable
            - paragraph [ref=e326]: Map style, sprite, glyph, and tile assets are online-only. Cached event browsing, search, and filters are still available below.
          - generic:
            - paragraph: Map style, sprite, glyph, and tile assets are online-only. Cached event browsing, search, and filters are still available below.
      - generic [ref=e327]:
        - complementary [ref=e328]:
          - generic [ref=e330]:
            - generic [ref=e331]:
              - generic [ref=e332]:
                - img [ref=e333]
                - text: Filters
              - button "Collapse filters" [ref=e336]:
                - img
            - generic [ref=e338]:
              - region [ref=e339]:
                - generic [ref=e340]:
                  - heading "Date & Times" [level=3] [ref=e341]:
                    - button "Date & Times" [expanded] [ref=e342]:
                      - generic [ref=e343]:
                        - img [ref=e344]
                        - text: Date & Times
                      - img
                  - region "Date & Times" [ref=e346]:
                    - generic [ref=e348]:
                      - generic [ref=e349]: Showing this year's events by default. Older showcase events are still available if you widen the date range.
                      - generic [ref=e350]:
                        - heading "Filter by Time" [level=4] [ref=e352]
                        - generic [ref=e353]:
                          - button "Day" [ref=e354]:
                            - generic [ref=e355]:
                              - generic [ref=e356]:
                                - img
                              - generic [ref=e357]: Day
                          - button "Night" [ref=e358]:
                            - generic [ref=e359]:
                              - generic [ref=e360]:
                                - img
                              - generic [ref=e361]: Night
                      - generic [ref=e362]:
                        - generic [ref=e363]:
                          - heading "Pick Date Range" [level=4] [ref=e364]
                          - button "All dates" [ref=e366]
                        - button "Open date range picker" [ref=e367]:
                          - img
                          - text: Thu, 1 Jan 2026 - Thu, 31 Dec 2026
                        - generic [ref=e368]:
                          - button "Fri, 19 Jun 2026" [ref=e369]:
                            - generic [ref=e370]: Fri, 19 Jun 2026
                          - button "Sun, 21 Jun 2026" [ref=e371]:
                            - generic [ref=e372]: Sun, 21 Jun 2026
                          - button "Sat, 20 Jun 2026" [ref=e373]:
                            - generic [ref=e374]: Sat, 20 Jun 2026
                          - button "Thu, 18 Jun 2026" [ref=e375]:
                            - generic [ref=e376]: Thu, 18 Jun 2026
                - heading "Location" [level=3] [ref=e378]:
                  - button "Location" [ref=e379]:
                    - text: Location
                    - img
                - heading "Music & Culture" [level=3] [ref=e381]:
                  - button "Music & Culture" [ref=e382]:
                    - text: Music & Culture
                    - img
                - heading "Preferences" [level=3] [ref=e384]:
                  - button "Preferences" [ref=e385]:
                    - text: Preferences
                    - img
              - generic [ref=e386]: Showing 58 matching events.
        - generic [ref=e388]:
          - generic [ref=e390]:
            - generic [ref=e391]:
              - generic [ref=e394]:
                - img [ref=e395]
                - generic [ref=e397]: Events
              - generic [ref=e398]:
                - button "Saved" [ref=e399]:
                  - img
                  - generic [ref=e400]: Saved
                - button "Near me" [ref=e401]:
                  - img
                  - generic [ref=e402]: Near me
                - group "Sort events" [ref=e403]:
                  - generic [ref=e404]: Sort events
                  - button "Upcoming" [pressed] [ref=e405]
                  - button "Fresh activity" [ref=e406]
                - button "Filters" [ref=e407]:
                  - img
                  - generic [ref=e408]: Filters
            - link "Hosting something special? Put it on the map with the collective and submit your event →" [ref=e409] [cursor=pointer]:
              - /url: /submit-event
            - generic [ref=e412]:
              - generic [ref=e413]:
                - img [ref=e414]
                - textbox "Search events, locations, genres, categories..." [ref=e417]
              - paragraph [ref=e419]: 58 events available
              - generic [ref=e421]:
                - button "Monday" [ref=e422]:
                  - generic [ref=e423]: Monday
                - button "Night" [ref=e424]:
                  - generic [ref=e425]: Night
                - button "Free" [ref=e426]:
                  - generic [ref=e427]: Free
                - button "21st" [ref=e428]:
                  - generic [ref=e429]: 21st
                - button "Pre-Fete" [ref=e430]:
                  - generic [ref=e431]: Pre-Fete
                - button "Post-Fete" [ref=e432]:
                  - generic [ref=e433]: Post-Fete
                - button "Konpa" [ref=e434]:
                  - generic [ref=e435]: Konpa
                - button "Amapiano" [ref=e436]:
                  - generic [ref=e437]: Amapiano
              - generic [ref=e438]:
                - generic [ref=e439]: Popular now
                - 'button "Popular now: Day" [ref=e440]':
                  - img
                  - generic [ref=e441]: Day
                - 'button "Popular now: Fete" [ref=e442]':
                  - img
                  - generic [ref=e443]: Fete
          - generic [ref=e444]:
            - generic [ref=e445]:
              - generic [ref=e447] [cursor=pointer]:
                - generic [ref=e448]:
                  - generic [ref=e449]:
                    - generic [ref=e452]:
                      - img [ref=e453]
                      - text: Pre-Fete
                    - generic [ref=e456]: 1e
                  - 'heading "JayO: Live in Paris" [level=3] [ref=e457]'
                - generic [ref=e458]:
                  - generic [ref=e459]:
                    - img [ref=e460]
                    - generic [ref=e463]: Thursday 18th • 19:30 - 23:00
                    - generic "Late start or runs into the night" [ref=e464]:
                      - img [ref=e465]
                  - generic [ref=e467]:
                    - img [ref=e468]
                    - generic [ref=e471]: La Place
                    - generic "Indoor event" [ref=e473]:
                      - img [ref=e474]
                  - generic [ref=e478]:
                    - img [ref=e479]
                    - generic [ref=e481]: €24.00
                  - generic [ref=e482]:
                    - img [ref=e483]
                    - generic [ref=e488]: 18+
                - generic [ref=e489]:
                  - generic [ref=e490]: 🇫🇷 FR
                  - generic [ref=e491]: Afro
                  - generic [ref=e492]: Afrobeats
              - generic [ref=e494] [cursor=pointer]:
                - generic [ref=e495]:
                  - generic [ref=e496]:
                    - generic [ref=e499]:
                      - img [ref=e500]
                      - text: Pre-Fete
                    - generic [ref=e503]: Greater Paris
                  - 'heading "Bacardi To The World X Afourika : The Groove Experience" [level=3] [ref=e504]'
                - generic [ref=e505]:
                  - generic [ref=e506]:
                    - img [ref=e507]
                    - generic [ref=e510]: Friday 19th • 16:00 - 22:00
                    - generic "Daytime and early evening" [ref=e511]:
                      - img [ref=e512]
                  - generic [ref=e518]:
                    - img [ref=e519]
                    - generic [ref=e522]: Dock B
                    - generic "Indoor event" [ref=e524]:
                      - img [ref=e525]
                  - generic [ref=e529]:
                    - img [ref=e530]
                    - generic [ref=e532]: €18.70 - €27.50
                  - generic [ref=e533]:
                    - img [ref=e534]
                    - generic [ref=e539]: 18+
                - generic [ref=e540]:
                  - generic [ref=e541]: 🇫🇷 FR
                  - generic [ref=e542]: 🇬🇧 UK
                  - generic [ref=e543]: Afro
                  - generic [ref=e544]: Amapiano
                  - generic [ref=e545]: Afrobeats
              - generic [ref=e547] [cursor=pointer]:
                - generic [ref=e548]:
                  - generic [ref=e549]:
                    - generic [ref=e552]:
                      - img [ref=e553]
                      - text: Pre-Fete
                    - generic [ref=e556]: Greater Paris
                  - heading "Bingo N Beats - Fete De La Musique" [level=3] [ref=e557]
                - generic [ref=e558]:
                  - generic [ref=e559]:
                    - img [ref=e560]
                    - generic [ref=e563]: Friday 19th • 18:00 - 22:30
                    - generic "Late start or runs into the night" [ref=e564]:
                      - img [ref=e565]
                  - generic [ref=e567]:
                    - img [ref=e568]
                    - generic [ref=e571]: Paddock Lounge
                    - generic "Indoor event" [ref=e573]:
                      - img [ref=e574]
                  - generic [ref=e578]:
                    - img [ref=e579]
                    - generic [ref=e581]: €25.11 - €33.15
                  - generic [ref=e582]:
                    - img [ref=e583]
                    - generic [ref=e588]: 18+
                - generic [ref=e589]:
                  - generic [ref=e590]: 🇮🇪 IE
                  - generic [ref=e591]: Rap
                  - generic [ref=e592]: Francophone
                  - generic "3 more genres in details" [ref=e593]: "+3"
              - generic [ref=e595] [cursor=pointer]:
                - img [ref=e597]
                - generic [ref=e599]:
                  - generic [ref=e600]:
                    - generic [ref=e601]:
                      - generic [ref=e603]:
                        - img [ref=e604]
                        - text: Pre-Fete
                      - generic [ref=e608]:
                        - img [ref=e609]
                        - text: OOOC Pick
                    - generic [ref=e611]: 19e
                  - heading "Krispy Jam N°29 - Tascha" [level=3] [ref=e612]
                - generic [ref=e613]:
                  - generic [ref=e614]:
                    - img [ref=e615]
                    - generic [ref=e618]: Friday 19th • 20:00 - 02:00
                    - generic "Late start or runs into the night" [ref=e619]:
                      - img [ref=e620]
                  - generic [ref=e622]:
                    - img [ref=e623]
                    - generic [ref=e626]: La Petite Halle
                    - generic [ref=e627]:
                      - generic "Indoor event" [ref=e628]:
                        - img [ref=e629]
                      - generic "Outdoor event" [ref=e633]:
                        - img [ref=e634]
                  - generic [ref=e637]:
                    - img [ref=e638]
                    - generic [ref=e640]: Free
                  - generic [ref=e641]:
                    - img [ref=e642]
                    - generic [ref=e647]: 18+
                - generic [ref=e648]:
                  - generic [ref=e649]: 🇫🇷 FR
                  - generic [ref=e650]: Jazz
                  - generic [ref=e651]: Funk
                  - generic "3 more genres in details" [ref=e652]: "+3"
              - generic [ref=e654] [cursor=pointer]:
                - generic [ref=e655]:
                  - generic [ref=e656]:
                    - generic [ref=e659]:
                      - img [ref=e660]
                      - text: Pre-Fete
                    - generic [ref=e663]: 19e
                  - heading "La Terrasse Latino Du Cabaret Sauvage" [level=3] [ref=e664]
                - generic [ref=e665]:
                  - generic [ref=e666]:
                    - img [ref=e667]
                    - generic [ref=e670]: Friday 19th • 20:00 - 05:30
                    - generic "Late start or runs into the night" [ref=e671]:
                      - img [ref=e672]
                  - generic [ref=e674]:
                    - img [ref=e675]
                    - generic [ref=e678]: Cabaret Sauvage
                    - generic [ref=e679]:
                      - generic "Indoor event" [ref=e680]:
                        - img [ref=e681]
                      - generic "Outdoor event" [ref=e685]:
                        - img [ref=e686]
                  - generic [ref=e689]:
                    - img [ref=e690]
                    - generic [ref=e692]: Free - €21.00
                  - generic [ref=e693]:
                    - img [ref=e694]
                    - generic [ref=e699]: 18+
                - generic [ref=e700]:
                  - generic [ref=e701]: 🇫🇷 FR
                  - generic [ref=e702]: Salsa
                  - generic [ref=e703]: Bachata
                  - generic "2 more genres in details" [ref=e704]: "+2"
              - generic [ref=e706] [cursor=pointer]:
                - generic [ref=e707]:
                  - generic [ref=e708]:
                    - generic [ref=e711]:
                      - img [ref=e712]
                      - text: Pre-Fete
                    - generic [ref=e715]: 11e
                  - heading "Soirée Pré-Pride QR & Alliées Edition 2026" [level=3] [ref=e716]
                - generic [ref=e717]:
                  - generic [ref=e718]:
                    - img [ref=e719]
                    - generic [ref=e722]: Friday 19th • 20:00 - 01:30
                    - generic "Late start or runs into the night" [ref=e723]:
                      - img [ref=e724]
                  - generic [ref=e726]:
                    - img [ref=e727]
                    - generic [ref=e730]: Speechless
                    - generic "Indoor event" [ref=e732]:
                      - img [ref=e733]
                  - generic [ref=e737]:
                    - img [ref=e738]
                    - generic [ref=e740]: €5.99 - €11.00
                  - generic [ref=e741]:
                    - img [ref=e742]
                    - generic [ref=e747]: 18+
                - generic [ref=e748]:
                  - generic [ref=e749]: 🇫🇷 FR
                  - generic [ref=e750]: Soca
                  - generic [ref=e751]: French Pop
                  - generic "5 more genres in details" [ref=e752]: "+5"
              - generic [ref=e754] [cursor=pointer]:
                - generic [ref=e755]:
                  - generic [ref=e756]:
                    - generic [ref=e759]:
                      - img [ref=e760]
                      - text: Pre-Fete
                    - generic [ref=e763]: Greater Paris
                  - 'heading "AURA X LOVE & BOWL: With LOVE from PARIS" [level=3] [ref=e764]'
                - generic [ref=e765]:
                  - generic [ref=e766]:
                    - img [ref=e767]
                    - generic [ref=e770]: Friday 19th • 21:00 - 03:00
                    - generic "Late start or runs into the night" [ref=e771]:
                      - img [ref=e772]
                  - generic [ref=e774]:
                    - img [ref=e775]
                    - generic [ref=e778]: Beach Bowling
                    - generic "Indoor event" [ref=e780]:
                      - img [ref=e781]
                  - generic [ref=e785]:
                    - img [ref=e786]
                    - generic [ref=e788]: €38.71
                  - generic [ref=e789]:
                    - img [ref=e790]
                    - generic [ref=e795]: 21+
                - generic [ref=e797]: 🇬🇧 UK
              - generic [ref=e799] [cursor=pointer]:
                - generic [ref=e800]:
                  - generic [ref=e801]:
                    - generic [ref=e804]:
                      - img [ref=e805]
                      - text: Pre-Fete
                    - generic [ref=e808]: 14e
                  - heading "RnB & Groove" [level=3] [ref=e809]
                - generic [ref=e810]:
                  - generic [ref=e811]:
                    - img [ref=e812]
                    - generic [ref=e815]: Friday 19th • 21:00 - 04:00
                    - generic "Late start or runs into the night" [ref=e816]:
                      - img [ref=e817]
                  - generic [ref=e819]:
                    - img [ref=e820]
                    - generic [ref=e823]: Utopia
                    - generic "Indoor event" [ref=e825]:
                      - img [ref=e826]
                  - generic [ref=e830]:
                    - img [ref=e831]
                    - generic [ref=e833]: TBA
                  - generic [ref=e834]:
                    - img [ref=e835]
                    - generic [ref=e840]: 18+
                - generic [ref=e841]:
                  - generic [ref=e842]: 🇬🇧 UK
                  - generic [ref=e843]: Gqom
                  - generic [ref=e844]: 3-Step
                  - generic "5 more genres in details" [ref=e845]: "+5"
              - generic [ref=e847] [cursor=pointer]:
                - generic [ref=e848]:
                  - generic [ref=e849]:
                    - generic [ref=e852]:
                      - img [ref=e853]
                      - text: Pre-Fete
                    - generic [ref=e856]: 15e
                  - heading "1WAY x CLOSE FRIENDS" [level=3] [ref=e857]
                - generic [ref=e858]:
                  - generic [ref=e859]:
                    - img [ref=e860]
                    - generic [ref=e863]: Friday 19th • 22:00 - 05:00
                    - generic "Late start or runs into the night" [ref=e864]:
                      - img [ref=e865]
                  - generic [ref=e867]:
                    - img [ref=e868]
                    - generic [ref=e871]: Carré Montparnasse
                    - generic "Indoor event" [ref=e873]:
                      - img [ref=e874]
                  - generic [ref=e878]:
                    - img [ref=e879]
                    - generic [ref=e881]: £39.66 - £41.72
                  - generic [ref=e882]:
                    - img [ref=e883]
                    - generic [ref=e888]: 22+
                - generic [ref=e889]:
                  - generic [ref=e890]: 🇬🇧 UK
                  - generic [ref=e891]: 🇩🇪 DE
                  - generic [ref=e892]: 3-Step
                  - generic [ref=e893]: Slow Jams
                  - generic "5 more genres in details" [ref=e894]: "+5"
              - generic [ref=e896] [cursor=pointer]:
                - generic [ref=e897]:
                  - generic [ref=e898]:
                    - generic [ref=e901]:
                      - img [ref=e902]
                      - text: Pre-Fete
                    - generic [ref=e905]: 1e
                  - heading "Body2Bass In Paris" [level=3] [ref=e906]
                - generic [ref=e907]:
                  - generic [ref=e908]:
                    - img [ref=e909]
                    - generic [ref=e912]: Friday 19th • 22:00 - 05:00
                    - generic "Late start or runs into the night" [ref=e913]:
                      - img [ref=e914]
                  - generic [ref=e916]:
                    - img [ref=e917]
                    - generic [ref=e920]: 130 Rue de Rivoli
                    - generic "Indoor event" [ref=e922]:
                      - img [ref=e923]
                  - generic [ref=e927]:
                    - img [ref=e928]
                    - generic [ref=e930]: €10.00 - €15.00
                  - generic [ref=e931]:
                    - img [ref=e932]
                    - generic [ref=e937]: 18+
                - generic [ref=e938]:
                  - generic [ref=e939]: House
                  - generic [ref=e940]: Baile Funk
                  - generic "3 more genres in details" [ref=e941]: "+3"
              - generic [ref=e943] [cursor=pointer]:
                - generic [ref=e944]:
                  - generic [ref=e945]:
                    - generic [ref=e948]:
                      - img [ref=e949]
                      - text: Pre-Fete
                    - generic [ref=e952]: 1e
                  - heading "Hip-Hop & Dancehall Party" [level=3] [ref=e953]
                - generic [ref=e954]:
                  - generic [ref=e955]:
                    - img [ref=e956]
                    - generic [ref=e959]: Friday 19th • 22:00 - 05:00
                    - generic "Late start or runs into the night" [ref=e960]:
                      - img [ref=e961]
                  - generic [ref=e963]:
                    - img [ref=e964]
                    - generic [ref=e967]: California Avenue
                    - generic "Indoor event" [ref=e969]:
                      - img [ref=e970]
                  - generic [ref=e974]:
                    - img [ref=e975]
                    - generic [ref=e977]: Free
                  - generic [ref=e978]:
                    - img [ref=e979]
                    - generic [ref=e984]: 18+
                - generic [ref=e985]:
                  - generic [ref=e986]: 🇫🇷 FR
                  - generic [ref=e987]: Latino
                  - generic [ref=e988]: Reggaeton
                  - generic "3 more genres in details" [ref=e989]: "+3"
              - generic [ref=e991] [cursor=pointer]:
                - generic [ref=e992]:
                  - generic [ref=e993]:
                    - generic [ref=e996]:
                      - img [ref=e997]
                      - text: Pre-Fete
                    - generic [ref=e1000]: 1e
                  - heading "Slow Jams Nation - Fete De La Musique Slow Jams Party" [level=3] [ref=e1001]
                - generic [ref=e1002]:
                  - generic [ref=e1003]:
                    - img [ref=e1004]
                    - generic [ref=e1007]: Friday 19th • 22:00 - 05:00
                    - generic "Late start or runs into the night" [ref=e1008]:
                      - img [ref=e1009]
                  - generic [ref=e1011]:
                    - img [ref=e1012]
                    - generic [ref=e1015]: Salons du Louvre
                    - generic "Indoor event" [ref=e1017]:
                      - img [ref=e1018]
                  - generic [ref=e1022]:
                    - img [ref=e1023]
                    - generic [ref=e1025]: €25.00
                  - generic [ref=e1026]:
                    - img [ref=e1027]
                    - generic [ref=e1032]: 18+
                - generic [ref=e1033]:
                  - generic [ref=e1034]: 🇬🇧 UK
                  - generic [ref=e1035]: Soul
                  - generic [ref=e1036]: Slow Jams
                  - generic [ref=e1037]: R&B
              - generic [ref=e1039] [cursor=pointer]:
                - generic [ref=e1040]:
                  - generic [ref=e1041]:
                    - generic [ref=e1044]:
                      - img [ref=e1045]
                      - text: Pre-Fete
                    - generic [ref=e1048]: 15e
                  - heading "Amapianoland - Fete De La Musique Festival" [level=3] [ref=e1049]
                - generic [ref=e1050]:
                  - generic [ref=e1051]:
                    - img [ref=e1052]
                    - generic [ref=e1055]: Friday 19th • 23:00 - 05:00
                    - generic "Late start or runs into the night" [ref=e1056]:
                      - img [ref=e1057]
                  - generic [ref=e1059]:
                    - img [ref=e1060]
                    - generic [ref=e1063]: Terminal 7
                    - generic "Indoor event" [ref=e1065]:
                      - img [ref=e1066]
                  - generic [ref=e1070]:
                    - img [ref=e1071]
                    - generic [ref=e1073]: €30.00
                  - generic [ref=e1074]:
                    - img [ref=e1075]
                    - generic [ref=e1080]: 18+
                - generic [ref=e1081]:
                  - generic [ref=e1082]: 🇬🇧 UK
                  - generic [ref=e1083]: Amapiano
                  - generic [ref=e1084]: Afrobeats
              - generic [ref=e1086] [cursor=pointer]:
                - generic [ref=e1087]:
                  - generic [ref=e1088]:
                    - generic [ref=e1091]:
                      - img [ref=e1092]
                      - text: Pre-Fete
                    - generic [ref=e1095]: 8e
                  - heading "Dankie Sounds FDLM Opening Party" [level=3] [ref=e1096]
                - generic [ref=e1097]:
                  - generic [ref=e1098]:
                    - img [ref=e1099]
                    - generic [ref=e1102]: Friday 19th • 23:00 - 05:00
                    - generic "Late start or runs into the night" [ref=e1103]:
                      - img [ref=e1104]
                  - generic [ref=e1106]:
                    - img [ref=e1107]
                    - generic [ref=e1110]: Les Planches
                    - generic "Indoor event" [ref=e1112]:
                      - img [ref=e1113]
                  - generic [ref=e1117]:
                    - img [ref=e1118]
                    - generic [ref=e1120]: €18.49 - €26.10
                  - generic [ref=e1121]:
                    - img [ref=e1122]
                    - generic [ref=e1127]: 18+
                - generic [ref=e1128]:
                  - generic [ref=e1129]: 🇬🇧 UK
                  - generic [ref=e1130]: Afrotrap
                  - generic [ref=e1131]: 3-Step
                  - generic "7 more genres in details" [ref=e1132]: "+7"
              - generic [ref=e1134] [cursor=pointer]:
                - generic [ref=e1135]:
                  - generic [ref=e1136]:
                    - generic [ref=e1139]:
                      - img [ref=e1140]
                      - text: Pre-Fete
                    - generic [ref=e1143]: 16e
                  - 'heading "La Clairière : Shimza, Kasango, Amrita" [level=3] [ref=e1144]'
                - generic [ref=e1145]:
                  - generic [ref=e1146]:
                    - img [ref=e1147]
                    - generic [ref=e1150]: Friday 19th • 23:00 - 05:00
                    - generic "Late start or runs into the night" [ref=e1151]:
                      - img [ref=e1152]
                  - generic [ref=e1154]:
                    - img [ref=e1155]
                    - generic [ref=e1158]: La Clairière
                    - generic "Outdoor event" [ref=e1160]:
                      - img [ref=e1161]
                  - generic [ref=e1164]:
                    - img [ref=e1165]
                    - generic [ref=e1167]: €14.00 - €39.00
                  - generic [ref=e1168]:
                    - img [ref=e1169]
                    - generic [ref=e1174]: 18+
                - generic [ref=e1175]:
                  - generic [ref=e1176]: 🇫🇷 FR
                  - generic [ref=e1177]: Afro House
                  - generic [ref=e1178]: Amapiano
              - generic [ref=e1180] [cursor=pointer]:
                - generic [ref=e1181]:
                  - generic [ref=e1182]:
                    - generic [ref=e1185]:
                      - img [ref=e1186]
                      - text: Pre-Fete
                    - generic [ref=e1189]: 19e
                  - heading "This is LA VIE (Friday)" [level=3] [ref=e1190]
                - generic [ref=e1191]:
                  - generic [ref=e1192]:
                    - img [ref=e1193]
                    - generic [ref=e1196]: Friday 19th • 23:00 - 05:00
                    - generic "Late start or runs into the night" [ref=e1197]:
                      - img [ref=e1198]
                  - generic [ref=e1200]:
                    - img [ref=e1201]
                    - generic [ref=e1204]: Movida Club
                    - generic "Indoor event" [ref=e1206]:
                      - img [ref=e1207]
                  - generic [ref=e1211]:
                    - img [ref=e1212]
                    - generic [ref=e1214]: £37.39
                  - generic [ref=e1215]:
                    - img [ref=e1216]
                    - generic [ref=e1221]: 20+
                - generic [ref=e1222]:
                  - generic [ref=e1223]: 🇬🇧 UK
                  - generic [ref=e1224]: Dancehall
                  - generic [ref=e1225]: Hip Hop
                  - generic "2 more genres in details" [ref=e1226]: "+2"
              - generic [ref=e1228] [cursor=pointer]:
                - generic [ref=e1229]:
                  - generic [ref=e1230]:
                    - generic [ref=e1233]:
                      - img [ref=e1234]
                      - text: Pre-Fete
                    - generic [ref=e1237]: 13e
                  - heading "Trendy X Sika FDLM Day 1" [level=3] [ref=e1238]
                - generic [ref=e1239]:
                  - generic [ref=e1240]:
                    - img [ref=e1241]
                    - generic [ref=e1244]: Friday 19th • 23:00 - 06:00
                    - generic "Late start or runs into the night" [ref=e1245]:
                      - img [ref=e1246]
                  - generic [ref=e1248]:
                    - img [ref=e1249]
                    - generic [ref=e1252]: Wanderlust
                    - generic [ref=e1253]:
                      - generic "Indoor event" [ref=e1254]:
                        - img [ref=e1255]
                      - generic "Outdoor event" [ref=e1259]:
                        - img [ref=e1260]
                  - generic [ref=e1263]:
                    - img [ref=e1264]
                    - generic [ref=e1266]: €20.00 - €30.00
                  - generic [ref=e1267]:
                    - img [ref=e1268]
                    - generic [ref=e1273]: 18+
                - generic [ref=e1274]:
                  - generic [ref=e1275]: 🇫🇷 FR
                  - generic [ref=e1276]: 🇬🇧 UK
                  - generic [ref=e1277]: FR Afro
                  - generic [ref=e1278]: Kompa
                  - generic "8 more genres in details" [ref=e1279]: "+8"
              - generic [ref=e1281] [cursor=pointer]:
                - generic [ref=e1282]:
                  - generic [ref=e1283]:
                    - generic [ref=e1286]:
                      - img [ref=e1287]
                      - text: Pre-Fete
                    - generic [ref=e1290]: 9e
                  - heading "G2g X Ntaba2london – Live Showcase • Fête De La Musique" [level=3] [ref=e1291]
                - generic [ref=e1292]:
                  - generic [ref=e1293]:
                    - img [ref=e1294]
                    - generic [ref=e1297]: Friday 19th • 23:30 - 06:00
                    - generic "Late start or runs into the night" [ref=e1298]:
                      - img [ref=e1299]
                  - generic [ref=e1301]:
                    - img [ref=e1302]
                    - generic [ref=e1305]: INFINITY CLUB
                    - generic "Indoor event" [ref=e1307]:
                      - img [ref=e1308]
                  - generic [ref=e1312]:
                    - img [ref=e1313]
                    - generic [ref=e1315]: €15.00 - €17.50
                  - generic [ref=e1316]:
                    - img [ref=e1317]
                    - generic [ref=e1322]: 18+
                - generic [ref=e1323]:
                  - generic [ref=e1324]: 🇫🇷 FR
                  - generic [ref=e1325]: Rap
                  - generic [ref=e1326]: Shatta
                  - generic "3 more genres in details" [ref=e1327]: "+3"
              - generic [ref=e1329] [cursor=pointer]:
                - generic [ref=e1330]:
                  - generic [ref=e1331]:
                    - generic [ref=e1334]:
                      - img [ref=e1335]
                      - text: Pre-Fete
                    - generic [ref=e1338]: 2e
                  - heading "Kapela presents Lost in The Dance" [level=3] [ref=e1339]
                - generic [ref=e1340]:
                  - generic [ref=e1341]:
                    - img [ref=e1342]
                    - generic [ref=e1345]: Friday 19th • 23:59 - 07:00
                    - generic "Late start or runs into the night" [ref=e1346]:
                      - img [ref=e1347]
                  - generic [ref=e1349]:
                    - img [ref=e1350]
                    - generic [ref=e1353]: Rex Club
                    - generic "Indoor event" [ref=e1355]:
                      - img [ref=e1356]
                  - generic [ref=e1360]:
                    - img [ref=e1361]
                    - generic [ref=e1363]: €15.80 - €22.80
                  - generic [ref=e1364]:
                    - img [ref=e1365]
                    - generic [ref=e1370]: 18+
                - generic [ref=e1371]:
                  - generic [ref=e1372]: 🇫🇷 FR
                  - generic [ref=e1373]: Deep House
                  - generic [ref=e1374]: House
                  - generic [ref=e1375]: Afro House
              - generic [ref=e1377] [cursor=pointer]:
                - generic [ref=e1378]:
                  - generic [ref=e1379]:
                    - generic [ref=e1382]:
                      - img [ref=e1383]
                      - text: Pre-Fete
                    - generic [ref=e1386]: 16e
                  - heading "SIXTION - Welcome 2 Paris" [level=3] [ref=e1387]
                - generic [ref=e1388]:
                  - generic [ref=e1389]:
                    - img [ref=e1390]
                    - generic [ref=e1393]: Friday 19th • 23:59 - 06:00
                    - generic "Late start or runs into the night" [ref=e1394]:
                      - img [ref=e1395]
                  - generic [ref=e1397]:
                    - img [ref=e1398]
                    - generic [ref=e1401]: YOYO
                    - generic "Indoor event" [ref=e1403]:
                      - img [ref=e1404]
                  - generic [ref=e1408]:
                    - img [ref=e1409]
                    - generic [ref=e1411]: €19.46 - €29.18
                  - generic [ref=e1412]:
                    - img [ref=e1413]
                    - generic [ref=e1418]: 18+
                - generic [ref=e1419]:
                  - generic [ref=e1420]: 🇫🇷 FR
                  - generic [ref=e1421]: FR Afro
                  - generic [ref=e1422]: Kompa
                  - generic "8 more genres in details" [ref=e1423]: "+8"
              - generic [ref=e1425] [cursor=pointer]:
                - generic [ref=e1426]:
                  - generic [ref=e1427]:
                    - generic [ref=e1430]:
                      - img [ref=e1431]
                      - text: Pre-Fete
                    - generic [ref=e1434]: 18e
                  - heading "Zsongo Presents, A Beautiful Game. Umoya Takeover." [level=3] [ref=e1435]
                - generic [ref=e1436]:
                  - generic [ref=e1437]:
                    - img [ref=e1438]
                    - generic [ref=e1441]: Friday 19th • 23:59 - 06:00
                    - generic "Late start or runs into the night" [ref=e1442]:
                      - img [ref=e1443]
                  - generic [ref=e1445]:
                    - img [ref=e1446]
                    - generic [ref=e1449]: La Machine du Moulin Rouge
                    - generic "Indoor event" [ref=e1451]:
                      - img [ref=e1452]
                  - generic [ref=e1456]:
                    - img [ref=e1457]
                    - generic [ref=e1459]: €28.00 - €35.84
                  - generic [ref=e1460]:
                    - img [ref=e1461]
                    - generic [ref=e1466]: 18+
                - generic [ref=e1467]:
                  - generic [ref=e1468]: 🇪🇸 ES
                  - generic [ref=e1469]: Afro House
                  - generic [ref=e1470]: Afro
                  - generic "2 more genres in details" [ref=e1471]: "+2"
              - generic [ref=e1473] [cursor=pointer]:
                - generic [ref=e1474]:
                  - generic [ref=e1475]:
                    - generic [ref=e1478]:
                      - img [ref=e1479]
                      - text: Pre-Fete
                    - generic [ref=e1482]: Outside Paris
                  - heading "NickiPik" [level=3] [ref=e1483]
                - generic [ref=e1484]:
                  - generic [ref=e1485]:
                    - img [ref=e1486]
                    - generic [ref=e1489]: Saturday 20th • 14:00 - 21:30
                    - generic "Daytime and early evening" [ref=e1490]:
                      - img [ref=e1491]
                  - generic [ref=e1497]:
                    - img [ref=e1498]
                    - generic [ref=e1501]: Domaine de la Grange-la-Prévôté
                    - generic "Outdoor event" [ref=e1503]:
                      - img [ref=e1504]
                  - generic [ref=e1507]:
                    - img [ref=e1508]
                    - generic [ref=e1510]: €16.20 - €37.80
                  - generic [ref=e1511]:
                    - img [ref=e1512]
                    - generic [ref=e1517]: 18+
                - generic [ref=e1518]:
                  - generic [ref=e1519]: 🇫🇷 FR
                  - generic [ref=e1520]: Bouyon
                  - generic [ref=e1521]: Dancehall
                  - generic "4 more genres in details" [ref=e1522]: "+4"
              - generic [ref=e1524] [cursor=pointer]:
                - generic [ref=e1525]:
                  - generic [ref=e1526]:
                    - generic [ref=e1529]:
                      - img [ref=e1530]
                      - text: Pre-Fete
                    - generic [ref=e1533]: 7e
                  - heading "FDLM Meet-Up Picnic" [level=3] [ref=e1534]
                - generic [ref=e1535]:
                  - generic [ref=e1536]:
                    - img [ref=e1537]
                    - generic [ref=e1540]: Saturday 20th • 16:00 - 22:00
                    - generic "Daytime and early evening" [ref=e1541]:
                      - img [ref=e1542]
                  - generic [ref=e1548]:
                    - img [ref=e1549]
                    - generic [ref=e1552]: Champ de Mars
                    - generic "Outdoor event" [ref=e1554]:
                      - img [ref=e1555]
                  - generic [ref=e1558]:
                    - img [ref=e1559]
                    - generic [ref=e1561]: Free
                  - generic [ref=e1562]:
                    - img [ref=e1563]
                    - generic [ref=e1568]: All ages
                - generic [ref=e1569]:
                  - generic [ref=e1570]: Afrotrap
                  - generic [ref=e1571]: French Pop
                  - generic "5 more genres in details" [ref=e1572]: "+5"
              - generic [ref=e1574] [cursor=pointer]:
                - generic [ref=e1575]:
                  - generic [ref=e1576]:
                    - generic [ref=e1579]:
                      - img [ref=e1580]
                      - text: Pre-Fete
                    - generic [ref=e1583]: 19e
                  - 'heading "SOCIALKIDS X RSPACE: ''FETE DE LA MUSIQUE'' DAY PARTY!" [level=3] [ref=e1584]'
                - generic [ref=e1585]:
                  - generic [ref=e1586]:
                    - img [ref=e1587]
                    - generic [ref=e1590]: Saturday 20th • 16:00 - 23:00
                    - generic "Daytime and early evening" [ref=e1591]:
                      - img [ref=e1592]
                  - generic [ref=e1598]:
                    - img [ref=e1599]
                    - generic [ref=e1602]: "211"
                    - generic [ref=e1603]:
                      - generic "Indoor event" [ref=e1604]:
                        - img [ref=e1605]
                      - generic "Outdoor event" [ref=e1609]:
                        - img [ref=e1610]
                  - generic [ref=e1613]:
                    - img [ref=e1614]
                    - generic [ref=e1616]: £22.38
                  - generic [ref=e1617]:
                    - img [ref=e1618]
                    - generic [ref=e1623]: 18+
                - generic [ref=e1624]:
                  - generic [ref=e1625]: 🇬🇧 UK
                  - generic [ref=e1626]: UK Underground
                  - generic [ref=e1627]: Kizomba
                  - generic "6 more genres in details" [ref=e1628]: "+6"
            - button "Show more events (24/58)" [ref=e1630]:
              - text: Show more events
              - generic [ref=e1631]: (24/58)
      - button "Scroll to top":
        - img
  - contentinfo [ref=e1632]:
    - generic [ref=e1634]:
      - generic [ref=e1635]:
        - generic [ref=e1636]:
          - generic [ref=e1637]: Follow us on socials for updates
          - generic [ref=e1638]:
            - link "Visit Out of Office Collective website" [ref=e1639] [cursor=pointer]:
              - /url: https://www.outofofficecollective.co.uk/
              - img [ref=e1640]
              - img [ref=e1643]
            - link "Follow Out of Office Collective on Instagram" [ref=e1647] [cursor=pointer]:
              - /url: https://www.instagram.com/outofofficecollectivee/
              - img [ref=e1648]
              - img [ref=e1650]
            - link "Follow Out of Office Collective on TikTok" [ref=e1654] [cursor=pointer]:
              - /url: https://www.tiktok.com/@outofofficecollective
              - img [ref=e1655]
              - img [ref=e1657]
        - navigation "Footer" [ref=e1661]:
          - link "How it works" [ref=e1662] [cursor=pointer]:
            - /url: /how-it-works
          - link "Submit your event" [ref=e1663] [cursor=pointer]:
            - /url: /submit-event
          - link "Promote" [ref=e1664] [cursor=pointer]:
            - /url: /feature-event
          - link "Privacy Policy" [ref=e1665] [cursor=pointer]:
            - /url: /privacy
          - link "Contact us" [ref=e1666] [cursor=pointer]:
            - /url: https://outofofficecollective.co.uk/contact
          - link "FAQ's" [ref=e1667] [cursor=pointer]:
            - /url: https://outofofficecollective.co.uk/faqs
      - generic [ref=e1668]:
        - generic [ref=e1669]:
          - generic [ref=e1670]:
            - generic [ref=e1671]: Web app v2.0.0 • Made by
            - link "Milkandhenny" [ref=e1672] [cursor=pointer]:
              - /url: https://x.com/milkandh3nny
          - generic [ref=e1673]: •
          - link "Buy me a croissant" [ref=e1674] [cursor=pointer]:
            - /url: https://coff.ee/milkandhenny
            - img [ref=e1675]
            - generic [ref=e1681]: Buy me a croissant
        - generic [ref=e1682]: Maintained by the OOOC Community
  - alert [ref=e1683]
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
  - generic [ref=e1685]: Offline mode
  - dialog "Find your first plan in 30 seconds" [ref=e1687]:
    - generic [active] [ref=e1688]:
      - paragraph [ref=e1689]: Fete Finder
      - heading "Find your first plan in 30 seconds" [level=2] [ref=e1690]
      - paragraph [ref=e1691]: Take a quick guided pass through picks, map, filters, search and event cards.
      - generic [ref=e1692]:
        - button "Not now" [ref=e1693]
        - button "Start tour" [ref=e1694]
```

# Test source

```ts
  393 | 		expect(mapBox?.height ?? 0).toBeGreaterThan(200);
  394 | 	});
  395 | 
  396 | 	test("homepage card clicks open an event modal without a full page navigation flash", async ({
  397 | 		page,
  398 | 	}) => {
  399 | 		await page.goto("/");
  400 | 
  401 | 		await page.locator("#tour-first-event-card").click();
  402 | 
  403 | 		await expect(page).toHaveURL(/\/event\/evt_[^/]+\/[^/]+/);
  404 | 		await expect(page.getByRole("dialog")).toBeVisible();
  405 | 		await expect(
  406 | 			page.getByRole("button", { name: "Close event details" }),
  407 | 		).toBeVisible();
  408 | 		await expect(page.getByRole("dialog")).toHaveScreenshot(
  409 | 			"homepage-click-modal.png",
  410 | 		);
  411 | 	});
  412 | 
  413 | 	test("homepage event modal opens promptly without a late layout jump", async ({
  414 | 		page,
  415 | 	}) => {
  416 | 		await page.goto("/");
  417 | 
  418 | 		await page.locator("#tour-first-event-card").click();
  419 | 
  420 | 		const modalCard = page.locator("[data-event-modal-card]");
  421 | 		await expect(modalCard).toBeVisible();
  422 | 
  423 | 		const firstBox = await modalCard.boundingBox();
  424 | 		expect(firstBox).not.toBeNull();
  425 | 		await page.waitForTimeout(700);
  426 | 		const settledBox = await modalCard.boundingBox();
  427 | 		expect(settledBox).not.toBeNull();
  428 | 
  429 | 		expect(Math.abs((settledBox?.x ?? 0) - (firstBox?.x ?? 0))).toBeLessThan(3);
  430 | 		expect(Math.abs((settledBox?.y ?? 0) - (firstBox?.y ?? 0))).toBeLessThan(3);
  431 | 		expect(
  432 | 			Math.abs((settledBox?.width ?? 0) - (firstBox?.width ?? 0)),
  433 | 		).toBeLessThan(3);
  434 | 		expect(
  435 | 			Math.abs((settledBox?.height ?? 0) - (firstBox?.height ?? 0)),
  436 | 		).toBeLessThan(8);
  437 | 	});
  438 | 
  439 | 	test("homepage map preloads by default", async ({ page }) => {
  440 | 		await page.goto("/");
  441 | 
  442 | 		await expect(
  443 | 			page.getByRole("button", { name: /expand paris event map/i }),
  444 | 		).toBeVisible();
  445 | 		await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  446 | 	});
  447 | 
  448 | 	test("homepage map defers when the saved map loading setting requests it", async ({
  449 | 		page,
  450 | 	}) => {
  451 | 		await page.addInitScript((storageKey) => {
  452 | 			window.localStorage.setItem(
  453 | 				storageKey,
  454 | 				JSON.stringify({ mapLoadStrategy: "expand" }),
  455 | 			);
  456 | 		}, LOCAL_APP_SETTINGS_STORAGE_KEY);
  457 | 
  458 | 		await page.goto("/");
  459 | 
  460 | 		await expect(
  461 | 			page.getByRole("button", { name: /expand paris event map/i }),
  462 | 		).toBeVisible();
  463 | 		await expect(page.locator(".maplibregl-canvas")).toHaveCount(0);
  464 | 
  465 | 		await page.getByRole("button", { name: /expand paris event map/i }).click();
  466 | 
  467 | 		await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  468 | 	});
  469 | 
  470 | 	test("homepage reloads offline from saved events with search and map fallback", async ({
  471 | 		context,
  472 | 		page,
  473 | 	}) => {
  474 | 		await verifyUserSession(page);
  475 | 		await page.goto("/");
  476 | 		await expect(page.locator("#tour-first-event-card")).toBeVisible();
  477 | 		await waitForServiceWorkerReady(page);
  478 | 		await page.reload({ waitUntil: "domcontentloaded" });
  479 | 		await expect(page.locator("#tour-first-event-card")).toBeVisible();
  480 | 		await waitForHomeEventSnapshot(page);
  481 | 		await waitForOfflineGraceState(page);
  482 | 
  483 | 		await setBrowserOffline(context, page, true);
  484 | 		await page.reload({ waitUntil: "domcontentloaded" });
  485 | 		await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  486 | 
  487 | 		await expect(page.getByText(/^Cached event data:/)).toBeVisible();
  488 | 		await expect(page.locator("#tour-first-event-card")).toBeVisible();
  489 | 
  490 | 		const searchInput = page.getByRole("textbox", {
  491 | 			name: "Search events, locations, genres, phases...",
  492 | 		});
> 493 | 		await searchInput.fill("Krispy");
      |                     ^ Error: locator.fill: Test timeout of 30000ms exceeded.
  494 | 		await expect(
  495 | 			page
  496 | 				.locator("#tour-all-events")
  497 | 				.getByRole("heading", { name: "Krispy Jam N°29 - Tascha" }),
  498 | 		).toBeVisible();
  499 | 		await expect(page.getByText(/\b1 event found\b/)).toBeVisible();
  500 | 
  501 | 		await expect(
  502 | 			page.getByText(
  503 | 				"Map style, sprite, glyph, and tile assets are online-only. Cached event browsing, search, and filters are still available below.",
  504 | 			).first(),
  505 | 		).toBeVisible();
  506 | 	});
  507 | 
  508 | 	test("live session seeds offline grace before protected filters are used offline", async ({
  509 | 		context,
  510 | 		page,
  511 | 	}) => {
  512 | 		await verifyUserSession(page);
  513 | 		await page.goto("/?offlineDebug=1");
  514 | 		await expect(page.locator("#tour-first-event-card")).toBeVisible();
  515 | 		const sessionPayload = await page.evaluate(async () => {
  516 | 			const response = await fetch("/api/auth/session", { cache: "no-store" });
  517 | 			return response.json() as Promise<{ isAuthenticated: boolean }>;
  518 | 		});
  519 | 		expect(sessionPayload).toMatchObject({ isAuthenticated: true });
  520 | 		await waitForServiceWorkerReady(page);
  521 | 		await page.reload({ waitUntil: "domcontentloaded" });
  522 | 		await expect(page.locator("#tour-first-event-card")).toBeVisible();
  523 | 		await waitForHomeEventSnapshot(page);
  524 | 		await waitForOfflineGraceState(page);
  525 | 		await expect(page.getByText("Auth mode").locator("..")).toContainText(
  526 | 			"live",
  527 | 		);
  528 | 		await expect(
  529 | 			page.getByText("Protected discovery").locator(".."),
  530 | 		).toContainText("allowed");
  531 | 
  532 | 		await setBrowserOffline(context, page, true);
  533 | 		await page.reload({ waitUntil: "domcontentloaded" });
  534 | 		await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  535 | 
  536 | 		await expect(page.getByText(/^Cached event data:/)).toBeVisible();
  537 | 		await expect(page.getByText("Auth mode").locator("..")).toContainText(
  538 | 			"offline-grace",
  539 | 		);
  540 | 		await expect(
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
```