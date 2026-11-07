# Media and immersive content

Planning baseline: 2026-11-07. Proposed design; no participant collection or product implementation has occurred.

Originals are private. Upload-intent validates owner/study, allowed JPEG/PNG/WebP, supported panorama images and explicitly approved audio/video; proposed caps 15 MB image, 80 MB panorama, 100 MB recording are configurable and piloted. Sniff content, verify digest/size, quarantine, scan malware, decode/re-encode images in isolated worker, strip EXIF/GPS, review faces/plates/voices and rights. No public original URL. Short-lived signed private review URLs; approved derivatives use a separate bucket/prefix and nonidentifying keys.

Metadata: location link (public place, not automatically interview position), capture date precision, direction/viewpoint, creator, licence, consent scope, permission expiry, checksum, source asset, review revision and alt text/transcript. Historical dates can be approximate but precision/uncertainty must be visible. Comparison pair requires matched feature/viewpoint, two cited dates, permitted images and an evidence-quality label; unsupported dates block publication.

Prefer self-captured Pannellum equirectangular panoramas with static photo fallback, captions and keyboard controls. Marzipano is a feasible alternative for complex tours but adds authoring needs. Google Street View requires officially supported embed/API, available coverage, current terms, restricted keys and billing/quota review; do not scrape/cache restricted imagery. Static API and interactive panorama products have different pricing and terms. Mapillary requires developer access/terms verification (documentation login restricted during planning); not promised in MVP. 3D building extrusion/terrain is optional cartographic data, never advertised as panorama coverage. No provider has been activated or paid.

On consent expiry/withdrawal, revoke public derivative and invalidate CDN/snapshots; retain deletion manifest and trace derivatives back to source/consent. Failed scan/upload stays private and retryable, with no half-published image.
