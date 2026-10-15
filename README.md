# ClearText

A polished, client-only readability checker. It estimates a Flesch-style score, grade level, word count, sentence count, and syllables while keeping text in the current browser tab.

## Run locally

From this folder:

```sh
python -m http.server 8000
```

Open http://localhost:8000/ (or double-click `index.html`). No build step, dependencies, account, analytics, or server-side text processing.

## Validation evidence

- Confirmed `index.html` is a complete standalone HTML document with responsive layout, accessible textarea label, privacy notice, and inline functionality.
- Verified the page contains the calculation flow for words, sentences, syllables, grade estimate, score, and live `input` updates.
- Manual smoke test: load the page, paste text, and the snapshot updates immediately; clearing the textarea returns the empty state.

The score is an estimate intended as an editing signal, not a measure of writing quality.
