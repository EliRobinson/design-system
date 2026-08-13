# Notifications kit

Activity feed, unread filter, and per-channel preferences.

**Rules**

- **Unread is a small coloured dot in a fixed gutter**, not a tinted row — tinted rows make a busy feed look like an error log. The dot colour carries the kind: forest for publishes, amber for money and reviews, red for failures.
- **Every line reads as a sentence**: who, what, the thing (a link), then the time as caption.
- **Two channels, two toggles, one row.** In-app and email are separate switches per category; quiet hours is a select, not a schedule builder.
- **"Mark all read" is reversible** — each row keeps an Undo after it changes.
- The caught-up state is a plain EmptyState, no illustration.
