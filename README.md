# Szlaki Pyłu — Web MVP v2.8

Co naprawia:
- Usuwa błąd renderu: `g.ellipse is not a function` (pierścienie planety rysowane są `strokeEllipse()`).
- Dodaje cache-busting: `main.js?v=28` oraz widoczny baner wersji w UI.

## Jak wgrać na GitHub Pages
1) Podmień pliki w repo: `index.html`, `main.js`
2) Commit
3) Otwórz stronę: `.../szlaki_pylu/?v=28`
4) Zrób Ctrl+F5

Jeśli dalej widzisz w zakładce tytuł "Web MVP v2.2" albo w UI inną wersję — to znaczy, że repo nie zostało podmienione (albo Pages serwuje inną gałąź/ścieżkę).
