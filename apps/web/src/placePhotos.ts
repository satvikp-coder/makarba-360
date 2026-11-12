/**
 * Photographs for place cards and profiles. All are openly licensed Wikimedia Commons files, resized and bundled under
 * public/media (credits in docs/project/media-credits.md). Photos of Sarkhej Roza and its lake show the real place; the others are
 * REPRESENTATIVE Ahmedabad scenes of the same kind of place and are captioned that way.
 */
export interface PlacePhoto { src: string; alt: string; title: string; credit: string; licence: string; source: string; representative: boolean }

const C = "https://commons.wikimedia.org/wiki/File:";
const p = (file: string, alt: string, title: string, credit: string, licence: string, commons: string, representative = true): PlacePhoto =>
  ({ src: `/media/places/${file}`, alt, title, credit, licence, source: C + commons, representative });

const PHOTOS: Record<string, PlacePhoto> = {
  "junction-fruit-carts": p("ahmedabad2007-066.jpg", "A roadside fruit stall under a blue tarpaulin, with crates of melons and fruit", "Fruit stall, Ahmedabad (2007)", "Helfmann", "CC BY-SA 4.0", "Ahmedabad2007-066.JPG"),
  "mosque-lane-tea-corner": p("ahmedabad2007-101.jpg", "A small kiosk under trees with a man sitting beside it on a quiet street", "Street kiosk, Ahmedabad (2007)", "Helfmann", "CC BY-SA 4.0", "Ahmedabad2007-101.JPG"),
  "village-bus-stand": p("ahmedabad-amts-bus.jpg", "A red AMTS city bus at a bus stop in Ahmedabad", "AMTS bus stop, Ahmedabad", "Vrajesh jani", "CC BY-SA 3.0", "Ahmedabad_AMTS_Bus.JPG"),
  "highway-auto-stand": p("auto-rickshaws-in-ahmedabad.jpg", "A line of green and yellow auto-rickshaws on an Ahmedabad street", "Auto-rickshaws, Ahmedabad", "Bernard Gagnon", "CC BY-SA 3.0", "Auto_rickshaws_in_Ahmedabad.jpg"),
  "canal-bank-walk": p("tainter-gate-at-narmada-dholka-canal-01.jpg", "A radial gate across the Narmada Dholka canal near Ahmedabad", "Narmada Dholka canal near Ahmedabad", "Pravega", "CC BY-SA 4.0", "Tainter_gate_at_Narmada_Dholka_Canal_01.jpg"),
  "old-cotton-mill-site": { src: "/media/landmarks/calico-mills-chimney.jpg", alt: "The tall chimney of the former Calico Mills in Ahmedabad", title: "Calico Mills chimney, Ahmedabad (2021)", credit: "Imfarhad7", licence: "CC BY-SA 4.0", source: C + "Calico_Mills_3.jpg", representative: true },
  "factory-road-vending-stretch": p("ahmedabad2007-151.jpg", "A food cart with a blue awning on a dusty open road, a scooter passing", "Roadside cart, Ahmedabad (2007)", "Helfmann", "CC BY-SA 4.0", "Ahmedabad2007-151.JPG"),
  "weekend-mela-ground": p("ahmedabad2007-167.jpg", "Families walking past a drinks stall on an open plaza with tall street lamps", "Open plaza with stalls, Ahmedabad (2007)", "Helfmann", "CC BY-SA 4.0", "Ahmedabad2007-167.JPG"),
  "lake-edge-steps": p("sarkhej-roza-ahmed-sar-lake-jama-masjid-01.jpg", "The long stone wall and domes of Sarkhej Roza seen across the grassy lake bed, with new high-rise flats behind", "Sarkhej Roza from the lake", "WeHaKa", "CC BY-SA 4.0", "Sarkhej_Roza-Ahmed_Sar_Lake-Jama_Masjid-01.jpg", false),
  "sarkhej-roza-area": { src: "/media/landmarks/sarkhej-roza.jpg", alt: "The Sarkhej Roza mosque seen from its courtyard", title: "Sarkhej Roza (2011)", credit: "Museeb fakih", licence: "Public domain", source: C + "Sarkhej.JPG", representative: false },
  "crowdfunded-snack-stall": p("ahmedabad2007-095.jpg", "A dabeli snack cart with Gujarati signs on a street corner, an auto-rickshaw parked nearby", "Dabeli cart, Ahmedabad (2007)", "Helfmann", "CC BY-SA 4.0", "Ahmedabad2007-095.JPG"),
  "visitor-drop-off": p("sarkhej-roza-ahmed-sar-lake-jama-masjid-05.jpg", "Stone steps and a pillared pavilion of Sarkhej Roza by the lake, with apartment towers behind", "Sarkhej Roza steps and pavilion", "WeHaKa", "CC BY-SA 4.0", "Sarkhej_Roza-Ahmed_Sar_Lake-Jama_Masjid-05.jpg", false),
};

export const photoFor = (slug: string): PlacePhoto | undefined => PHOTOS[slug];
