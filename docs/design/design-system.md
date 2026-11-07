# Visual design system

Planning baseline: 2026-11-07. Proposed design; no participant collection or product implementation has occurred.

Identity: a warm digital urban atlas combining geography, archival evidence and restrained photography. Avoid generic admin ornament and fabricated map art. Typography: locally hosted licensed Noto Sans for English plus Noto Sans Gujarati/Devanagari, with Noto Serif headings only if script coverage tested. Body 16px/1.5; captions 14px; headings fluid 28–48px. Dates/numbers align with tabular numerals. Spacing scale 4/8/12/16/24/32/48/64px, 8px panel radius, subtle single shadow, maximum prose width 70ch.

Tokens: background ivory #F6F2E9; primary text/deep teal #163D3B; accent terracotta #D27A55; sandstone #E6BC6C; lake #4C91A3. Use teal body text on ivory or sandstone only. Teal on terracotta/lake fails normal-text AA in the initial audit; use a tested darker foreground or reserve these accents for non-text decoration. Do not use light accent text on ivory for body copy. Contrast calculations below are generated using WCAG sRGB luminance; normal text ≥4.5:1, large text ≥3:1, focus/UI boundary ≥3:1. Dark focus outline with offset on light surfaces; light outline on teal. Marker icon+shape+label distinguishes category without color alone.

Breakpoints: <768 mobile, 768–1199 compact, ≥1200 desktop. Desktop header 64px, layers 256px, details 360px; map flexes. Compact uses collapsible drawers. Mobile header 56px, safe-area padding, 44px preferred touch targets, sheet peek 112px / half 50vh / full under header; drag gesture has equivalent buttons. No essential action depends on hover or dragging.

Controls: visible labels, input help and inline errors plus summary, real disabled reasons, save/sync statuses as text. Photo grids keep stable aspect ratio and date/credit; alt text describes evidence, never assumes historical cause. Charts use patterns/tooltips plus data tables. 160–220ms panel transitions, no compulsory map fly-through; reduced motion disables nonessential movement. Error red and success green are additional verified tokens to choose with AA contrast during design issue review; no status relies on color alone.
