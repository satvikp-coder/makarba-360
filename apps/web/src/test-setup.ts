// jsdom has no IntersectionObserver; browsers all do. Report every observed element as visible at once, so in-view reveals run.
if (typeof globalThis.IntersectionObserver === "undefined") {
  class IO {
    constructor(private cb: IntersectionObserverCallback) {}
    observe(el: Element) { this.cb([{ isIntersecting: true, intersectionRatio: 1, target: el } as unknown as IntersectionObserverEntry], this as unknown as IntersectionObserver); }
    unobserve() {} disconnect() {} takeRecords() { return []; }
  }
  (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = IO;
}
