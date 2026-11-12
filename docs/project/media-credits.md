# Media and data credits: prototype Makarba map

Last updated 2026-11-10. This covers the offline 3D map, the landmark notes and the prototype dataset served by the mock API.

## What each kind of content is

| Content | Kind | Where |
|---|---|---|
| Places, timelines, stories, insight figures | **Composite, fictional examples** (prototype dataset). They draw on general themes from the team's field notes (street vending at a busy junction by a shrine, permission to vend, traffic, weekend crowds and a yearly fair, a bus and auto stand, a canal bank, a former mill site, a small pooled-money start). No participant, quote, name, amount, photo or interview is reproduced. Not survey results. | `apps/api/src/demo-makarba.ts` |
| Landmark notes | **Sourced facts**, paraphrased (no copied paragraphs), each with source URL and retrieval date. Unverifiable claims were left out. | `apps/web/src/landmarks.tsx` |
| Basemap (roads, lake, canal, greens, Roza massing, buildings) | **Approximate sketch** drawn for this prototype, not surveyed. Building footprints and heights are generated from dummy attributes. | `apps/web/src/map/basemap.ts` |
| Photographs on landmark cards | **Openly licensed Wikimedia Commons files** (public domain, CC BY-SA), bundled locally so the site needs no network. Credited next to each image and below. | `apps/web/public/media/landmarks/` |
| Illustrations on the other landmark cards | **Original SVG drawings** made for this project (project-own), used where no suitable licensed photo was found. They are not photographs. | `apps/web/src/landmarks.tsx` |

The public site shows one disclosure line in the footer of every page, linking to "About this prototype dataset" on the methodology page.

## Text sources (retrieved 2026-11-10)

| Fact(s) | Source |
|---|---|
| Sarkhej Roza: location in Makarba, ~7 km south-west of Ahmedabad; coordinates 22°59′32″N 72°30′16″E; tomb begun 1445 under Muhammad Shah II and completed 1451 under Qutbuddin Ahmad Shah II; greatly expanded by Mahmud Begada (palace; mausoleum for himself and his family); Monument of National Importance (ASI list); reduced from ~29 ha to ~14 ha by encroachment; Le Corbusier's comparison with the Acropolis of Athens; tomb built in honour of Shaikh Ahmed Khattu Ganj Bakhsh, who died there in 1445; his mausoleum described as the largest of its kind in Gujarat; Sarkhej Lake ~6.9 ha, dug under Mahmud Begada, surrounded with cut stone steps, palace (now ruined) at its south-west corner | https://en.wikipedia.org/wiki/Sarkhej_Roza (CC BY-SA 4.0 text, paraphrased) |
| Makarba: census town in Ahmedabad district; 2001 population 18,090; coordinates 22°59′39″N 72°30′27″E | https://en.wikipedia.org/wiki/Makarba (CC BY-SA 4.0 text, paraphrased) |
| Sarkhej–Gandhinagar Highway: ~44.5 km, Sarkhej to Gandhinagar, major part of NH 147, administration passed from NHAI to the Government of Gujarat in 2015 | https://en.wikipedia.org/wiki/Sarkhej%E2%80%93Gandhinagar_Highway (CC BY-SA 4.0 text, paraphrased) |
| Ahmedabad: founded by Ahmed Shah I on 26 February 1411 and named after him; "Manchester of India" nickname from the textile industry; from the mid-1970s several mills closed under competition from automation and specialised domestic looms, leaving 40,000–50,000 people without income | https://en.wikipedia.org/wiki/Ahmedabad (CC BY-SA 4.0 text, paraphrased) |

Every claim above was re-checked against the live article on 2026-11-10. Corrections made during that check: the Sarkhej Roza article is inconsistent about whose queen "Rajbai" was, so the name is not used; "dedicated to" the saint was narrowed to "built in his honour"; an unsourced remark about village lanes and towers was removed from the tour.

Checked but **not used**: a separate article on Shaikh Ahmed Khattu (no Wikipedia page found), the claim that he advised Ahmad Shah on founding the city (found only on non-encyclopaedic sites), and any history of a specific mill or of Makarba lake (no checkable source found). The mill site on the map is a composite example; the Calico Mills photo is city-wide context and is captioned "Not in Makarba".

## Photographs (Wikimedia Commons, bundled locally)

Retrieved 2026-11-10 through the Wikimedia API (metadata via `en.wikipedia.org/w/api.php`, files from `upload.wikimedia.org`). No Google Images, no scraping of other sites, and **nothing from the team's private DATA folder**. Modifications for every file: downscaled to at most 960 px wide, re-encoded as progressive JPEG (quality 72–78) to stay under 150 KB, and embedded metadata stripped. No cropping, retouching or colour change. Each image is shown with its caption, author, licence and a link to its Commons page, and has descriptive alt text. None shows an identifiable person in close-up.

| File in `apps/web/public/media/landmarks/` | Shows | Author | Licence | Source | Size |
|---|---|---|---|---|---|
| `sarkhej-roza.jpg` | Sarkhej Roza mosque from the courtyard (2011) | Museeb fakih (own work) | Public domain (released by the author) | https://commons.wikimedia.org/wiki/File:Sarkhej.JPG | 145 KB |
| `sarkhej-tank-outlet-1855.jpg` | Outlet of the Sarkhej tank, albumen print, 1855 | William Johnson; SMU Central University Libraries (Flickr Commons) | No known copyright restrictions (public domain, 1855) — https://www.flickr.com/commons/usage/ | https://commons.wikimedia.org/wiki/File:Outlet_of_Sarkhej_Roza_Tank_Ahmedabad_1855.jpg | 105 KB |
| `sarkhej-queens-gallery-1878.jpg` | Engraving of the gallery to the queens' tombs at Sarkhej (1878) | Louis Rousselet | Public domain (published 1878) | https://commons.wikimedia.org/wiki/File:Queen%27s_tomb.jpg | 139 KB |
| `sg-highway-2012.jpg` | Sarkhej–Gandhinagar Highway (2012) | Abhishek.ujoshi (own work) | CC BY-SA 3.0 — https://creativecommons.org/licenses/by-sa/3.0 | https://commons.wikimedia.org/wiki/File:SG._Highway.JPG | 54 KB |
| `calico-mills-chimney.jpg` | Calico Mills chimney with Baba Lului's Mosque in front (2021; Ahmedabad, not Makarba) | Imfarhad7 (own work) | CC BY-SA 4.0 — https://creativecommons.org/licenses/by-sa/4.0 | https://commons.wikimedia.org/wiki/File:Calico_Mills_3.jpg | 77 KB |

**Share-alike:** `sg-highway-2012.jpg` and `calico-mills-chimney.jpg` are CC BY-SA. Our resized versions are adaptations and are therefore shared under the same licence (CC BY-SA 3.0 and 4.0 respectively) with the attribution above; anyone reusing them must do the same. The site's own code licence does not apply to these files.

Cards without a suitable licensed photo (Shaikh Ahmed Khattu, Ahmed Shah I, Makarba) keep the original drawings. To add more, follow the same rules: Commons only, CC0 / public domain / CC BY / CC BY-SA, at most ~6 files of at most 150 KB each, recorded here and credited in the UI. Images live under `apps/web/public/` (outside `dist/assets`, so the bundle budget categories stay unchanged).


## Place photographs (Wikimedia Commons, bundled locally) — added 2026-11-12

Retrieved through the Commons API (`commons.wikimedia.org/w/api.php`, 960 px thumbnails from `upload.wikimedia.org`, then resized to at most 820 px and recompressed to stay under the 150 KB per-photo budget), same rules as above: Commons only, open licences, bundled so the site needs no network, credited on screen. The demo places are not real businesses, so most photos are **representative** Ahmedabad scenes of the same kind of place and are captioned "Representative photo" in the app; the two Sarkhej Roza lake photos show the real place. Synthetic panorama and photo placeholders are no longer shown.

| File in `apps/web/public/media/places/` | Shows / used for | Author | Licence | Source | Size |
|---|---|---|---|---|---|
| `ahmedabad2007-066.jpg` | Fruit stall (representative for Junction fruit and sugarcane carts) | Helfmann | CC BY-SA 4.0 — https://creativecommons.org/licenses/by-sa/4.0 | https://commons.wikimedia.org/wiki/File:Ahmedabad2007-066.JPG | 112 KB |
| `ahmedabad2007-095.jpg` | Dabeli snack cart (representative for Crowd-funded snack stall) | Helfmann | CC BY-SA 4.0 — https://creativecommons.org/licenses/by-sa/4.0 | https://commons.wikimedia.org/wiki/File:Ahmedabad2007-095.JPG | 118 KB |
| `ahmedabad2007-101.jpg` | Street kiosk under trees (representative for Mosque-lane tea corner) | Helfmann | CC BY-SA 4.0 — https://creativecommons.org/licenses/by-sa/4.0 | https://commons.wikimedia.org/wiki/File:Ahmedabad2007-101.JPG | 130 KB |
| `ahmedabad2007-151.jpg` | Roadside cart on an open road (representative for Factory-road vending stretch) | Helfmann | CC BY-SA 4.0 — https://creativecommons.org/licenses/by-sa/4.0 | https://commons.wikimedia.org/wiki/File:Ahmedabad2007-151.JPG | 119 KB |
| `ahmedabad2007-167.jpg` | Open plaza with stalls (representative for Weekend mela ground) | Helfmann | CC BY-SA 4.0 — https://creativecommons.org/licenses/by-sa/4.0 | https://commons.wikimedia.org/wiki/File:Ahmedabad2007-167.JPG | 88 KB |
| `ahmedabad-amts-bus.jpg` | AMTS bus stop, Lal Darwaja (representative for Village bus stand) | Vrajesh jani | CC BY-SA 3.0 — https://creativecommons.org/licenses/by-sa/3.0 | https://commons.wikimedia.org/wiki/File:Ahmedabad_AMTS_Bus.JPG | 100 KB |
| `auto-rickshaws-in-ahmedabad.jpg` | Auto-rickshaws (representative for Highway auto stand) | Bernard Gagnon | CC BY-SA 3.0 — https://creativecommons.org/licenses/by-sa/3.0 | https://commons.wikimedia.org/wiki/File:Auto_rickshaws_in_Ahmedabad.jpg | 117 KB |
| `sarkhej-roza-ahmed-sar-lake-jama-masjid-01.jpg` | Sarkhej Roza seen across the lake bed (the real place; used for Lake-edge viewing steps) | WeHaKa | CC BY-SA 4.0 — https://creativecommons.org/licenses/by-sa/4.0 | https://commons.wikimedia.org/wiki/File:Sarkhej_Roza-Ahmed_Sar_Lake-Jama_Masjid-01.jpg | 116 KB |
| `sarkhej-roza-ahmed-sar-lake-jama-masjid-05.jpg` | Sarkhej Roza steps and pavilion (the real place; used for Visitor drop-off point) | WeHaKa | CC BY-SA 4.0 — https://creativecommons.org/licenses/by-sa/4.0 | https://commons.wikimedia.org/wiki/File:Sarkhej_Roza-Ahmed_Sar_Lake-Jama_Masjid-05.jpg | 132 KB |
| `tainter-gate-at-narmada-dholka-canal-01.jpg` | Narmada Dholka canal gate near Ahmedabad (representative for Canal bank walk) | Pravega | CC BY-SA 4.0 — https://creativecommons.org/licenses/by-sa/4.0 | https://commons.wikimedia.org/wiki/File:Tainter_gate_at_Narmada_Dholka_Canal_01.jpg | 104 KB |

**Share-alike:** all ten are CC BY-SA (3.0 or 4.0). The resized versions are adaptations shared under the same licence with the attribution above. The Sarkhej Roza card also reuses `landmarks/sarkhej-roza.jpg` (public domain) and the mill card reuses `landmarks/calico-mills-chimney.jpg` (CC BY-SA 4.0).
